# Tinubu PMO Dashboard — Enhancement & Feature Specification Plan

*Analysis Date: March 25, 2026*  
*Analyst: Senior PMO Systems Architect (AI-Assisted)*  
*Data Period: March 2026 (01-Mar to 27-Mar)*

---

## Executive Summary

This document provides a comprehensive feature enhancement roadmap for the Tinubu PMO Intelligence Platform, grounded in direct profiling of the actual Zoho data exports. The analysis reveals a **multi-entity, globally distributed workforce** across 6 legal entities, 9 office locations, and 31 departments — with 29 employees in attendance tracking who do not log time (G&A/non-billable roles), and significant utilization variance requiring active monitoring.

**Three strategic themes** emerge from the data:

1. **Utilization Polarization**: 66% of time-logging employees fall in the 81-120h/month range, but 2 individuals exceed 160h (burnout risk) and 5 log under 40h (under-utilization). A real-time monitoring layer is the highest-priority feature.

2. **Multi-Entity Governance Gap**: With 6 legal entities, 17 business units, and 23 managers, the current single-view approach obscures entity-level compliance and billing performance. Cross-entity drill-down features are a critical PMO need.

3. **Temporal Intelligence Deficit**: The existing system stores period data well, but the current UI exposes no month-over-month trends, forecasts, or anomaly detection — despite the infrastructure being ready for these features.

**Recommended Phase 1 priority**: Data Correction Mechanism + 6 temporal KPI cards + Department Utilization Heatmap (cross-month) — all implementable in 2 weeks using existing materialized views.

---

## Part 1: Data Analysis

### 1.1 Attendance Data Profile

| Metric | Value |
|---|---|
| **Source File** | `Attendance_Musterroll_Report (9).xlsx` |
| **Period** | 01-Mar-2026 to 31-Mar-2026 (31 days) |
| **Total Employee Records** | 113 employees |
| **File Structure** | Wide-pivot format: rows = employees, columns = dates (each day has `Shift` + `Status` pair) |
| **Summary Columns** | Worked Days, Weekend, Holidays, Paid Off, Unpayable Days, Payable Days |

**Organisational Dimensions**

| Dimension | Count | Values |
|---|---|---|
| Legal Entities | 6 | Tinubu Innoveo AG (Switzerland), Kft (Hungary), Inc. (Americas), Technologies SL (Spain), India Inc., Limited |
| Business Units | 17 | G&A Switzerland, G&A Hungary, G&A Americas, PD Product Centre HU, G&A Spain, PS Delivery Centre HU, OD Operations HU, SSD Solutions AMER, + 9 more |
| Divisions | 8 | Operations, Administration, Sales & Partnerships, Product, Professional Services, Solutions, Finance |
| Departments | 31 | Delivery Unit 1-3 (PS), Cloud Engineering (OD), Core Development (PD), Human Resources (AD), Sales US/EMEA, Cross Function (PD), + 21 more |
| Locations | 9 | Zurich, Budapest, Princeton, Valencia, Morocco, Bangalore VeARC, Bulgaria, Hong Kong |
| Reporting Managers | 23 | |

**Status Code Distribution (across 113 employees × 31 days)**

| Status Code | Count | Meaning |
|---|---|---|
| `P` | 1,812 | Present (in-office) |
| `W` | 967 | Weekend |
| `-` | 561 | No data / Not applicable |
| Numeric (9.0, 17.0 etc.) | ~330 | Hours worked (partial day codes) |
| `H` | 49 | Public Holiday |
| `VEB`, `VE`, `VEL` | 45 | VeARC Earned Leave variants |
| `VH` | 34 | VeARC Holiday |
| `A` | 5 | Absent (unexcused) |
| `SLE/P`, `SLE` | 14 | Special Leave – Earned |
| `VSL/P` | 6 | VeARC Sick Leave |
| `PDA` | 1 | Half day |

**Key Observations:**
- Present rate: 1,812 ÷ (1,812 + 5) ≈ **99.7% of work days recorded as present** (excluding weekends/holidays)
- True absenteeism is very low (only 5 `A` records) — most non-working days are legitimate leave or holidays
- The numeric status codes (e.g., `9.0`, `17.0`) represent hour counts on those days, suggesting mixed-format reporting
- 561 `-` records indicate employees not applicable for certain dates (likely part-time or onboarding mid-month)

**Data Quality Issues:**
- Status codes are inconsistent (some are strings like `P`, some are floats like `9.0`) — ETL parser must handle both
- Multiple leave type codes from VeARC vs. non-VeARC entities will need normalization in a future leave-type classification feature
- 29 employees in attendance have no corresponding timelog records (expected — G&A, Finance, HR roles typically don't bill time)

---

### 1.2 TimeLog Data Profile

| Metric | Value |
|---|---|
| **Source File** | `TimeLog_ALL (63).xlsx` |
| **Period** | 01-Mar-2026 to 27-Mar-2026 (27 working days covered) |
| **File Structure** | Pivot table: rows = employees, columns = calendar dates (Excel serial numbers), last col = Grand Total |
| **Total Employees Logging Time** | 84 |
| **Total Hours** | **8,522.5 hours** |
| **Average hours/employee** | **100.3h** (~3.7h/day per employee) |

**Hours Distribution (March 2026)**

| Bucket | Employees | % | Interpretation |
|---|---|---|---|
| 1-40h | 5 | 6% | Severely under-utilized (bench, partial month, or joining) |
| 41-80h | 14 | 17% | Under-utilized (below 50% capacity) |
| 81-120h | 56 | 66% | Healthy utilization band |
| 121-160h | 7 | 8% | Fully utilized / high performers |
| 161-200h | 1 | 1% | Overloaded (**Szabolcs Albert Fekete: 204h** — critical flag) |
| 200h+ | 1 | 1% | Severe overload |

**Top 5 & Bottom 5 by Total Hours**

| Employee | Hours | Flag |
|---|---|---|
| Szabolcs Albert Fekete | 204h | 🔴 Overload |
| *(next top performer)* | ~170h | 🟡 High load |
| *...56 employees...* | 81-120h | ✅ Healthy |
| Matija Hericko | 16h | 🔴 Under-utilized |
| *(4 others)* | <40h | 🟡 Low utilization |

**Key Observations:**
- The **median utilization band is healthy** — but the distribution has a long tail at the top (burnout risk) and bottom (bench/under-allocation)
- The file covers 27 of 31 March days — the last 4 days (28-31 Mar) are missing from the pivot, likely not yet exported when this file was generated
- Billable vs. non-billable split and approval status are **not present in the pivot file** — these are available in the raw timelog database from previous uploads

---

### 1.3 Cross-File Analysis

| Metric | Value |
|---|---|
| Attendance employees | 113 |
| TimeLog employees | 84 |
| **In BOTH files** | **84 (100% of TimeLog employees)** |
| Attendance-only (no timelog) | **29 employees** |
| TimeLog-only (no attendance) | **0 employees** |

**Critical Insight**: The 29 employees tracked in attendance but not logging time are **exclusively G&A/overhead roles** — this is expected and correct. Every employee who logs time also has an attendance record. This means:

- Attendance is the **complete headcount** record (113 total employees)
- TimeLog is the **billable/project-engaged** subset (84 employees, 74% of headcount)
- The 29 non-logging employees represent **~26% overhead headcount** — a useful PMO ratio metric

---

### 1.4 Key Discoveries

1. **📍 Multi-entity overhead gap**: 29 employees (~26%) are in G&A roles and do not log project time. Current dashboard shows utilization only for time-logging employees — the full picture requires combining both datasets.

2. **🔴 Burnout risk is live**: Szabolcs Albert Fekete logged 204h in 27 days (~7.6h/day including weekends). This pattern needs an automated alert system.

3. **📊 Utilization bell curve**: The 81-120h band contains 66% of employees — healthy, but with visible under-performers (19 employees <80h) that need active attention.

4. **🏢 Location-based variance likely**: 9 locations across 6 entities suggests significant timezone and work-pattern differences. A location-level breakdown has never been surfaced.

5. **📋 31 departments, 8 divisions** — the current dashboard shows department totals but not the division hierarchy, losing an important aggregation level.

6. **🔍 23 managers** — manager-level accountability (timesheet compliance, team utilization rates) has zero current visibility.

7. **📅 Data lag pattern**: The pivot file was generated on ~27-Mar but the period runs to 31-Mar — this 4-day lag is a recurring operational constraint that forecasting features must account for.

8. **✅ Perfect cross-file match**: Every employee in TimeLog has an attendance record — this enables reliable **corroboration analysis** (attended but didn't log time, or vice versa).

---

## Part 2: Data Correction Mechanism Analysis

### Approach A: Simple Re-Upload (Current System)

**User Journey:**
1. User discovers error in last month's data (e.g., missing timesheets)
2. Downloads corrected `.xlsx` from Zoho with updates
3. Navigates to Timesheet tab → Upload Zoho Time Log
4. Drops the corrected file → system automatically DELETEs old `2026-03` rows and inserts new ones
5. All MVs refresh — dashboard reflects corrected data

**Technical Implementation:**
- Database changes: None (already implemented)
- API endpoints: Already exists (`POST /api/upload/timelog`)
- Frontend components: Already exists (UploadZone)

**Pros:**
- Zero additional development effort
- Clean data — no history of bad data
- Fully atomic (transaction-safe)

**Cons:**
- No audit trail of what changed or why
- No "who corrected it" tracking
- Cannot revert to the previous version if the correction was wrong

**Complexity**: Low | **Effort**: 0 days (existing) | **UX**: Simple

---

### Approach B: Upload Versioning ⭐ RECOMMENDED

**User Journey:**
1. User re-uploads corrected file (same flow as Option A)
2. System creates a new **upload version** rather than replacing the previous one
3. Dashboard shows "Last updated: 25 Mar 2026, 14:22 (v2)" under month selector
4. User can click "View upload history" to see: v1 (original upload, 2,805 rows), v2 (correction, 2,819 rows)
5. Each version shows: upload timestamp, file name, row count, uploaded by
6. System keeps the **most recent upload as active** — older versions are archived in the `uploads` table
7. User can optionally "restore" a previous version (admin action)

**Technical Implementation:**

Database changes:
```sql
-- Add version tracking to existing uploads table
ALTER TABLE uploads ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE uploads ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE uploads ADD COLUMN uploaded_by TEXT DEFAULT 'system';

-- Add version reference to raw data tables
ALTER TABLE timelog_raw ADD COLUMN upload_version INTEGER DEFAULT 1;
ALTER TABLE attendance ADD COLUMN upload_version INTEGER DEFAULT 1;

-- When new upload comes in:
-- 1. SET is_active = FALSE for previous uploads of same year_month + file_type
-- 2. INSERT new upload record with version = MAX(previous version) + 1
-- 3. INSERT new rows tagged with new upload_id
-- 4. Keep old rows (don't delete) — just filter by active upload_id in queries
```

API endpoints:
- `GET /api/uploads?yearMonth=2026-03&fileType=timelog` — returns version history
- `POST /api/uploads/:uploadId/restore` — sets is_active = true for previous version

Frontend components:
- Upload history dropdown in MonthPicker or Timesheet tab header
- "v2 — Latest" badge next to month selector
- Version history modal showing all uploads for a period

**Pros:**
- Preserves full audit trail
- "Who corrected it" tracking with timestamps
- Can revert to previous version if correction was wrong
- Minimal extra complexity over current system

**Cons:**
- Requires small schema migration
- MVs must query only active uploads (add `WHERE upload_id IN (SELECT upload_id FROM uploads WHERE is_active = true)`)
- Slightly more storage usage (keeps old rows)

**Complexity**: Medium | **Effort**: 2-3 days | **UX**: Simple (invisible unless needed)

---

### Approach C: Record-Level Corrections

**User Journey:**
1. User sees incorrect entry in the raw timelog table
2. Clicks an "Edit" icon on the row → inline editor opens
3. Changes the value (e.g., hours from 8 to 6)
4. Enters a reason/comment
5. Submits → record is flagged as "manually corrected" with user + timestamp
6. Change appears in an audit log page

**Technical Implementation:**

Database changes:
```sql
CREATE TABLE corrections (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL, -- 'timelog_raw' or 'attendance'
  record_id INTEGER NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  corrected_by TEXT,
  corrected_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE timelog_raw ADD COLUMN is_corrected BOOLEAN DEFAULT FALSE;
ALTER TABLE timelog_raw ADD COLUMN correction_note TEXT;
```

API endpoints:
- `PATCH /api/timelog/:id` — update a single record
- `GET /api/corrections?yearMonth=...` — audit log page

Frontend components:
- Inline edit mode on DataTable rows
- Correction reason modal
- Audit log tab

**Pros:**
- Surgical precision — only changes what's wrong
- Full change history per record
- Enables approval workflow for corrections

**Cons:**
- Significantly more complex to build and maintain
- Risk of data divergence from source Zoho system
- Re-upload would overwrite manual corrections unless protected
- Requires user authentication / permission system first

**Complexity**: High | **Effort**: 8-12 days | **UX**: Complex

---

### Recommendation: **Approach B (Upload Versioning)**

Implement Approach B as the immediate solution. It requires only a 3-column schema migration, provides the audit trail PMOs need, and adds zero friction to the existing upload workflow. Approach C should only be considered after authentication (Phase 3+) is implemented, as record-level edits are meaningless without user identity tracking.

---

## Part 3: Feature Specifications

---

### Category 1: Temporal KPI Cards (Executive Dashboard)

---

#### Feature: Month-over-Month KPI Cards

**PMO Value Statement**: Enables the PMO to see at a glance whether each key metric is improving or declining versus the prior period, eliminating the manual effort of comparing separate month reports.

**Temporal Design:**
- **Aggregation**: Sum across selected months (or "latest month" for current-state view)
- **Month-wise Breakdown**: Up/down arrow badge with % change vs. previous period
- **Trend Visualization**: Sparkline (7-month mini line chart) inside each KPI card
- **Date Drill-down**: Click card → opens detail modal with month-by-month breakdown table

**Data Requirements:**
- Source: `mv_kpis_monthly`, `mv_attendance_summary`
- Calculations: `(current_month - prev_month) / prev_month * 100` for each KPI
- Month range: Requires at least 2 months of data for trends

**Visualization Design:**
- 5 cards in a horizontal row on the Executive Overview tab
- Each card: Large metric value + label + colored arrow badge + sparkline in bottom-right corner
- Green = improving, Red = declining, Gray = flat (< 2% change)

**Alert Thresholds:**
- Utilization: Green ≥80%, Yellow 60-80%, Red <60%
- Billability: Green ≥70%, Yellow 50-70%, Red <50%
- Attendance: Green ≥95%, Yellow 85-95%, Red <85%

**Database Query:**
```sql
SELECT 
  year_month,
  SUM(total_hours)     AS total_hours,
  SUM(billable_hours)  AS billable_hours,
  COUNT(DISTINCT employee_id) AS headcount
FROM mv_resource_summary
WHERE year_month = ANY($1)
GROUP BY year_month
ORDER BY year_month;
```

**User Stories:**
1. "As a PMO Director, I want to see whether total delivered hours increased this month so I can report capacity trend to leadership."
2. "As a Finance Controller, I want billability % change month-over-month so I can flag revenue risk early."

**Priority**: High | **Complexity**: Low | **Data Ready**: Yes | **Phase**: 1 | **Estimate**: 8h (Backend 2h, Frontend 5h, Tests 1h)

---

#### Feature: Headcount Coverage Ratio Card

**PMO Value Statement**: Surfaces the 26% of employees who are in the system (attendance) but not logging time — enabling the PMO to track overhead headcount as a deliberate ratio, not an oversight.

**Data Requirements:**
- `mv_attendance_summary` (total employees) joined with `mv_resource_summary` (logging employees)
- Calculation: `billing_headcount / total_headcount * 100`

**Alert Thresholds:** Green ≥75%, Yellow 65-75%, Red <65%

**Priority**: Medium | **Complexity**: Low | **Data Ready**: Yes | **Phase**: 1 | **Estimate**: 4h

---

### Category 2: Temporal Utilization Analytics

---

#### Feature: Department Utilization Heatmap (Cross-Month)

**PMO Value Statement**: Reveals which departments are chronically over- or under-utilized across the selected period — enabling proactive reallocation before burnout or revenue loss occurs.

**Temporal Design:**
- **Aggregation**: Average utilization % per department per month
- **Month-wise Breakdown**: Grid table — rows = departments, columns = months, cells = utilization % with color fill
- **Trend Visualization**: Rightmost column shows a sparkline trend and MoM change arrow
- **Date Drill-down**: Click a cell → drawer shows individual employees in that dept for that month

**Visualization Design:**
- Heatmap grid: 31 departments × N months
- Color scale: White (0%) → Blue-200 (50%) → Blue-500 (80%) → Red-500 (>100%)
- Header row: Month labels; First column: Department name + Division group
- Footer row: Company-wide average per month

**Database Query:**
```sql
SELECT 
  department,
  year_month,
  SUM(total_hours)        AS dept_hours,
  SUM(billable_hours)     AS dept_billable,
  COUNT(DISTINCT employee_id)  AS headcount,
  -- Utilization: assume 160h/month capacity per FTE
  ROUND(SUM(total_hours) / (COUNT(DISTINCT employee_id) * 160.0) * 100, 1) AS utilization_pct
FROM mv_resource_summary
WHERE year_month = ANY($1)
GROUP BY department, year_month
ORDER BY department, year_month;
```

**Alert Thresholds:** Green 70-90%, Yellow 50-70% or 90-100%, Red <50% or >100%

**User Stories:**
1. "As a Resource Manager, I want to see which departments are consistently overloaded across 3 months so I can request headcount approval."
2. "As a PMO, I want to identify bench-heavy departments so I can reallocate to understaffed projects."

**Priority**: High | **Complexity**: Medium | **Data Ready**: Yes | **Phase**: 1 | **Estimate**: 16h (Backend 4h, Frontend 10h, Tests 2h)

---

#### Feature: Employee Utilization Trend (Rolling 6-Month)

**PMO Value Statement**: Identifies individuals who have been sustainably loaded vs. those trending toward burnout or disengagement, enabling manager conversations before problems escalate.

**Temporal Design:**
- **Aggregation**: Rolling 6-month average alongside individual month values
- **Month-wise Breakdown**: Line chart per employee (one line), multi-month sparkline table
- **Trend Visualization**: Line chart with 3-period rolling average trendline overlay
- **Date Drill-down**: Click employee row → weekly breakdown within selected months

**Visualization Design:**
- Sortable table: Employee | Dept | Avg Hours (period) | Trend Sparkline | Status Badge | Action
- Embedded sparkline shows 6 bars (last 6 months), colored by utilization band
- Status badges: 🔴 At Risk (>160h avg) | 🟡 High Load (130-160h) | ✅ Healthy (80-120h) | 🟠 Under (40-80h) | ⬛ Bench (<40h)

**Database Query:**
```sql
SELECT 
  employee_id,
  MAX(full_name)  AS full_name,
  MAX(department) AS department,
  year_month,
  total_hours,
  AVG(total_hours) OVER (
    PARTITION BY employee_id 
    ORDER BY year_month 
    ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
  ) AS rolling_avg_6mo
FROM mv_resource_summary
WHERE year_month >= TO_CHAR(NOW() - INTERVAL '6 months', 'YYYY-MM')
ORDER BY employee_id, year_month;
```

**Alert Thresholds:** Escalate to "At Risk" if rolling 3-month avg > 160h

**Priority**: High | **Complexity**: Medium | **Data Ready**: Yes | **Phase**: 1 | **Estimate**: 14h

---

#### Feature: Location Utilization Comparison (Cross-Entity)

**PMO Value Statement**: For a multi-entity company with 9 office locations across 6 legal entities, reveals whether specific geographies are disproportionately loaded — critical for global capacity decisions.

**Temporal Design:**
- Multi-bar chart (grouped by location, each bar = a month)
- Side-by-side comparison of Zurich vs. Budapest vs. Princeton vs. Valencia vs. Bangalore, etc.
- MoM change percentage label on each bar

**Data Requirements:** Join `mv_resource_summary` with `attendance` (for location field)

**Priority**: Medium | **Complexity**: Medium | **Data Ready**: Yes (requires JOIN) | **Phase**: 2 | **Estimate**: 12h

---

#### Feature: Burnout Risk Early Warning

**PMO Value Statement**: Proactively identifies employees sustaining high hours for 3+ consecutive months, enabling intervention before medical leave or attrition occurs.

**Temporal Design:**
- Requires: minimum 3 months of data
- Algorithm: flag any employee with total_hours > 160 for 3 consecutive months
- Shows: employee name, dept, manager, month-by-month hours, trend arrow

**Database Query:**
```sql
WITH high_workload AS (
  SELECT employee_id, full_name, department, year_month, total_hours,
    CASE WHEN total_hours > 160 THEN 1 ELSE 0 END AS is_overloaded
  FROM mv_resource_summary
),
consecutive AS (
  SELECT *, 
    SUM(is_overloaded) OVER (
      PARTITION BY employee_id 
      ORDER BY year_month 
      ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS consecutive_high_months
  FROM high_workload
)
SELECT DISTINCT ON (employee_id) *
FROM consecutive
WHERE consecutive_high_months >= 3
ORDER BY employee_id, year_month DESC;
```

**Alert Thresholds:** Yellow: 2 consecutive months >160h; Red: 3+ consecutive months >160h

**Priority**: High | **Complexity**: Medium | **Data Ready**: Needs 3+ months loaded | **Phase**: 2 | **Estimate**: 10h

---

### Category 3: Attendance Intelligence

---

#### Feature: Attendance Rate Trend Chart

**PMO Value Statement**: Tracks whether workforce attendance is improving or declining over time — a leading indicator of team morale, management effectiveness, and operational health.

**Temporal Design:**
- **Aggregation**: Monthly attendance rate (present days / total work days)
- **Month-wise Breakdown**: Line chart with one line per entity or department
- **Trend Visualization**: Trendline overlay + MoM % change annotation
- **Date Drill-down**: Click a month data point → calendar heatmap of that specific month

**Data Requirements:** `mv_attendance_summary` — `present_days / (present_days + absent_days + leave_days)`

**Visualization Design:**
- Line chart: X-axis = months, Y-axis = attendance rate %, one line per major division
- Secondary table below chart: Dept | Jan | Feb | Mar | Trend | Status
- Color guide: Green line = improving, Red = declining, dotted = forecast

**Database Query:**
```sql
SELECT 
  year_month,
  department,
  SUM(present_days)                                   AS total_present,
  SUM(absent_days)                                    AS total_absent,
  SUM(leave_days)                                     AS total_leave,
  SUM(present_days + absent_days + leave_days)        AS total_tracked_days,
  ROUND(100.0 * SUM(present_days) / 
    NULLIF(SUM(present_days + absent_days + leave_days), 0), 1) AS attendance_rate
FROM mv_attendance_summary
WHERE year_month = ANY($1)
GROUP BY year_month, department
ORDER BY department, year_month;
```

**Priority**: High | **Complexity**: Low | **Data Ready**: Yes | **Phase**: 1 | **Estimate**: 10h

---

#### Feature: Leave Pattern Calendar Heatmap

**PMO Value Statement**: Shows PMO when team members are most frequently taking leave — enabling smarter project scheduling, milestone planning, and avoiding understaffed periods.

**Temporal Design:**
- Calendar grid view (GitHub contribution heatmap style)
- Color intensity = number of employees on leave on that date
- Toggle between divisions/departments to see sub-team patterns

**Visualization Design:**
- X-axis: days of the month; Y-axis: week rows
- Color: Light (1-2 on leave) → Dark Blue (3-5 on leave) → Red (>5 on leave)
- Hover tooltip: date + employee names on leave + leave type
- Month selector supports multi-month view (full year calendar)

**Data Requirements:** `attendance` raw table (need per-day status, not just monthly summaries)

**API Endpoint:**
```
GET /api/attendance/calendar?months=2026-03&dept=PS - Delivery Centre HU
Response: { "2026-03-07": { "on_leave": 3, "employees": ["A", "B", "C"] } }
```

**Priority**: Medium | **Complexity**: Medium | **Data Ready**: Yes | **Phase**: 2 | **Estimate**: 14h

---

#### Feature: Manager Team Attendance Scorecard

**PMO Value Statement**: Holds managers accountable for team attendance health by exposing which reporting lines have the best and worst attendance patterns.

**Temporal Design:**
- Table: Manager Name | Direct Reports | Avg Team Attendance Rate | Absent Days (Total) | Leave Utilization | MoM Trend
- Sort by worst performing managers by default
- Each row expands to show individual team members

**Data Requirements:** Join `mv_attendance_summary` with `attendance` (for `reporting_to` column)

**Priority**: Medium | **Complexity**: Medium | **Data Ready**: Yes (column exists) | **Phase**: 2 | **Estimate**: 10h

---

### Category 4: Productivity & Compliance Metrics

---

#### Feature: Timesheet Compliance Funnel (Temporal)

**PMO Value Statement**: Tracks whether employees and managers are submitting and approving timesheets on time — a direct indicator of billing cycle health.

**Temporal Design:**
- Funnel chart: Total Entries → Submitted → Approved (each step shows % pass-through)
- Multi-month line chart showing compliance rate over time
- "Laggard List": Employees with consistently low compliance (declining 3-month trend)

**Data Requirements:** `timelog_raw.approval_status` column

**Database Query:**
```sql
SELECT
  year_month,
  COUNT(*)                                              AS total_entries,
  COUNT(*) FILTER (WHERE approval_status != 'Not Submitted') AS submitted,
  COUNT(*) FILTER (WHERE approval_status = 'Approved')   AS approved,
  ROUND(100.0 * COUNT(*) FILTER (WHERE approval_status = 'Approved') / COUNT(*), 1) AS compliance_rate
FROM timelog_raw
WHERE year_month = ANY($1)
GROUP BY year_month
ORDER BY year_month;
```

**Priority**: High | **Complexity**: Low | **Data Ready**: Yes | **Phase**: 1 | **Estimate**: 8h

---

#### Feature: Productivity Index Trend

**PMO Value Statement**: Measures hours logged per attendance day — a proxy for logging discipline. Improving over time = better logging culture; declining = incomplete submissions.

**Calculation:** `total_hours_logged / present_days` per employee per month

**Temporal Design:**
- Line chart: Productivity Index per department over time
- Table: Dept | Productivity Index | vs. Target | Trend
- Target: 7.5 (assumes 7.5h productive work day out of 8h shift)

**Data Requirements:** Join `mv_resource_summary` (hours) with `mv_attendance_summary` (present_days)

**Priority**: Medium | **Complexity**: Low | **Data Ready**: Yes (requires JOIN) | **Phase**: 2 | **Estimate**: 8h

---

#### Feature: Non-Billable Hours Analysis

**PMO Value Statement**: Identifies where non-project hours are being spent, enabling decisions about overhead reduction, internal initiative scope, and team investment.

**Temporal Design:**
- Stacked area chart: Billable vs. Non-Billable hours by department, across months
- Pie chart: Non-billable breakdown by task type (Internal, Training, Admin, etc.)
- Table: Dept | Total Non-Billable hrs | % of Total | MoM Change

**Data Requirements:** `timelog_raw` — GROUP BY `task_name` WHERE `billable_status != 'Billable'`

**Priority**: Medium | **Complexity**: Low | **Data Ready**: Yes | **Phase**: 2 | **Estimate**: 8h

---

### Category 5: Comparative Analysis

---

#### Feature: Department Racing Bar Chart (Temporal)

**PMO Value Statement**: Creates a competitive, visual understanding of which departments deliver the most effort and how rankings change month-over-month — motivating performance visibility.

**Temporal Design:**
- Animated bar chart where bars race each month (departments re-rank by total hours)
- Static version: Grouped bar chart with one color per month
- Toggle between absolute hours, billable hours, and utilization %

**Priority**: Medium | **Complexity**: Medium | **Data Ready**: Yes | **Phase**: 2 | **Estimate**: 10h

---

#### Feature: Entity-Level Billing Performance

**PMO Value Statement**: For a multi-entity Tinubu structure, surfaces which legal entity (AG Switzerland, Kft Hungary, Inc. Americas, etc.) delivers the highest billable output — critical for inter-company billing and CFO reporting.

**Temporal Design:**
- Bar chart: Entity names on X-axis, billable hours on Y-axis, grouped by month
- KPI row above showing entity with highest/lowest billability rate
- Table: Entity | Headcount | Total Hours | Billable Hours | Billability % | vs. Prior Month

**Data Requirements:** `mv_resource_summary` joined with `attendance` (for entity field)

**Priority**: High | **Complexity**: Low | **Data Ready**: Yes (entity in attendance table) | **Phase**: 2 | **Estimate**: 8h

---

### Category 6: Forecasting & Predictions

---

#### Feature: Capacity Forecast (Linear Projection)

**PMO Value Statement**: Projects next month's available capacity based on the trailing 3-6 month trend, enabling sales teams to commit to new projects with a data-backed delivery estimate.

**Temporal Design:**
- Requires: 3+ months of data
- Method: Simple linear regression on dept-level hours per month
- Output: "Based on the last 4 months, Delivery Unit 3 is projected to have **~480h available** in April 2026"

**Visualization Design:**
- Line chart: Past months (solid line) + projected months (dashed line)
- Confidence band around projection (±10%)
- Department selector to view individual team forecasts

**Database Query:**
```sql
SELECT 
  department, year_month,
  SUM(total_hours) AS monthly_hours
FROM mv_resource_summary
WHERE year_month >= TO_CHAR(NOW() - INTERVAL '6 months', 'YYYY-MM')
GROUP BY department, year_month
ORDER BY department, year_month;
-- Projection done client-side via linear regression
```

**Frontend Calculation (pseudocode):**
```javascript
function linearForecast(monthlyValues) {
  const n = monthlyValues.length;
  const xMean = (n - 1) / 2;
  const yMean = monthlyValues.reduce((a,b) => a+b) / n;
  const slope = monthlyValues.reduce((sum, y, x) => sum + (x - xMean) * (y - yMean), 0)
    / monthlyValues.reduce((sum, _, x) => sum + (x - xMean)**2, 0);
  const intercept = yMean - slope * xMean;
  return intercept + slope * n; // next month projection
}
```

**Priority**: Medium | **Complexity**: Medium | **Data Ready**: Needs 3+ months | **Phase**: 2 | **Estimate**: 12h

---

#### Feature: Leave Forecast (Seasonality Detection)

**PMO Value Statement**: Predicts high-leave periods based on historical patterns — enabling project managers to avoid scheduling critical deliveries during predictably understaffed windows.

**Method:** Average leave days per week-of-year across all historical months, applied as probability signal

**Priority**: Low | **Complexity**: High | **Data Ready**: Needs 6+ months | **Phase**: 3 | **Estimate**: 16h

---

### Category 7: Data Tables & Reports

---

#### Feature: Multi-Month Resource Roster Table

**PMO Value Statement**: The single most-needed report for PMOs — a unified view of every employee's performance across selected months with all dimensions sortable and exportable.

**Temporal Design:**
- Rows: Employees; Columns: Employee ID, Name, Dept, Location, Entity + one column per selected month (showing hours), Grand Total column, utilization % column
- Sortable by: Total hours, MoM change, dept, location, utilization status
- Filterable by: Department, Location, Entity, Division, Manager

**Implementation:** This is an enhancement to the existing Resources → Personnel Directory table.

**Export:** CSV/Excel download button — exports the current filtered view with all month columns

**Database Query:**
```sql
SELECT 
  r.employee_id,
  MAX(r.full_name) AS full_name,
  MAX(r.department) AS department,
  MAX(a.location) AS location,
  r.year_month,
  r.total_hours,
  r.billable_hours
FROM mv_resource_summary r
LEFT JOIN (
  SELECT DISTINCT employee_id, MAX(location) AS location
  FROM attendance WHERE year_month = ANY($1)
  GROUP BY employee_id
) a ON a.employee_id = r.employee_id
WHERE r.year_month = ANY($1)
GROUP BY r.employee_id, r.year_month
ORDER BY r.employee_id, r.year_month;
```

**Priority**: High | **Complexity**: Medium | **Data Ready**: Yes | **Phase**: 1 | **Estimate**: 12h

---

### Category 8: Alerts & Anomaly Detection

---

#### Feature: Automated PMO Alert Feed

**PMO Value Statement**: An always-visible alert panel that proactively surfaces metric threshold violations without requiring the PMO to manually review every chart — serving as the first thing seen on login.

**Alert Types (in priority order):**

| Alert | Condition | Severity |
|---|---|---|
| Overload Alert | Employee total hrs > 160 in current month | 🔴 Critical |
| Bench Alert | Employee total hrs < 40 and marked Present 15+ days | 🟡 Warning |
| Compliance Drop | Department approval rate declined >15% vs prior month | 🟡 Warning |
| Utilization Spike | Dept utilization >100% this month | 🔴 Critical |
| Attendance Decline | Dept attendance rate fell >10% vs prior month | 🟡 Warning |
| Burnout Pattern | Employee >160h for 2 consecutive months | 🔴 Critical |
| Missing Timelog | Employees in attendance but 0 timelog hours for 10+ workdays | 🟡 Warning |

**UI Design:**
- Persistent alert strip below the page header on Overview tab
- Each alert: severity icon + short message + "View" link
- Dismissed alerts don't reappear until condition persists next month
- Alert count badge on the sidebar "Overview" nav item

**Priority**: High | **Complexity**: Medium | **Data Ready**: Yes | **Phase**: 2 | **Estimate**: 16h

---

## Part 4: Implementation Roadmap

### Priority Matrix

| # | Feature | PMO Impact | Complexity | Data Ready | Phase | Est. Hours |
|---|---|---|---|---|---|---|
| 1 | Upload Versioning (Data Correction) | Critical | Medium | ✅ | 1 | 20h |
| 2 | Month-over-Month KPI Cards | High | Low | ✅ | 1 | 8h |
| 3 | Multi-Month Resource Roster Table | High | Medium | ✅ | 1 | 12h |
| 4 | Timesheet Compliance Funnel | High | Low | ✅ | 1 | 8h |
| 5 | Department Utilization Heatmap | High | Medium | ✅ | 1 | 16h |
| 6 | Attendance Rate Trend Chart | High | Low | ✅ | 1 | 10h |
| 7 | Entity-Level Billing Performance | High | Low | ✅ | 2 | 8h |
| 8 | Employee Utilization Trend | High | Medium | ✅ | 2 | 14h |
| 9 | Automated PMO Alert Feed | High | Medium | ✅ | 2 | 16h |
| 10 | Manager Team Attendance Scorecard | Medium | Medium | ✅ | 2 | 10h |
| 11 | Non-Billable Hours Analysis | Medium | Low | ✅ | 2 | 8h |
| 12 | Productivity Index Trend | Medium | Low | ✅ | 2 | 8h |
| 13 | Department Racing Bar Chart | Medium | Medium | ✅ | 2 | 10h |
| 14 | Leave Pattern Calendar Heatmap | Medium | Medium | ✅ | 2 | 14h |
| 15 | Location Utilization Comparison | Medium | Medium | ✅ | 2 | 12h |
| 16 | Capacity Forecast (Linear) | Medium | Medium | ⚠️ Needs 3mo | 2 | 12h |
| 17 | Burnout Risk Early Warning | High | Medium | ⚠️ Needs 3mo | 3 | 10h |
| 18 | Leave Forecast (Seasonality) | Low | High | ⚠️ Needs 6mo | 3 | 16h |

**Phase 1 Total (Weeks 1-2): ~74h across 6 features**  
**Phase 2 Total (Weeks 3-6): ~100h across 9 features**  
**Phase 3 Total (Month 2+): ~26h across 2 features**

---

### Phase Definitions

**Phase 1 — Foundation + Quick Wins (Weeks 1-2)**
> Goal: Deliver the highest-value features immediately, using the existing materialized views. No new DB tables except the upload versioning migration.

- Upload Versioning (Data Correction) — critical user requirement, zero extra complexity
- Month-over-Month KPI Cards — transforms existing cards from static to temporal
- Multi-Month Resource Roster Table — enhances the existing table with month columns
- Timesheet Compliance Funnel — uses existing `approval_status` column
- Department Utilization Heatmap — flagship temporal feature
- Attendance Rate Trend Chart — enables leave and workforce tracking

**Phase 2 — Deep Analytics (Weeks 3-6)**
> Goal: Add comparative analysis, manager visibility, and alert infrastructure.

- Entity-Level Billing, Manager Scorecards, Location Comparison
- Alert Feed — becomes the PMO's "early warning radar"
- Forecast features (capacity) using accumulated multi-month data

**Phase 3 — Intelligence Layer (Month 2+)**
> Goal: Predictive features that require 3-6 months of historical data to be meaningful.

- Burnout Risk algorithm (needs consecutive month history)
- Leave Seasonality forecasting
- ML-based anomaly detection on utilization patterns

---

### Dependencies & Prerequisites

1. ✅ Multi-month API filtering (`?months=...`) — already implemented
2. ✅ All 5 materialized views — already implemented
3. ✅ `mv_attendance_summary` capturing present/absent/leave counts — verified in schema
4. ⚠️ **Upload versioning migration** — small schema change (3 columns on `uploads` table) — must run before Phase 1 delivery
5. ⚠️ **Location field** — `attendance.location` is populated; ensure it propagates to `mv_attendance_summary` or join is defined
6. ⚠️ **Multi-month data** — Burnout and Forecasting features require 3+ months of uploaded data; prioritize uploading historical Excel files early
7. ⚠️ **Authentication** — required before manager-level scorecards and record-level corrections expose personal data to unauthorized users

---

## Appendix A: SQL Query Reference

```sql
-- A1: Month-over-Month KPI Change
WITH ordered AS (
  SELECT year_month, total_hours, billable_hours,
    LAG(total_hours) OVER (ORDER BY year_month)     AS prev_total,
    LAG(billable_hours) OVER (ORDER BY year_month)  AS prev_billable
  FROM mv_kpis_monthly
  WHERE year_month = ANY($1)
)
SELECT *, 
  ROUND((total_hours - prev_total) / NULLIF(prev_total, 0) * 100, 1)     AS total_change_pct,
  ROUND((billable_hours - prev_billable) / NULLIF(prev_billable, 0) * 100, 1) AS billable_change_pct
FROM ordered;

-- A2: Under-utilization alert (employees with attendance but <40h logged)
SELECT a.employee_id, a.employee_name, a.department, a.location,
  a.present_days, COALESCE(r.total_hours, 0) AS hours_logged,
  ROUND(COALESCE(r.total_hours, 0) / NULLIF(a.present_days * 8.0, 0) * 100, 1) AS logging_rate
FROM mv_attendance_summary a
LEFT JOIN mv_resource_summary r USING (employee_id, year_month)
WHERE a.year_month = ANY($1) AND a.present_days >= 10 AND COALESCE(r.total_hours, 0) < 40
ORDER BY hours_logged ASC;

-- A3: Entity-level billing performance
SELECT 
  att.entity, r.year_month,
  SUM(r.total_hours)    AS total_hours,
  SUM(r.billable_hours) AS billable_hours,
  COUNT(DISTINCT r.employee_id) AS headcount,
  ROUND(SUM(r.billable_hours) / NULLIF(SUM(r.total_hours), 0) * 100, 1) AS billability_pct
FROM mv_resource_summary r
JOIN (SELECT DISTINCT employee_id, MAX(entity) AS entity 
      FROM attendance GROUP BY employee_id) att USING (employee_id)
WHERE r.year_month = ANY($1)
GROUP BY att.entity, r.year_month
ORDER BY att.entity, r.year_month;
```

---

## Appendix B: Chart.js Configuration Templates

```javascript
// B1: Heatmap (simulated via matrix of colored table cells — no Chart.js needed)
// Render as an HTML table with dynamic background-color based on utilization %
const getHeatmapColor = (pct) => {
  if (pct >= 100) return 'bg-red-500 text-white';
  if (pct >= 85)  return 'bg-blue-500 text-white';
  if (pct >= 70)  return 'bg-blue-200 text-blue-900';
  if (pct >= 50)  return 'bg-blue-50 text-blue-800';
  return 'bg-surface-container-highest text-outline';
};

// B2: Multi-line utilization trend
const trendChartConfig = {
  type: 'line',
  data: {
    labels: selectedMonths,
    datasets: departments.map((dept, i) => ({
      label: dept.name,
      data: selectedMonths.map(m => deptMonthlyData[dept.id]?.[m]?.utilization_pct || null),
      borderColor: palette[i % palette.length],
      tension: 0.3,
      spanGaps: true,
    }))
  },
  options: {
    responsive: true,
    plugins: { legend: { position: 'right' } },
    scales: {
      y: { min: 0, max: 120, title: { display: true, text: 'Utilization %' } }
    }
  }
};

// B3: Compliance funnel (horizontal bar chart)
const funnelConfig = {
  type: 'bar',
  data: {
    labels: selectedMonths.map(formatMonth),
    datasets: [
      { label: 'Approved',      data: complianceData.map(d => d.approved),   backgroundColor: '#004ac6' },
      { label: 'Submitted',     data: complianceData.map(d => d.submitted - d.approved), backgroundColor: '#acbfff' },
      { label: 'Not Submitted', data: complianceData.map(d => d.not_submitted), backgroundColor: '#ba1a1a' },
    ]
  },
  options: { indexAxis: 'y', scales: { x: { stacked: true } }, plugins: { legend: { position: 'top' } } }
};
```

---

## Appendix C: Upload Versioning Migration Script

```sql
-- Run ONCE as a migration (safe to run on existing schema)
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS uploaded_by TEXT DEFAULT 'system';

-- Update MVs to only use active upload data
-- (Add to WHERE clause in MV queries or create a filtered view)
CREATE VIEW active_timelog AS
  SELECT t.* FROM timelog_raw t
  JOIN uploads u ON u.upload_id = t.upload_id
  WHERE u.is_active = TRUE;

CREATE VIEW active_attendance AS
  SELECT a.* FROM attendance a
  JOIN uploads u ON u.upload_id = a.upload_id
  WHERE u.is_active = TRUE;
```

---

*Document Version 1.0 — March 25, 2026*  
*Based on direct analysis of `Attendance_Musterroll_Report (9).xlsx` and `TimeLog_ALL (63).xlsx`*
