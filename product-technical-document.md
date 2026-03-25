# Tinubu PMO Dashboard — Product Technical Document

**Version:** 3.0
**Date:** March 2026
**Classification:** Internal — Engineering

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture & Data Flow](#4-system-architecture--data-flow)
5. [Database Design](#5-database-design)
6. [Backend API Reference](#6-backend-api-reference)
7. [Frontend Architecture](#7-frontend-architecture)
8. [ETL Pipeline](#8-etl-pipeline)
9. [Feature Inventory](#9-feature-inventory)
10. [Authentication & Security](#10-authentication--security)
11. [Deployment & Infrastructure](#11-deployment--infrastructure)
12. [Running the Application](#12-running-the-application)
13. [Known Limitations & Future Roadmap](#13-known-limitations--future-roadmap)

---

## 1. Product Overview

The **Tinubu PMO Dashboard** is an internal analytics and reporting command center for the Project Management Office (PMO). It ingests monthly Excel exports from Zoho (the company's time-tracking and HR system) and renders real-time KPIs, resource utilization metrics, attendance intelligence, and predictive analytics in an interactive web UI.

### Organisation Profile (from data)

| Dimension | Count |
|---|---|
| Legal Entities | 6 (AG Switzerland, Kft Hungary, Inc Americas, India Inc, Limited HK, SL Spain) |
| Office Locations | 9 (Zurich, Budapest, Princeton, Valencia, Bangalore, Morocco, Bulgaria, Hong Kong) |
| Business Units | 17 |
| Departments | 31 |
| Total Employees (attendance) | 113 |
| Time-Logging Employees | 84 |
| Reporting Managers | 23 |

### Core Capabilities (v3.0 — 30 features across 3 phases + Sprint enhancements)

| Category | Features |
|---|---|
| **Data Ingestion** | Drag-drop Excel upload (Timelog, Attendance, Demand Capacity), ETL parsing, upload versioning with audit trail |
| **Portfolio (formerly Overview)** | Temporal KPI cards with MoM trends + sparklines, Approval % KPI, Designation-wise resource count bar chart, PMO alert feed, Pending Actions with real data breakdown |
| **Resource Intelligence** | Squad allocation chart, Billable/Non-Billable by location bar chart, Multi-month roster with heatmap coloring, Squad filter, CSV export |
| **Utilization Analytics** | Daily effort chart, compliance funnel, department heatmap (cross-month), attendance rate trend |
| **Timesheet & Attendance** | Full attendance grid (employee x day) with color-coded status cells, Department/Squad grouping, Submission compliance report (per-employee missed days tracker) |
| **Deep Analytics** | Entity billing, non-billable analysis, productivity index, dept ranking, manager scorecard, leave calendar heatmap, location comparison, capacity forecast |
| **Predictive** | Burnout risk early warning (consecutive month detection), leave seasonality patterns |
| **Data Quality** | Skye project exclusion (global), Department/Squad toggle (global) |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT                        │
│  React 19 SPA (Vite 8) + Tailwind CSS v4 + Chart.js        │
│  5 active pages + Analytics tab with 11 sub-sections        │
│  Running on http://localhost:5173 (dev)                     │
└────────────────────────┬────────────────────────────────────┘
                         │  HTTP / REST  (proxied via /api)
┌────────────────────────▼────────────────────────────────────┐
│                       EXPRESS SERVER                         │
│  Node.js v22 · configurable port (default 3004)            │
│  11 route modules · 35+ API endpoints                       │
│  Middleware: multer · cors · error-handler · shared (months)│
└────────────────────────┬────────────────────────────────────┘
                         │  pg (node-postgres)
┌────────────────────────▼────────────────────────────────────┐
│                     POSTGRESQL 18                            │
│  Local install on port 5433                                 │
│  Tables: uploads · timelog_raw · attendance · demand_capacity│
│  Materialized Views: 6 MVs refreshed per upload             │
│  Upload Versioning: version, is_active, uploaded_by columns │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Backend

| Component | Technology | Version |
|---|---|---|
| Runtime | Node.js | 22.x |
| Web Framework | Express | 4.21.x |
| Database Driver | pg (node-postgres) | 8.13.x |
| File Upload | Multer | 1.4.x |
| Excel Parsing | SheetJS (xlsx) | 0.18.x |
| Env Config | dotenv | 16.x |

### Frontend

| Component | Technology | Version |
|---|---|---|
| Build Tool | Vite | 8.x |
| UI Library | React | 19.x |
| Styling | Tailwind CSS | v4 (CSS-first via `@theme`) |
| Charts | Chart.js + react-chartjs-2 | 4.x |
| Icons | Google Material Symbols Outlined | CDN |
| Font | Google Inter | CDN |

### Infrastructure

| Component | Technology |
|---|---|
| Database | PostgreSQL 18 (local, port 5433) |
| Container | Docker / docker-compose (for DB) |
| Version Control | Git + GitHub |

---

## 4. System Architecture & Data Flow

### Upload Flow (Write Path)

```
User selects .xlsx file
       │
       ▼
UploadZone.jsx (React)
  FormData POST → /api/upload/timelog  or  /api/upload/attendance
       │
       ▼
routes/upload.js (Express + Multer)
  1. Insert audit record (status='processing')
  2. ETL parse via parse-timelog.js or parse-attendance.js
  3. Compute next upload version
  4. Deactivate previous uploads for same period
  5. BEGIN transaction
     - DELETE existing rows for year_month
     - Batch-insert new rows (500 per INSERT)
     - UPDATE audit record (status='success', version=N)
  6. COMMIT
  7. Refresh all 5 materialized views
       │
       ▼
Response: { success, uploadId, yearMonth, rowCount, version, durationMs }
       │
       ▼
UploadZone shows success → calls refetchAll() → all pages re-render
```

### Query Flow (Read Path)

```
User changes month selection in MonthPicker
       │
       ▼
DataContext.jsx updates selectedMonths → triggers useEffect in all pages
       │
       ▼
Each page calls its endpoints via useApi with ?months=YYYY-MM,YYYY-MM
       │
       ▼
Express routes → shared.js parses months → queries materialized views
       │
       ▼
JSON response → React state update → charts/tables/cards re-render
```

---

## 5. Database Design

### Tables

#### `uploads` (with versioning)

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Auto-increment |
| `upload_id` | TEXT UNIQUE | Prefixed UUID (tl_ or att_) |
| `file_type` | TEXT | `timelog` or `attendance` |
| `file_name` | TEXT | Original filename |
| `file_size_bytes` | INTEGER | File size |
| `year_month` | TEXT | Period e.g. `2026-03` |
| `row_count` | INTEGER | Rows successfully parsed |
| `status` | TEXT | `processing`, `success`, `failed` |
| `error_message` | TEXT | Error detail if failed |
| `version` | INTEGER | Upload version (1, 2, 3...) |
| `is_active` | BOOLEAN | Whether this is the current active version |
| `uploaded_by` | TEXT | User who uploaded (default: 'system') |
| `created_at` | TIMESTAMPTZ | Upload timestamp |

#### `timelog_raw` (21 columns)

One row per time entry from Zoho Time Log export.

| Column | Type | Description |
|---|---|---|
| `upload_id` | TEXT FK | References uploads.upload_id |
| `year_month` | TEXT | Period key |
| `date` | DATE | Work date |
| `hours` | NUMERIC(6,1) | Hours logged |
| `entity` | TEXT | Legal entity |
| `business_unit` | TEXT | Business unit |
| `department` | TEXT | Department |
| `designation` | TEXT | Job title |
| `employee_id` | TEXT | Zoho employee ID |
| `full_name` | TEXT | Full name |
| `last_name` / `first_name` | TEXT | Name parts |
| `client_name` | TEXT | Billing client |
| `project_name` | TEXT | Project name |
| `approval_status` | TEXT | Approved / Pending / Draft / Not Submitted |
| `billable_status` | TEXT | Billable / Non-Billable |
| `task_name` | TEXT | Task description |
| `task_code` | TEXT | Task code |
| `jira_no` | TEXT | JIRA reference |
| `contractor_company` | TEXT | Contractor company |
| `comment` | TEXT | Entry comment |

**Indexes:** `year_month`, `employee_id`, `client_name`, `upload_id`, `date`

#### `attendance` (13 columns)

One row per employee per day from Zoho Muster Roll export.

| Column | Type | Description |
|---|---|---|
| `upload_id` | TEXT FK | References uploads.upload_id |
| `year_month` | TEXT | Period key |
| `date` | DATE | Calendar date |
| `employee_id` | TEXT | Zoho employee ID |
| `employee_name` | TEXT | Full name |
| `email` | TEXT | Employee email |
| `entity` | TEXT | Legal entity |
| `business_unit` | TEXT | Business unit |
| `department` | TEXT | Department |
| `designation` | TEXT | Job title |
| `location` | TEXT | Office location |
| `status` | TEXT | P, A, W, H, PDA, VE, VEL, SLE, etc. |

**Unique constraint:** `(year_month, date, employee_id)`
**Indexes:** `year_month`, `employee_id`, `upload_id`

#### `demand_capacity` (9 columns)

Squad allocation data from Demand Capacity Excel. One row per employee.

| Column | Type | Description |
|---|---|---|
| `employee_id` | TEXT UNIQUE | Zoho employee ID |
| `resource_name` | TEXT | Full name |
| `designation_name` | TEXT | Job title/designation |
| `client` | TEXT | Assigned client |
| `project` | TEXT | **Squad identifier** (Everest, Rebranding, Mejoras, etc.) |
| `billable_status` | TEXT | Billable / Investment / Loaned |
| `du_number` | TEXT | Delivery Unit (DU1, DU3, SolEng) |
| `comment` | TEXT | Additional notes |
| `location` | TEXT | India, Hungary, HongKong, Spain |

**Indexes:** `du_number`, `location`, `designation_name`

### Materialized Views

| View | Purpose | Key Columns |
|---|---|---|
| `mv_resource_summary` | Per-employee monthly metrics | employee_id, year_month, total_hours, billable_hours, unique_clients, unique_projects |
| `mv_kpis_monthly` | Global monthly KPIs | year_month, total_hours, billable_hours, non_billable_hours, unique_employees/clients/projects |
| `mv_client_hours` | Per-client monthly hours | year_month, client_name, total_hours, billable_hours, headcount, project_count |
| `mv_dept_hours` | Per-department monthly hours | year_month, department, total_hours, billable_hours, headcount |
| `mv_attendance_summary` | Per-employee monthly attendance | year_month, employee_id, present_days, absent_days, weekend_days, holiday_days, leave_days |
| `mv_squad_summary` | Squad allocation summary | squad, location, total_resources, billable_count, non_billable_count, designations |

All views are refreshed via `SELECT refresh_all_views()` after each successful upload.

**Skye Project Exclusion:** MVs `mv_resource_summary`, `mv_kpis_monthly`, `mv_client_hours`, and `mv_dept_hours` include a WHERE clause excluding rows where `project_name` or `client_name` contains "Skye" (case-insensitive). This is also applied to all raw `timelog_raw` queries via the `SKYE_EXCLUSION` constant in `shared.js`.

---

## 6. Backend API Reference

**Base URL:** `http://localhost:{PORT}/api`

### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `GET` | `/months` | Available year_month periods |
| `GET` | `/months/uploads` | Upload audit trail (last 100) |
| `GET` | `/months/active-versions` | Currently active upload per period/type |

### Upload Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload/timelog` | Upload Zoho Time Log Excel |
| `POST` | `/upload/attendance` | Upload Zoho Attendance Excel |
| `POST` | `/upload/demand-capacity` | Upload Demand Capacity Excel (squad mapping) |
| `GET` | `/upload/history` | Version history for uploads |
| `POST` | `/upload/:uploadId/restore` | Restore a previous upload version (audit only) |

### Data Query Endpoints

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `GET` | `/kpis` | `?months=` | Aggregated KPIs |
| `GET` | `/resources` | `?months=` | Per-employee summary |
| `GET` | `/timelog` | `?months=&page=&pageSize=&search=&client=` | Paginated raw timelog |
| `GET` | `/attendance` | `?months=` | Attendance matrix |
| `GET` | `/heatmap` | `?months=` | Daily billable vs non-billable |

### Chart Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/charts/daily` | Daily hours |
| `GET` | `/charts/clients` | Top clients by hours |
| `GET` | `/charts/departments` | Top departments |
| `GET` | `/charts/approval` | Approval status breakdown |
| `GET` | `/charts/locations` | Resources by location |
| `GET` | `/charts/top-resources` | Top N employees by hours |

### Analytics Endpoints (Phase 1-3)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/analytics/kpi-trends` | Per-month KPIs for temporal cards |
| `GET` | `/analytics/compliance` | Compliance funnel per month |
| `GET` | `/analytics/dept-heatmap` | Department utilization per month |
| `GET` | `/analytics/attendance-trend` | Attendance rate by department |
| `GET` | `/analytics/resource-roster` | Per-employee per-month hours |
| `GET` | `/analytics/entity-billing` | Entity-level billing performance |
| `GET` | `/analytics/employee-trend` | Employee monthly hours trend |
| `GET` | `/analytics/alerts` | PMO alert conditions |
| `GET` | `/analytics/manager-scorecard` | Department attendance scorecard |
| `GET` | `/analytics/non-billable` | Non-billable breakdown |
| `GET` | `/analytics/productivity-index` | Hours per present day |
| `GET` | `/analytics/dept-ranking` | Department ranking by metric |
| `GET` | `/analytics/leave-calendar` | Daily leave data for calendar |
| `GET` | `/analytics/location-utilization` | Location-level comparison |
| `GET` | `/analytics/burnout-risk` | Burnout risk detection |
| `GET` | `/analytics/leave-forecast` | Leave seasonality patterns |
| `GET` | `/analytics/timesheet-compliance` | Per-employee missed timesheet days |

### Squad Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/squads` | Squad summary by location |
| `GET` | `/squads/list` | Distinct squad (project) names |
| `GET` | `/squads/designations` | Designation-wise resource count |
| `GET` | `/squads/billable-by-location` | Billable vs non-billable by location |
| `GET` | `/squads/allocation` | Squad allocation with hours (month-filtered) |
| `GET` | `/squads/employee-mapping` | Employee ID to squad mapping |

---

## 7. Frontend Architecture

### Directory Structure

```
client/src/
├── App.jsx                  # Root shell: sidebar + top nav + tab routing
├── index.css                # Tailwind v4 @theme tokens (40+ color vars)
├── main.jsx                 # React entry point + DataProvider
├── context/
│   └── DataContext.jsx      # Global state: months, KPIs, refresh
├── hooks/
│   └── useApi.js            # Fetch wrapper with loading/error
├── components/
│   ├── KpiCard.jsx          # Simple metric tile
│   ├── ChartCard.jsx        # Chart container with title
│   ├── DataTable.jsx        # Sortable table with custom renderers
│   ├── MonthPicker.jsx      # Month filter UI
│   ├── UploadZone.jsx       # Drag-drop file uploader
│   └── Placeholder.jsx      # Coming Soon card
├── charts/
│   └── chart-config.js      # Chart.js registration, palette, defaults
└── pages/
    ├── Overview.jsx          # Portfolio: Executive Summary + Designation chart + Approval % + PMO Alerts
    ├── Resources.jsx         # Squad allocation + Billable/Location + Heatmap roster + Squad filter
    ├── Utilization.jsx       # Daily effort, compliance, dept heatmap, attendance
    ├── Analytics.jsx         # 11 sub-sections (entity, employee, non-billable, etc.)
    └── Timesheet.jsx         # Attendance Grid + Submission Compliance + Upload zones
```

### Active Tabs

| Tab | Page Component | Sub-sections |
|---|---|---|
| Portfolio | Overview.jsx | Alert feed, 6 temporal KPI cards (incl. Approval %), Designation-wise bar chart, approval doughnut, top resources, pending actions with real data |
| Resources | Resources.jsx | Squad allocation chart, Billable/Non-Billable by location, Squad filter, heatmap roster with CSV export |
| Utilization | Utilization.jsx | Daily Effort, Compliance Funnel, Dept Heatmap, Attendance Trend |
| Analytics | Analytics.jsx | Entity Billing, Employee Trend, Non-Billable, Productivity, Dept Ranking, Manager Score, Leave Calendar, Locations, Forecast, Burnout Risk, Leave Patterns |
| Timesheet | Timesheet.jsx | Attendance Grid (employee x day, color-coded), Submission Compliance (per-employee missed days), Upload zones (timelog + attendance + demand capacity) |
| Reports | Placeholder | Coming Soon |
| Finance | Placeholder | Coming Soon |
| AMM | Placeholder | Coming Soon |

### State Management

Global state via `DataContext`:
- `availableMonths` — all periods in DB
- `selectedMonths` — user-selected filter
- `kpis` — aggregate KPI values for selected months
- `loadingInitial` / `isRefreshing` — loading states
- `refetchAll()` — full refresh trigger (called after uploads)
- `groupBy` — `'dept'` or `'squad'` — global toggle for Department vs Squad view
- `squadMap` — employee_id to squad (project) mapping from demand_capacity

Each page manages its own local state and fetches data independently.

---

## 8. ETL Pipeline

### `parse-timelog.js`

- Reads first worksheet via SheetJS
- Maps column names with fallback alternatives (e.g., `['Date of Date', 'Date']`)
- Skips rows missing employee_id or date
- Determines dominant `year_month` from majority of dates
- Returns `{ rows: [{...}], yearMonth: 'YYYY-MM' }`

### `parse-attendance.js`

- Reads raw 2D array from worksheet
- Scans rows 0-19 for date header row (regex: `\d{1,2}\s*[-–]\s*[A-Za-z]{3}`)
- Finds employee data rows by `'employee id'` header
- Date columns start from index 10 (hardcoded)
- Only imports rows where `employeeId.startsWith('INN-')` (hardcoded filter)
- Unpivots wide format to one row per employee per date

### `parse-demand-capacity.js`

- Reads first worksheet via SheetJS
- Maps columns: Employee ID, Resource name, Designation Name, Client, Project, Billable / Investment, DU#, Comment, Location
- Normalizes billable status (maps 'DU1', 'DU3', 'SHS Team', 'NA' to 'Investment')
- Returns array of employee objects with squad = Project column

### `entity-location.js`

- Maps entity strings to location labels via string-contains logic
- 7 patterns: KFT→Budapest, AG→Zurich, India→Bangalore, Limited→Hong Kong, SL→Valencia, Partners→Morocco, Inc→Princeton

---

## 9. Feature Inventory

### Phase 1 — Foundation (6 features)

| Feature | Backend | Frontend |
|---|---|---|
| Upload Versioning | version/is_active/uploaded_by columns, history endpoint | Version badges in Timesheet |
| Temporal KPI Cards | `/analytics/kpi-trends` | MoM trend badges + SVG sparklines on Overview |
| Multi-Month Roster | `/analytics/resource-roster` | Per-month columns, sticky headers, color-coded cells, CSV export |
| Compliance Funnel | `/analytics/compliance` | Stacked bar + compliance rate line chart |
| Dept Utilization Heatmap | `/analytics/dept-heatmap` | Color-coded grid with company average footer |
| Attendance Rate Trend | `/analytics/attendance-trend` | Multi-line chart + department summary table |

### Phase 2 — Deep Analytics (9 features)

| Feature | Backend | Frontend |
|---|---|---|
| Entity Billing | `/analytics/entity-billing` | Grouped bar, KPI cards, detail table |
| Employee Utilization Trend | `/analytics/employee-trend` | Monthly grid, avg hours, At Risk/High/Healthy/Bench badges |
| PMO Alert Feed | `/analytics/alerts` | Dismissable alert strip on Overview (overload/bench/spike/missing) |
| Manager Scorecard | `/analytics/manager-scorecard` | Department attendance ranking table |
| Non-Billable Analysis | `/analytics/non-billable` | Doughnut by task type, department bars |
| Productivity Index | `/analytics/productivity-index` | Line chart vs 7.5h/day target |
| Dept Racing Chart | `/analytics/dept-ranking` | Horizontal bar with metric toggle |
| Leave Calendar | `/analytics/leave-calendar` | GitHub-style monthly grid with dept filter |
| Location Utilization | `/analytics/location-utilization` | Multi-bar by geography + detail table |

### Phase 3 — Predictive (2 features)

| Feature | Backend | Frontend |
|---|---|---|
| Burnout Risk | `/analytics/burnout-risk` | 4-tier risk register (critical/high/elevated/watch) with trend bars |
| Leave Forecast | `/analytics/leave-forecast` | Day-of-week patterns, week-of-month, monthly trend, top leave takers |

### Sprint Enhancements (12 features)

| Feature | Backend | Frontend |
|---|---|---|
| Designation Bar Chart | `/squads/designations` | Horizontal bar chart on Portfolio tab replacing Client Allocation |
| Approval % KPI | Computed from `/charts/approval` | Always-visible KPI card with color-coded % and progress bar |
| Skye Exclusion | WHERE clauses in all MVs + raw queries | Info badge on Portfolio: "Excluding Skye projects" |
| Pending Actions Fix | Approval status breakdown | Real data: pending hours, not submitted hours, draft hours |
| Remove Leading Department | N/A | KPI card removed from Resources |
| Billable/Non-Billable by Location | `/squads/billable-by-location` | Stacked horizontal bar chart on Resources |
| Squad Allocation | `/squads/allocation` | Stacked bar chart replacing Department Allocation |
| Roster Heatmap | N/A | 5-tier color scale (blue→orange→red) on month cells |
| Squad Filter | `/squads/list` | Dropdown replacing Department filter on Resources |
| Utilization Fix | Promise.allSettled resilience | useMemo hooks before early return (Rules of Hooks fix) |
| Attendance Grid | `/attendance` (existing) | Full employee x day grid with color-coded cells, legend, dept grouping |
| Timesheet Compliance | `/analytics/timesheet-compliance` | Per-employee missed days table with compliance % |
| Demand Capacity Upload | `/upload/demand-capacity` + ETL | Third upload zone on Timesheet tab |
| Dept/Squad Toggle | `/squads/employee-mapping` | Global toggle in header, affects Resources, Timesheet, Compliance |
| Tab Rename | N/A | Overview → Portfolio |
| Squad = Project | All squad queries use `project` column | Squad names: Everest, Rebranding, Mejoras, SolEng, etc. |
| MV Refresh Bug Fix | Refresh moved outside transaction | Both timelog and attendance uploads |

### Also Included

| Feature | Description |
|---|---|
| Capacity Forecast | Linear projection of dept hours with next-month estimates |
| Headcount Coverage | Attendance headcount vs timelog headcount ratio |

---

## 10. Authentication & Security

> **Current state:** No authentication. The app assumes internal network access.

| Concern | Current Approach | Planned (Phase 4) |
|---|---|---|
| Authentication | None | JWT with role-based access |
| CORS | `cors()` — allows all origins | Restrict to configured origins |
| File Upload | Client-side `.xlsx` filter only | Server-side multer fileFilter |
| SQL Injection | Parameterized queries (`$1`, `$2`) | No change needed |
| Env Secrets | `.env` via dotenv (gitignored) | No change needed |
| Error Messages | Raw `err.message` sent to client | Production-safe generic messages |

---

## 11. Deployment & Infrastructure

### Development

```bash
# Backend
DATABASE_URL=postgresql://tinubu:tinubu_secret@localhost:5433/tinubu_pmo \
PORT=3004 node server/index.js

# Frontend (separate terminal)
cd client && npx vite
```

Vite proxy in `vite.config.js` forwards `/api` to `http://localhost:{PORT}`.

### Production Build

```bash
cd client && npx vite build     # Builds client/dist
NODE_ENV=production node server/index.js   # Serves SPA + API on one port
```

### Database

PostgreSQL 18 runs locally on port 5433. Schema is applied via `node server/migrate.js`.

```bash
# Create database (first time)
psql -h localhost -p 5433 -U postgres -c "CREATE USER tinubu WITH PASSWORD 'tinubu_secret' CREATEDB;"
psql -h localhost -p 5433 -U postgres -c "CREATE DATABASE tinubu_pmo OWNER tinubu;"

# Run migration
node server/migrate.js
```

### Environment Variables

```env
DATABASE_URL=postgresql://tinubu:tinubu_secret@localhost:5433/tinubu_pmo
PORT=3004
NODE_ENV=development
MAX_UPLOAD_SIZE_MB=15
```

---

## 12. Running the Application

### Prerequisites

- Node.js 22+
- PostgreSQL 18 (local or Docker)
- Git

### First-Time Setup

```bash
git clone https://github.com/Ramachandran-U/tinubu-pmo.git
cd tinubu-pmo
npm install
cd client && npm install && cd ..
cp .env.example .env   # Edit with your DB credentials
node server/migrate.js
```

### Uploading Data

1. Navigate to **Timesheet** tab
2. Drag **TimeLog_ALL.xlsx** into the left zone → click Upload
3. Drag **Attendance_Musterroll_Report.xlsx** into the right zone → click Upload
4. All dashboards update immediately with versioned audit trail

---

## 13. Known Limitations & Future Roadmap

### Current Limitations

| Limitation | Detail |
|---|---|
| No authentication | Requires network-level protection |
| CORS open | Allows all origins (security risk) |
| ~~MV refresh in transaction~~ | **FIXED** — Refresh moved outside transaction in both upload routes |
| No file type validation | Server accepts any file type via curl |
| Restore is audit-only | Data rows are not actually restored |
| Hardcoded 160h | FTE capacity assumed as 160h/month in 5 query locations |
| INN- prefix filter | Attendance parser drops non-INN employees silently |
| No server-side pagination | `/resources` returns all employees at once |
| useApi race conditions | Shared loading state across concurrent calls |

### Roadmap (Phase 4 — Parked)

See `Phase4_Enhancement_Plan.md` for the full plan. Summary:

| Track | Features |
|---|---|
| Critical Fixes | MV refresh, CORS, file validation, error handling |
| Hardening | JWT auth, caching, rate limiting, pagination, error boundaries |
| Data Layer | Export engine, upload validation, SOW/projects, portfolio tab |
| Features | Dark mode, global search, skills matrix, resource optimizer |
| DevOps | Dockerfile, CI/CD, structured logging, health checks |

---

*Document maintained by: Tinubu PMO Engineering Team*
*Last updated: March 26, 2026 — v3.0 (Phase 1-3 + Sprint Enhancements complete)*
