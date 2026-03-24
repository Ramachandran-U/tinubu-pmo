# Tinubu PMO Dashboard — Phase 4 Enhancement Plan

*Generated: March 25, 2026*
*Source: 3-Agent Analysis (Code Architect + Code Explorer + Code Reviewer)*

---

## Executive Summary

Phase 4 addresses critical bugs, security gaps, and architectural debt identified by automated code analysis, then delivers high-value new features. The plan is organized into 5 tracks that can be executed sequentially or in parallel where dependencies allow.

**Total estimated effort: 11-15 sprint days**

---

## Track A — Critical Fixes & Security (Priority: Immediate)

*Estimated: 1 day*

### A1. Fix REFRESH MATERIALIZED VIEW inside transaction
- **Severity**: Critical (uploads will fail)
- **File**: `server/routes/upload.js:115,216`
- **Fix**: Move `SELECT refresh_all_views()` to after `COMMIT`, use pool.query instead of txn client

### A2. Restrict CORS
- **Severity**: Critical (employee PII exposed)
- **File**: `server/index.js:13`
- **Fix**: `cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' })`

### A3. Add file type validation on uploads
- **Severity**: Critical
- **File**: `server/routes/upload.js:24-27`
- **Fix**: Add multer `fileFilter` to reject non-.xlsx/.xls files

### A4. Fix year_month='pending' audit bug
- **Severity**: Critical
- **File**: `server/routes/upload.js:66-70`
- **Fix**: Remove `year_month` from initial INSERT, update schema to allow NULL or use 'unknown'

### A5. Fix restore endpoint false success
- **File**: `server/routes/upload.js:318`
- **Fix**: Return warning that data rows are not restored, only audit trail

### A6. Validate months query parameter
- **File**: `server/routes/shared.js`
- **Fix**: Validate each entry against `/^\d{4}-\d{2}$/`

### A7. Fix useApi error handling
- **File**: `client/src/hooks/useApi.js:28-32`
- **Fix**: Check `res.ok` before calling `res.json()`

### A8. Fix App.jsx null guard
- **File**: `client/src/App.jsx:40`
- **Fix**: `if (!tab || !tab.active)` instead of `if (!tab.active)`

### A9. Fix Timesheet hardcoded zeros
- **File**: `client/src/pages/Timesheet.jsx:32-35`
- **Fix**: Use `mv_attendance_summary` data for leave, holiday, weekend counts

### A10. Stop exposing raw error messages in production
- **File**: `server/middleware/error-handler.js`
- **Fix**: Only expose `err.message` in development; generic message in production

---

## Track B — Platform Hardening

*Estimated: 2-3 days*

### B1. JWT Authentication
- New files: `server/middleware/auth.js`, `server/routes/auth.js`, `client/src/context/AuthContext.jsx`, `client/src/pages/Login.jsx`
- New table: `users (id, email, password_hash, full_name, role, is_active)`
- Roles: `admin`, `manager`, `viewer`
- Apply `requireAuth` to all routes except `/api/health` and `/api/auth/login`

### B2. Response Caching (LRU)
- New file: `server/middleware/cache.js`
- In-process LRU cache (60s analytics, 300s aggregates)
- Invalidate on upload success

### B3. Rate Limiting
- New file: `server/middleware/rate-limit.js`
- Upload: 10 req/15min; API: 200 req/min

### B4. Server-Side Pagination
- Modify `server/routes/resources.js` and `server/routes/timelog.js`
- Return `{ data, total, page, pageSize, totalPages }`
- Add `serverPagination` prop to `DataTable.jsx`

### B5. React Error Boundaries
- New file: `client/src/components/ErrorBoundary.jsx`
- Wrap each page and each ChartCard

### B6. Fix useApi concurrent call safety
- Remove shared `loading`/`error` state from `useApi.js`
- Make `req` a pure async function

### B7. Refactor upload handlers
- Extract shared logic from timelog/attendance upload handlers into a factory function
- Reduce ~240 lines of duplication to ~40

---

## Track C — Data Power Layer

*Estimated: 3-4 days*

### C1. Export Engine
- New file: `server/routes/export.js`
- CSV streaming for timelog, resources, attendance
- XLSX multi-sheet export for KPIs
- New component: `client/src/components/ExportMenu.jsx`

### C2. Upload Validation Pipeline
- New files: `server/etl/validate-timelog.js`, `server/etl/validate-attendance.js`
- Pre-insert validation: negative hours, future dates, duplicates, cross-month rows
- Surface warnings in upload response and UploadZone UI

### C3. SOW & Project Tables
- New tables: `projects`, `project_assignments`
- New MV: `mv_project_profitability`
- New file: `server/routes/projects.js`

### C4. Activate Portfolio Tab
- New file: `client/src/pages/Portfolio.jsx`
- Budget burn grid, profitability table, timeline risk panel

### C5. Surface Unsurfaced Data
- Expose `jira_no`, `task_code`, `contractor_company` in timelog table
- Use `mv_attendance_summary` for leave/holiday/weekend in Timesheet
- Add `mv_client_hours.headcount` and `project_count` to client charts

---

## Track D — High-Value Features

*Estimated: 4-5 days*

### D1. Dark Mode
- Add `[data-theme="dark"]` CSS variables to `index.css`
- New context: `client/src/context/ThemeContext.jsx`
- Wire existing toggle button in `App.jsx`

### D2. Global Search
- New file: `server/routes/search.js`
- Search employees, projects, timelog entries
- New component: `client/src/components/GlobalSearch.jsx`
- Replace dead search input in App.jsx header

### D3. Skills Matrix
- New table: `employee_skills`
- New file: `server/routes/skills.js`
- New component: `client/src/components/SkillsMatrix.jsx`

### D4. Resource Allocation Optimizer
- New file: `server/routes/optimizer.js`
- Score available employees against under-burned projects
- New component: `client/src/components/AllocationRecommendations.jsx`

### D5. Scheduled Import
- New file: `server/jobs/scheduler.js`
- node-cron watching a directory for new Excel files
- Gated behind `ENABLE_SCHEDULED_IMPORT=true`

### D6. Centralize 160h constant
- Replace 5 hardcoded `160.0` references with `process.env.MONTHLY_CAPACITY_HOURS`

---

## Track E — DevOps

*Estimated: 1-2 days*

### E1. Dockerfile (multi-stage)
### E2. Enhanced docker-compose.yml
### E3. CI/CD pipeline (`.github/workflows/ci.yml`)
### E4. Structured logging (pino)
### E5. Enhanced health check with DB connectivity
### E6. HTTP security headers (helmet)

---

## New Dependencies to Add

| Package | Purpose |
|---|---|
| `jsonwebtoken` | JWT auth |
| `bcryptjs` | Password hashing |
| `lru-cache` | Response caching |
| `express-rate-limit` | Rate limiting |
| `pino` | Structured logging |
| `node-cron` | Scheduled imports |
| `helmet` | Security headers |

---

## Priority Matrix

| Track | Priority | Depends On | Est. Days |
|---|---|---|---|
| A — Critical Fixes | Immediate | Nothing | 1 |
| B — Hardening | High | Track A | 2-3 |
| C — Data Layer | High | Track A, B1 (auth) | 3-4 |
| D — Features | Medium | Track A, B1 (auth) | 4-5 |
| E — DevOps | Medium | Track A | 1-2 |

---

*Document generated from 3-agent analysis: Code Architect, Code Explorer, Code Reviewer*
*Park status: Ready for execution when prioritized*
