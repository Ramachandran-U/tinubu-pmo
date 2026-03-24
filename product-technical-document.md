# Tinubu PMO Dashboard — Product Technical Document

**Version:** 1.0  
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
9. [Authentication & Security](#9-authentication--security)
10. [Deployment & Infrastructure](#10-deployment--infrastructure)
11. [Running the Application](#11-running-the-application)
12. [Known Limitations & Future Roadmap](#12-known-limitations--future-roadmap)

---

## 1. Product Overview

The **Tinubu PMO Dashboard** is an internal analytics and reporting command center for the Project Management Office (PMO). It ingests monthly Excel exports from Zoho (the company's time-tracking system) and renders up-to-date KPIs, resource utilization metrics, and attendance data in an interactive web UI.

### Core Capabilities

| Feature | Description |
|---|---|
| **Data Ingestion** | Upload Zoho Time Log and Attendance Muster Roll `.xlsx` exports via a drag-and-drop UI |
| **Multi-month Filtering** | Select one or more months simultaneously; all charts and tables react in real time |
| **Executive Overview** | Top-level KPIs, client allocation chart, timesheet approval breakdown |
| **Resource Intelligence** | Per-employee headcount, billability %, department charts, location distribution |
| **Workload Utilization** | Daily billable vs. non-billable stacked bar chart, raw timelog explorer |
| **Data Management Hub** | Attendance muster roll table with present/absent counts per employee |
| **Replace-by-Period** | Each new upload **replaces** the previous data for that period — no duplicates |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT                        │
│  React SPA (Vite) + Tailwind CSS v4 + Chart.js              │
│  Running on http://localhost:5173 (dev) / port 3001 (prod)  │
└────────────────────────┬────────────────────────────────────┘
                         │  HTTP / REST  (proxied via /api)
┌────────────────────────▼────────────────────────────────────┐
│                       EXPRESS SERVER                         │
│  Node.js v22 · port 3001                                    │
│  Routes: /api/upload/* · /api/kpis · /api/resources · …    │
│  Middleware: multer (file upload) · cors · error-handler    │
└────────────────────────┬────────────────────────────────────┘
                         │  pg (node-postgres)
┌────────────────────────▼────────────────────────────────────┐
│                     POSTGRESQL 16                            │
│  Docker container: tinubu-pmo-postgres                      │
│  Tables: uploads · timelog_raw · attendance                 │
│  Materialized Views: 5 MVs refreshed per upload             │
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
| UI Library | React | 18.x |
| Styling | Tailwind CSS | v4 (CSS-first via `@theme`) |
| Charts | Chart.js + react-chartjs-2 | 4.x |
| Icons | Google Material Symbols Outlined | CDN |
| Font | Google Inter | CDN |

### Infrastructure

| Component | Technology |
|---|---|
| Database | PostgreSQL 16 (Docker) |
| Container | Docker / docker-compose |
| Dev Concurrency | concurrently (runs server + client) |

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
  • Validates file
  • Calls ETL parser
  • Begins DB transaction
  • DELETE existing rows for that year_month
  • Batch-inserts new rows (500 per INSERT)
  • COMMIT transaction
  • Calls refresh_all_views()
       │
       ▼
PostgreSQL — timelog_raw / attendance tables
       │
       ▼
refresh_all_views() refreshes 5 Materialized Views CONCURRENTLY
```

> **Important:** The entire DELETE + INSERT is wrapped in a single shared transaction client to prevent database deadlocks. Materialized view refresh uses `CONCURRENTLY` so reads are not blocked during refresh.

### Query Flow (Read Path)

```
User changes month selection
       │
       ▼
DataContext.jsx dispatches API calls with ?months=YYYY-MM,YYYY-MM
       │
       ▼
Express GET /api/kpis?months=...
  • Queries Materialized Views only (never raw tables)
  • Aggregates across selected months
  • Returns JSON
       │
       ▼
React page components render charts, tables, and KPI cards
```

---

## 5. Database Design

### Tables

#### `uploads`
Audit trail for every file ingested.

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Auto-increment |
| `upload_id` | TEXT UNIQUE | UUID assigned at upload time |
| `file_type` | TEXT | `timelog` or `attendance` |
| `file_name` | TEXT | Original filename |
| `year_month` | TEXT | Period e.g. `2026-03` |
| `row_count` | INTEGER | Rows successfully parsed |
| `status` | TEXT | `processing`, `success`, `error` |
| `created_at` | TIMESTAMPTZ | Upload timestamp |

#### `timelog_raw`
One row per time entry from Zoho Time Log export.

| Column | Type | Description |
|---|---|---|
| `employee_id` | TEXT | Zoho employee ID |
| `full_name` | TEXT | Employee full name |
| `date` | DATE | Work date |
| `hours` | NUMERIC(6,1) | Hours logged |
| `client_name` | TEXT | Billing client |
| `project_name` | TEXT | Project name |
| `task_name` | TEXT | Task description |
| `billable_status` | TEXT | `Billable` / `Non-Billable` |
| `approval_status` | TEXT | `Approved` / `Pending` / `Not Submitted` |
| `department` | TEXT | Employee department |
| `year_month` | TEXT | Period key |

**Indexes:** `year_month`, `employee_id`, `client_name`, `upload_id`, `date`

#### `attendance`
One row per employee per day from Zoho Muster Roll export.

| Column | Type | Description |
|---|---|---|
| `employee_id` | TEXT | Zoho employee ID |
| `date` | DATE | Calendar date |
| `status` | TEXT | `P`, `A`, `W`, `H`, `PDA`, etc. |
| `location` | TEXT | Office location |
| `department` | TEXT | Department |
| `year_month` | TEXT | Period key |

**Unique constraint:** `(year_month, date, employee_id)` — prevents duplicates.

### Materialized Views

All dashboard queries run against materialized views, **never** raw tables.

| View | Purpose | Unique Index |
|---|---|---|
| `mv_resource_summary` | Per-employee monthly KPIs (hours, billability, clients) | `(employee_id, year_month)` |
| `mv_kpis_monthly` | Global KPIs per month (total hours, employees, projects) | `(year_month)` |
| `mv_client_hours` | Hours and headcount per client per month | `(year_month, client_name)` |
| `mv_dept_hours` | Hours and headcount per department per month | `(year_month, department)` |
| `mv_attendance_summary` | Present/absent/leave day counts per employee per month | `(year_month, employee_id)` |

All views are refreshed atomically after each successful upload via `SELECT refresh_all_views()`.

---

## 6. Backend API Reference

**Base URL:** `http://localhost:3001/api`

### Upload Endpoints

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/upload/timelog` | `multipart/form-data` (.xlsx) | Ingest Zoho Time Log export |
| `POST` | `/upload/attendance` | `multipart/form-data` (.xlsx) | Ingest Zoho Muster Roll export |

**Response:**
```json
{ "rowCount": 2805, "yearMonth": "2026-03", "uploadId": "uuid-xxx" }
```

### Query Endpoints

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `GET` | `/kpis` | `?months=YYYY-MM,...` | Global KPI aggregates |
| `GET` | `/resources` | `?months=...` | Per-employee resource summary |
| `GET` | `/timelog` | `?months=...&page=1&pageSize=200` | Paginated raw time entries |
| `GET` | `/heatmap` | `?months=...` | Daily billable vs. non-billable |
| `GET` | `/attendance` | `?months=...` | Attendance summary per employee |
| `GET` | `/months` | — | Available months in the database |
| `GET` | `/charts/clients` | `?months=...` | Top clients by hours |
| `GET` | `/charts/approval` | `?months=...` | Timesheet approval status breakdown |
| `GET` | `/charts/departments` | `?months=...` | Hours by department |
| `GET` | `/charts/locations` | `?months=...` | Resources by location |

### KPIs Response Shape

```json
{
  "totalHours": 9087.4,
  "billableHours": 3287.2,
  "nonBillableHours": 5800.2,
  "billablePct": 36,
  "uniqueEmployees": 89,
  "uniqueClients": 12,
  "uniqueProjects": 49,
  "totalPresent": 1813,
  "totalAbsent": 5
}
```

---

## 7. Frontend Architecture

### Directory Structure

```
client/src/
├── App.jsx                  # Root shell: sidebar + top nav + routing
├── index.css                # Tailwind v4 @theme tokens (40+ color vars)
├── main.jsx                 # React entry point + Chart.js registration
├── context/
│   └── DataContext.jsx      # Global state: KPIs, selected months, refresh trigger
├── hooks/
│   └── useApi.js            # Fetch wrapper with loading/error state
├── components/
│   ├── KpiCard.jsx          # Metric tile with icon, value, trend
│   ├── ChartCard.jsx        # Chart container with title/subtitle
│   ├── DataTable.jsx        # Sortable, paginated table with custom renderers
│   ├── MonthPicker.jsx      # Multi-month selector (tab or pill variants)
│   └── UploadZone.jsx       # Drag-and-drop file uploader
├── charts/
│   └── chart-config.js      # Global Chart.js defaults and color tokens
└── pages/
    ├── Overview.jsx          # Executive Summary tab
    ├── Resources.jsx         # Resource Intelligence tab
    ├── Utilization.jsx       # Workload Intensity & Allocation tab
    └── Timesheet.jsx         # Data Management Hub tab
```

### Design System (Tailwind v4 `@theme`)

All colors are defined as CSS custom properties in `index.css` using the Tailwind v4 `@theme` block, mapped from the M3-style **Light Theme "Command Center"** specification.

Key tokens:

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#004ac6` | Buttons, active nav, links |
| `--color-primary-container` | `#2563eb` | Gradient fills |
| `--color-surface` | `#f7f9fb` | Page background |
| `--color-surface-container-lowest` | `#ffffff` | KPI cards, tables |
| `--color-surface-container-low` | `#f2f4f6` | Chart containers |
| `--color-on-surface` | `#191c1e` | Body text |
| `--color-on-surface-variant` | `#434655` | Subtitles, muted text |
| `--color-outline-variant` | `#c3c6d7` | Borders, dividers |
| `--color-error` | `#ba1a1a` | Absent counts, error states |

### State Management

Global state is managed via React Context (`DataContext`). It exposes:

- `kpis` — aggregate KPI values for selected months
- `selectedMonths` — array of `YYYY-MM` strings
- `availableMonths` — all periods in the database
- `loadingInitial` — true during the first data fetch
- `isRefreshing` — true on subsequent fetches (shows opacity overlay)
- `refetchAll()` — triggers a full data refresh (called after uploads)

### API Hook (`useApi`)

```js
const { req, loading, error } = useApi()
const data = await req('/endpoint', { method: 'GET' })
```

For file uploads, `Content-Type` must be **omitted** from headers so `fetch` can set the correct multipart boundary automatically:

```js
await req('/upload/timelog', {
  method: 'POST',
  headers: { 'Content-Type': undefined },
  body: formData
})
```

---

## 8. ETL Pipeline

### `parse-timelog.js`

Parses the Zoho **Time Log** export (`.xlsx`). Key behaviors:

- Reads the first worksheet using SheetJS `read()`
- Skips header rows dynamically (finds the row containing `"Employee Id"`)
- Maps column names to normalized field keys
- Extracts `year_month` automatically from the `date` column
- Returns an array of normalized row objects

**Supported field mappings from Zoho export:**

| Zoho Column | DB Field |
|---|---|
| Employee Id | `employee_id` |
| Full Name | `full_name` |
| Work Date | `date` |
| Hours | `hours` |
| Client Name | `client_name` |
| Project Name | `project_name` |
| Billing Status | `billable_status` |
| Approval Status | `approval_status` |
| Task Name | `task_name` |
| Department | `department` |

### `parse-attendance.js`

Parses the Zoho **Muster Roll** export. Key behaviors:

- First column is `Employee Id`, remaining columns are dates
- Status values: `P` (Present), `A` (Absent), `W` (Weekend), `H` (Holiday), `PDA` (Half Day), `-` (No Data)
- Unpivots the wide format into one row per date per employee

### Batch Insert Strategy

To avoid PostgreSQL statement limits on large datasets:

```
Rows are split into chunks of 500
Each chunk is inserted with a single parameterised INSERT ... VALUES ($1, $2, …)
All chunks run within the same shared transaction client
```

---

## 9. Authentication & Security

> This is an **internal-use** dashboard with no external-facing endpoints.

| Concern | Current Approach |
|---|---|
| Authentication | None — assumes internal network/VPN access |
| CORS | Configured to allow local dev origins only |
| File Upload | Restricted to `.xlsx` / `.xls` MIME types via Multer filter |
| SQL Injection | All queries use parameterised statements (`$1`, `$2`, …) |
| Env Secrets | DB credentials loaded from `.env` via dotenv (not committed to git) |

**Future consideration:** Add JWT-based auth with role-based access (PMO Admin vs. Viewer) before any public or cloud deployment.

---

## 10. Deployment & Infrastructure

### Development

```
tinubu-pmo/
├── client/     ← Vite dev server on :5173 (proxies /api → :3001)
└── server/     ← Express on :3001
```

Run both simultaneously:

```bash
npm run dev
```

### Production Build

```bash
npm run build          # Builds client/dist via Vite
npm start              # Express serves client/dist as static files on :3001
```

In production, the Express server serves the built React SPA at `/` and handles all `/api/*` requests. No separate Vite process is needed.

### Database (Docker)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    container_name: tinubu-pmo-postgres
    environment:
      POSTGRES_DB: tinubu_pmo
      POSTGRES_USER: pmo_user
      POSTGRES_PASSWORD: <from .env>
    ports:
      - "5432:5432"
```

```bash
docker compose up -d          # Start database
node server/migrate.js        # Create tables and materialized views
```

### Environment Variables (`.env`)

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tinubu_pmo
DB_USER=pmo_user
DB_PASSWORD=your_secure_password
PORT=3001
```

---

## 11. Running the Application

### Prerequisites

- Node.js 18+
- Docker Desktop
- Git

### First-Time Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd tinubu-pmo
npm install
cd client && npm install && cd ..

# 2. Configure environment
cp .env.example .env
# Edit .env with your DB password

# 3. Start the database
docker compose up -d

# 4. Run schema migration
npm run migrate

# 5. Start development servers
npm run dev
```

Open **http://localhost:5173** in your browser.

### Uploading Data

1. Navigate to the **Timesheet** tab
2. Drag and drop your Zoho **Time Log** `.xlsx` into the left upload zone
3. Click **Upload & Process Data** — the ETL pipeline runs automatically
4. Repeat with the **Attendance** `.xlsx` in the right upload zone
5. All charts and KPIs update immediately after upload

---

## 12. Known Limitations & Future Roadmap

### Current Limitations

| Limitation | Detail |
|---|---|
| No authentication | Requires VPN/network-level protection |
| Single organisation | Not multi-tenant; one DB schema per deployment |
| Timelog raw table query cap | `/timelog` API is limited to 200 rows per request to prevent memory issues |
| No historical delta tracking | Each upload replaces the full period — there is no diff/audit trail beyond the `uploads` table |
| Attendance half-day calculation | `totalLeave` and `totalHalfDay` columns in the attendance table are hardcoded to `0` pending more granular Zoho data |

### Roadmap

| Priority | Feature |
|---|---|
| High | JWT authentication + role-based access control |
| High | Portfolio tab — active projects, milestone timeline, risk matrix |
| High | Finance tab — revenue tracking, budget utilisation per project |
| Medium | SOW tab — statement of work document manager |
| Medium | AMM tab — Agile Maturity Model metrics |
| Medium | Export to PDF / Excel for all dashboard views |
| Medium | Email digest / scheduled report notifications |
| Low | Dark mode toggle |
| Low | Multi-tenant support with org switching |
| Low | AI-powered Insights card (trend anomaly detection) |

---

*Document maintained by: Tinubu PMO Engineering Team*  
*Last updated: March 2026*
