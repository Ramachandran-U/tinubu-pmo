# Tinubu PMO Intelligence Platform

## Quick Start

### Option 1: Use the batch files (Windows)

```
start-v1.bat    → Starts the current version (master) on ports 3004/5173
start-v2.bat    → Starts the redesign version (v2-redesign) on ports 3005/5174
```

Double-click either file, or run from terminal. Both can run simultaneously for side-by-side comparison.

### Option 2: Manual start

```bash
# Current version (master branch)
git checkout master
DATABASE_URL=postgresql://tinubu:tinubu_secret@localhost:5433/tinubu_pmo PORT=3004 npx concurrently "node server/index.js" "cd client && npx vite --host"
# Open http://localhost:5173

# Redesign version (v2-redesign branch)
git checkout v2-redesign
DATABASE_URL=postgresql://tinubu:tinubu_secret@localhost:5433/tinubu_pmo PORT=3005 npx concurrently "node server/index.js" "cd client && npx vite --host"
# Open http://localhost:5174
```

---

## Side-by-Side Configuration

|  | Current (master) | Redesign (v2-redesign) |
|---|---|---|
| Branch | `master` | `v2-redesign` |
| Backend port | 3004 | 3005 |
| Frontend port | 5173 | 5174 |
| Frontend URL | http://localhost:5173 | http://localhost:5174 |
| Database | Shared — `tinubu_pmo` on port 5433 | Same |

Both versions share the same PostgreSQL database, so uploaded data is available to both.

---

## Prerequisites

- **Node.js 22+**
- **PostgreSQL 18** (local install on port 5433)
- **Git**

## First-Time Setup

```bash
git clone https://github.com/Ramachandran-U/tinubu-pmo.git
cd tinubu-pmo
npm install
cd client && npm install && cd ..

# Create database (if not exists)
psql -h localhost -p 5433 -U postgres -c "CREATE USER tinubu WITH PASSWORD 'tinubu_secret' CREATEDB;"
psql -h localhost -p 5433 -U postgres -c "CREATE DATABASE tinubu_pmo OWNER tinubu;"

# Run migrations
DATABASE_URL=postgresql://tinubu:tinubu_secret@localhost:5433/tinubu_pmo node server/migrate.js
```

## Uploading Data

1. Open the app → **Timesheet** tab → **Data Upload** sub-tab
2. Upload **TimeLog_ALL.xlsx** (Zoho time log export)
3. Upload **Attendance_Musterroll_Report.xlsx** (Zoho muster roll)
4. Upload **Demand_Capacity.xlsx** (squad allocation file)

All dashboards update immediately.

---

## Documentation

| Document | Description |
|---|---|
| `product-technical-document.md` | Full technical spec: API reference, DB schema, architecture |
| `LLM_Handover_Guide.md` | Handover guide for LLM/agent continuity |
| `PMO_Dashboard_Overview.md` | Non-technical executive overview |
| `Phase4_Enhancement_Plan.md` | Future roadmap (parked) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 + Chart.js |
| Backend | Node.js 22 + Express 4 |
| Database | PostgreSQL 18 (port 5433) |
| ETL | SheetJS (xlsx) for Excel parsing |

---

*Maintained by Tinubu PMO Engineering Team — March 2026*
