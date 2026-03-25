# Tinubu PMO Dashboard — LLM Handover Guide

This document gives the next LLM or agent a fast, accurate summary of the current project state so they can instantly continue where we left off.

**Last Updated:** March 2026 — v3.0 (Sprint Enhancements complete).

---

## 1. Project Overview

- **Name**: Tinubu PMO Dashboard
- **Goal**: Ingest monthly `.xlsx` exports from Zoho (company time-tracking system) and a Demand Capacity file for squad mapping. Display KPIs, resource metrics, utilization insights, and attendance intelligence in an interactive React dashboard.
- **Key Features**: Multi-month data aggregation, Department/Squad toggle, Skye project exclusion, per-employee timesheet compliance tracking.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + **Tailwind CSS v4** (CSS-first `@theme` API) |
| Styling | Light Theme "Command Center" — 40+ M3 color tokens |
| Icons | Google Material Symbols Outlined (CDN) |
| Font | Google Inter (CDN) |
| Charts | Chart.js 4 + react-chartjs-2 |
| Backend | Express 4.21 on Node.js 22, port `3004` |
| Database | PostgreSQL 18 (local, port 5433) via `pg` (node-postgres) |
| File Parsing | SheetJS (`xlsx`) on the Node.js backend |
| File Upload | `multer` (multipart/form-data) |
| Dev Runner | `concurrently` — runs server + client together |

---

## 3. Architecture & Data Flow

### Upload (Write Path)
1. User drags `.xlsx` onto an `UploadZone` on the **Timesheet** tab (3 zones: Timelog, Attendance, Demand Capacity).
2. React POSTs `multipart/form-data` to `/api/upload/timelog`, `/api/upload/attendance`, or `/api/upload/demand-capacity`.
3. Express + Multer handles the file; the ETL parser (SheetJS) normalizes rows.
4. A transaction DELETEs existing rows for the extracted `year_month`, batch-INSERTs new rows (500 per statement), COMMITs.
5. `refresh_all_views()` refreshes all 6 materialized views **AFTER the COMMIT** (critical: CONCURRENT refresh cannot run inside a transaction).

### Query (Read Path)
- Dashboard queries hit **materialized views** — never raw tables (except timesheet-compliance which cross-joins).
- Month filter: `?months=YYYY-MM,YYYY-MM` query params.
- Global state managed in `DataContext.jsx` (kpis, selectedMonths, groupBy, squadMap, refetchAll).

### Skye Exclusion
- All MVs (resource_summary, kpis_monthly, client_hours, dept_hours) have WHERE clauses excluding Skye projects.
- All raw timelog_raw queries use `SKYE_EXCLUSION` constant from `shared.js`.
- UI shows info badge: "Excluding Skye projects from all reports".

---

## 4. Database Schema

### Tables
- `uploads` — audit log of every uploaded file (timelog, attendance, demand_capacity)
- `timelog_raw` — one row per Zoho time entry
- `attendance` — one row per employee per day (attendance status)
- `demand_capacity` — one row per employee (squad/project mapping from Demand Capacity Excel)

### Materialized Views (UNIQUE indexes for `CONCURRENTLY` refresh)
| View | Content |
|---|---|
| `mv_resource_summary` | Per-employee monthly KPIs (hours, billability) — excludes Skye |
| `mv_kpis_monthly` | Global aggregates per month — excludes Skye |
| `mv_client_hours` | Hours per client per month — excludes Skye |
| `mv_dept_hours` | Hours per department per month — excludes Skye |
| `mv_attendance_summary` | Present/absent/leave day counts |
| `mv_squad_summary` | Squad allocation summary by location |

---

## 5. Frontend Structure

```
client/src/
├── App.jsx                  # Shell: sidebar + top nav + Dept/Squad toggle + tab routing
├── index.css                # Tailwind v4 @theme (40+ color tokens)
├── main.jsx
├── context/DataContext.jsx  # Global state: months, KPIs, groupBy, squadMap, refresh
├── hooks/useApi.js
├── components/
│   ├── KpiCard.jsx          # Metric tile with icon, value, trend
│   ├── ChartCard.jsx        # Chart wrapper with title/subtitle
│   ├── DataTable.jsx        # Paginated table with custom renderers
│   ├── MonthPicker.jsx      # Multi-month selector
│   └── UploadZone.jsx       # Drag-and-drop uploader
├── charts/chart-config.js   # Chart.js defaults + Light Theme colors
└── pages/
    ├── Overview.jsx         # Portfolio: Executive Summary + Designation chart + Approval %
    ├── Resources.jsx        # Squad allocation + Billable/Location + Heatmap roster
    ├── Utilization.jsx      # Workload Intensity & Allocation (4 sub-tabs)
    ├── Analytics.jsx        # 11 deep analytics sub-sections
    └── Timesheet.jsx        # Attendance Grid + Compliance Report + Upload zones
```

### Application Shell (`App.jsx`)
- **Left sidebar** (collapsible): logo, 8 nav items (Portfolio, Resources, Utilization, Analytics, Timesheet + 3 coming soon)
- **Top nav bar**: search input, MonthPicker, **Department/Squad toggle**, notifications, settings, profile avatar
- **Content area**: `p-8 space-y-8 max-w-[1600px] mx-auto` wrapper

### Global State (`DataContext.jsx`)
- `availableMonths` / `selectedMonths` — month filter
- `kpis` — aggregate KPI values
- `groupBy` — `'dept'` or `'squad'` (global toggle)
- `squadMap` — employee_id to squad (project) mapping from demand_capacity
- `refetchAll()` — full refresh trigger

---

## 6. Pages & Features

### Portfolio (formerly Overview)
- 6 KPI cards: Total Hours, Billable Hours, Active Projects, Attendance Pulse, Headcount, **Approval %** (color-coded)
- **Designation-wise Resource Count** horizontal bar chart (replaces Client Allocation)
- Timesheet Approvals doughnut
- Top Resource Insights table
- Approval Breakdown progress bars
- **Pending Actions** with real data breakdown (pending/not submitted/draft hours)
- PMO Alert Feed (dismissible)
- Info badge: "Excluding Skye projects from all reports"

### Resources
- 2 KPI cards: Tracked Headcount, Avg Billability (Leading Department removed)
- **Squad Allocation** stacked bar chart (Billable vs Non-Billable per squad/project)
- **Billable vs Non-Billable by Location** stacked horizontal bar chart
- **Squad filter** dropdown (Everest, Rebranding, Mejoras, etc.) + Name search + Location filter
- **Multi-Month Roster** with heatmap coloring (5-tier: blue→orange→red) + CSV export
- Column switches between Department/Squad based on global toggle

### Utilization (4 sub-tabs)
- **Daily Effort**: Stacked bar (billable + non-billable per day) + raw timelog table
- **Compliance Funnel**: Horizontal stacked bar + compliance rate line chart + summary cards
- **Dept Heatmap**: Department x Month grid with utilization % color coding
- **Attendance Trend**: Multi-line chart (top 8 depts) + department summary table

### Timesheet (3 sub-tabs)
- **Attendance Grid**: Full employee x day grid with color-coded cells (P=blue, A=red, W=gray, H=purple, etc.), legend, Department/Squad grouping, filters, summary columns (P/A/LV)
- **Submission Compliance**: Monthly aggregate table + **Per-Employee Missed Timesheet Report** (working days, days logged, missed days, compliance % with color coding)
- **Data Upload**: 3 upload zones (Timelog, Attendance, Demand Capacity) + active version display

### Analytics (11 sub-sections)
Entity Billing, Employee Trend, Non-Billable Analysis, Productivity Index, Dept Ranking, Manager Scorecard, Leave Calendar, Location Utilization, Capacity Forecast, Burnout Risk, Leave Patterns.

---

## 7. Backend Route Files

| File | Endpoints |
|---|---|
| `routes/upload.js` | POST timelog, attendance, demand-capacity; GET history; POST restore |
| `routes/months.js` | GET available months, uploads audit, active versions |
| `routes/kpis.js` | GET aggregated KPIs (with Skye exclusion) |
| `routes/resources.js` | GET per-employee summary |
| `routes/timelog.js` | GET paginated raw timelog (with Skye exclusion) |
| `routes/attendance.js` | GET attendance matrix (employee x day pivot) |
| `routes/heatmap.js` | GET daily billable vs non-billable (with Skye exclusion) |
| `routes/charts.js` | GET daily, clients, departments, approval, locations, top-resources |
| `routes/analytics.js` | 17 endpoints: kpi-trends, compliance, timesheet-compliance, dept-heatmap, attendance-trend, resource-roster, entity-billing, employee-trend, alerts, manager-scorecard, non-billable, productivity-index, dept-ranking, leave-calendar, location-utilization, burnout-risk, leave-forecast |
| `routes/squads.js` | GET summary, list, designations, billable-by-location, allocation, employee-mapping |
| `routes/shared.js` | Month parsing middleware + SKYE_EXCLUSION constant |

---

## 8. ETL Parsers

| Parser | Input | Output |
|---|---|---|
| `parse-timelog.js` | Zoho Time Log Excel | `{ rows, yearMonth }` |
| `parse-attendance.js` | Zoho Muster Roll Excel | `{ rows, yearMonth }` |
| `parse-demand-capacity.js` | Demand Capacity Excel | Array of employee objects with squad = Project column |
| `entity-location.js` | Entity string | Location label (KFT→Budapest, AG→Zurich, etc.) |

---

## 9. Known Bugs Fixed

| Bug | Root Cause | Fix Applied |
|---|---|---|
| DB deadlock on upload | `REFRESH MATERIALIZED VIEW CONCURRENTLY` inside transaction | Refresh moved to AFTER COMMIT using pool.query |
| Utilization tab crash | useMemo hooks after early return (Rules of Hooks violation) | All hooks moved before conditional returns |
| Resources tab crash | Same Rules of Hooks violation | All hooks moved before conditional returns |
| Timesheet key warning | React Fragment without key in map | Added React.Fragment with key |
| `ECONNABORTED` upload | Explicit Content-Type header corrupted multipart boundary | Header omitted — fetch sets it automatically |

---

## 10. Completed Phases

| Phase | Status | Description |
|---|---|---|
| 1-10 | Done | Scaffolding, ETL, API, Components, All 5 tabs, Placeholders |
| 11 | Done | Production build configuration |
| 12 | Done | Post-launch bug fixes |
| 13/13.1 | Done | Full Light Theme redesign |
| Sprint | Done | 12 enhancements: Designation chart, Approval %, Skye exclusion, Pending Actions fix, Leading Dept removal, Billable/Location chart, Squad allocation, Roster heatmap, Squad filter, Utilization fix, Attendance grid, Timesheet compliance |
| Sprint+ | Done | Tab rename (Overview→Portfolio), Squad=Project mapping, Dept/Squad toggle, demand_capacity table + upload |

---

## 11. Running the Application

```bash
# Prerequisites: Node.js 22+, PostgreSQL 18 (port 5433)

# Install
npm install && cd client && npm install && cd ..

# Migrate DB
DATABASE_URL=postgresql://tinubu:tinubu_secret@localhost:5433/tinubu_pmo node server/migrate.js

# Development (frontend :5173 + backend :3004 concurrently)
DATABASE_URL=postgresql://tinubu:tinubu_secret@localhost:5433/tinubu_pmo PORT=3004 npx concurrently "node server/index.js" "cd client && npx vite --host"

# Production
cd client && npx vite build
NODE_ENV=production DATABASE_URL=... PORT=3004 node server/index.js
```

---

## 12. Next Steps for the Next Agent

1. **Uploading Data**: Timesheet tab → Data Upload → upload Timelog, Attendance, and Demand Capacity files.
2. **Phase 4 (parked)**: See `Phase4_Enhancement_Plan.md` — JWT auth, dark mode, global search, caching, CI/CD.
3. **Finance tab**: Revenue tracking, budget vs actuals per project, SOW tracking.
4. **Reports tab**: Exportable reports, scheduled email digests.
5. **Reference `product-technical-document.md`** for full API reference and DB schema.
