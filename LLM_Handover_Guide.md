# Tinubu PMO Dashboard — LLM Handover Guide

This document gives the next LLM or agent a fast, accurate summary of the current project state so they can instantly continue where we left off.

**Last Updated:** March 2026 — Phase 13.1 (Precision Redesign) complete.

---

## 1. Project Overview

- **Name**: Tinubu PMO Dashboard
- **Goal**: Ingest monthly `.xlsx` exports from Zoho (company time-tracking system) and display KPIs, resource metrics, and utilization insights in an interactive React dashboard.
- **Key Feature**: Multi-month data aggregation — users select one or more months; all charts and tables react instantly via PostgreSQL materialized views.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 8 + **Tailwind CSS v4** (CSS-first `@theme` API) |
| Styling | Light Theme "Command Center" — 40+ M3 color tokens from `design.txt` |
| Icons | Google Material Symbols Outlined (CDN via `index.html`) |
| Font | Google Inter (weights 300-800, CDN via `index.html`) |
| Charts | Chart.js 4 + react-chartjs-2 |
| Backend | Express 4.21 on Node.js 22, port `3001` |
| Database | PostgreSQL 16 (Docker) via `pg` (node-postgres) |
| File Parsing | SheetJS (`xlsx`) on the Node.js backend |
| File Upload | `multer` (multipart/form-data) |
| Dev Runner | `concurrently` — runs server + client together via `npm run dev` |

---

## 3. Architecture & Data Flow

### Upload (Write Path)
1. User drags `.xlsx` onto an `UploadZone` on the **Timesheet** tab.
2. React POSTs `multipart/form-data` to `/api/upload/timelog` or `/api/upload/attendance`.
3. Express + Multer handles the file; the ETL parser (SheetJS) normalizes rows.
4. A **shared transaction client** DELETEs existing rows for the extracted `year_month`, batch-INSERTs new rows (500 rows per statement), and COMMITs.
5. `SELECT refresh_all_views()` refreshes all 5 materialized views `CONCURRENTLY` (outside the transaction).

> ⚠️ **Critical**: The `Content-Type` header must be **omitted** from the fetch call when uploading files — let the browser set the multipart boundary automatically. Setting it explicitly causes `ECONNABORTED`.

### Query (Read Path)
- All dashboard queries hit **materialized views only** — never raw tables.
- Month filter expressed as `?months=YYYY-MM,YYYY-MM` query params.
- Global state managed in `DataContext.jsx` (kpis, selectedMonths, refetchAll).

---

## 4. Database Schema

### Tables
- `uploads` — audit log of every uploaded file
- `timelog_raw` — one row per Zoho time entry
- `attendance` — one row per employee per day (attendance status)

### Materialized Views (UNIQUE indexes for `CONCURRENTLY` refresh)
| View | Content |
|---|---|
| `mv_resource_summary` | Per-employee monthly KPIs (hours, billability) |
| `mv_kpis_monthly` | Global aggregates per month |
| `mv_client_hours` | Hours per client per month |
| `mv_dept_hours` | Hours per department per month |
| `mv_attendance_summary` | Present/absent/leave day counts |

---

## 5. Frontend Structure

```
client/src/
├── App.jsx                  # Shell: left sidebar + top nav + tab routing
├── index.css                # Tailwind v4 @theme (40+ color tokens)
├── main.jsx
├── context/DataContext.jsx  # Global state
├── hooks/useApi.js
├── components/
│   ├── KpiCard.jsx          # Metric tile with icon, value, trend
│   ├── ChartCard.jsx        # Chart wrapper with title/subtitle
│   ├── DataTable.jsx        # Paginated table with custom renderers
│   ├── MonthPicker.jsx      # Multi-month selector
│   └── UploadZone.jsx       # Drag-and-drop uploader
├── charts/chart-config.js   # Chart.js defaults + Light Theme colors
└── pages/
    ├── Overview.jsx         # Executive Summary
    ├── Resources.jsx        # Resource Intelligence
    ├── Utilization.jsx      # Workload Intensity & Allocation
    └── Timesheet.jsx        # Data Management Hub
```

### Application Shell (`App.jsx`)
- **Left sidebar** (fixed, 256px): logo, 8 nav items, "New Project" button, Help/Logout footer
- **Top nav bar**: search input, MonthPicker, notifications (with unread dot), settings, profile avatar
- **Content area**: `p-8 space-y-8 max-w-[1600px] mx-auto` wrapper inside a scrollable `main`

### Design System
Defined in `client/src/index.css` via Tailwind v4 `@theme`. Follows `design.txt` Light Theme "Command Center" (M3-style tokens):

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#004ac6` | Buttons, active nav, links |
| `--color-surface` | `#f7f9fb` | Page background |
| `--color-surface-container-lowest` | `#ffffff` | KPI cards, tables |
| `--color-surface-container-low` | `#f2f4f6` | Chart containers |
| `--color-on-surface` | `#191c1e` | Body text |
| `--color-on-surface-variant` | `#434655` | Subtitles, muted text |
| `--color-outline-variant` | `#c3c6d7` | Borders, dividers |
| `--color-error` | `#ba1a1a` | Error states, absent counts |

---

## 6. Pages & Features

### Overview (Executive Summary)
- 4 KPI cards: Total Hours, Billable Hours, Active Projects, Attendance Pulse
- Client Allocation bar chart + Timesheet Approvals doughnut
- "Top Resource Insights" table (top 3 clients, efficiency bars, hours)
- "Approval Breakdown" progress bars (Approved / Pending / Not Submitted %)
- "Pending Actions" card with pending timesheet count

### Resources (Resource Intelligence)
- Breadcrumb: `CORE PLATFORM > RESOURCE MANAGEMENT`
- `text-3xl` title + "Advanced Filters" + "Export Report" action buttons
- 3 KPI cards: Tracked Headcount, Avg Billability %, Leading Department
- Department bar chart + Global Locations doughnut
- Personnel DirectoryTable with avatar initials, Name/Designation, Dept, Location, Efficiency bar, Hours
- **Runtime filters** on Name, Department, and Location columns

### Utilization (Workload Intensity & Allocation)
- Page title + subtitle matching `design.txt`
- Daily Effort Distribution stacked bar chart (Billable vs. Non-Billable per day)
- Raw timelog DataTable with utilization badge renderers (Overtime / Full / Partial / On Bench)

### Timesheet (Data Management Hub)
- Breadcrumb: `DATA OPERATIONS > IMPORT & UPLOAD`
- Dual `UploadZone` components: Zoho Time Log (left) + Zoho Attendance (right)
- Attendance muster roll DataTable below

### Placeholder Tabs (Coming Soon)
Portfolio, Finance, SOW, AMM — all show a styled "Coming Soon" card.

---

## 7. Known Bugs Fixed (Critical for Future Agents)

| Bug | Root Cause | Fix Applied |
|---|---|---|
| DB deadlock on upload | `REFRESH MATERIALIZED VIEW CONCURRENTLY` cannot run inside a `BEGIN…COMMIT` block | INSERT inside transaction; refresh called separately after COMMIT |
| `ECONNABORTED` upload | Explicit `Content-Type: undefined` in fetch corrupted multipart boundary | Strip header entirely — `fetch` sets it automatically |
| React "Objects are not valid as children" | `/api/timelog` returns `{ data: [], total }` object, not array | Unwrap: use `logsData?.data ?? []` before passing to DataTable |

---

## 8. Completed Phases

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ | Scaffolding — Express, PostgreSQL, React shell |
| 2 | ✅ | ETL parsers |
| 3 | ✅ | Upload API endpoints |
| 4 | ✅ | All GET query endpoints |
| 5 | ✅ | Shared React components |
| 6 | ✅ | Overview tab |
| 7 | ✅ | Resources tab |
| 8 | ✅ | Utilization tab |
| 9 | ✅ | Timesheet tab |
| 10 | ✅ | Placeholder tabs + polish |
| 11 | ✅ | Production build configuration |
| 12 | ✅ | Post-launch bug fixes (deadlock, ECONNABORTED, pagination) |
| 13 | ✅ | Full Light Theme redesign (sidebar, color palette, components) |
| 13.1 | ✅ | Precision redesign matching `design.txt` exactly |

---

## 9. Running the Application

```bash
# Start PostgreSQL (Docker)
docker compose up -d

# Development (frontend :5173 + backend :3001 concurrently)
npm run dev

# Production
npm run build && npm start   # All served from http://localhost:3001
```

---

## 10. Next Steps for the Next Agent

1. **Visual audit**: Compare each tab against `design.txt` prototypes at `http://localhost:5173`.
2. **Portfolio tab**: Build using existing `KpiCard`, `ChartCard`, `DataTable` patterns. Add new Express routes in `server/routes/`.
3. **Finance tab**: Revenue tracking, budget utilization per project.
4. **Authentication**: Add JWT middleware to Express + login page in React before any public deployment.
5. **Reference `design.txt`** for all future UI decisions — it is the single source of truth.
6. **Reference `product-technical-document.md`** for the full API reference, DB schema, and deployment guide.
