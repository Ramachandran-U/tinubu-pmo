# Tinubu PMO Intelligence Platform — Executive Overview

*For CXOs, Delivery Heads, and PMO Stakeholders*
*March 2026 — v3.0*

---

## What Is This?

The **Tinubu PMO Dashboard** is a web-based command center that turns your monthly Zoho exports into actionable intelligence. Instead of opening Excel files and manually comparing numbers, the PMO team uploads the files once and gets instant access to dashboards, alerts, and trend analysis across your entire global workforce.

**In one sentence:** Upload three Excel files, get a live PMO command center with squad-based views, attendance grids, and compliance tracking.

---

## What Problem Does It Solve?

| Before (Manual Process) | After (PMO Dashboard) |
|---|---|
| Download Excel from Zoho, open in spreadsheet, manually compare months | Upload once, see trends automatically |
| No visibility into who is overloaded or underutilized | Automatic alerts for burnout risk and bench employees |
| Entity billing requires manual cross-referencing | One-click entity comparison across all 6 legal entities |
| Attendance data sits in a separate file, never cross-referenced | Attendance grid with color-coded daily status + timesheet compliance tracking |
| Compliance tracking requires counting cells in Excel | Real-time compliance funnel + per-employee missed timesheet report |
| No squad-level visibility | Toggle between Department and Squad views across all tabs |
| Skye project hours inflate reports | Skye projects automatically excluded from all metrics |
| No forecasting or trend detection | Linear capacity forecasts and leave seasonality patterns |
| Each stakeholder asks for a different cut of the data | Self-service: filter by month, squad, department, location |

---

## Who Uses It?

| Role | What They See |
|---|---|
| **CXO / Leadership** | Portfolio Summary — total hours, billability rate, headcount, attendance pulse, approval %, MoM trends |
| **PMO Director** | Alert feed (overload, bench, compliance drops), department/squad heatmap, capacity forecast |
| **Delivery Head** | Squad allocation, resource roster with heatmap, employee trend with burnout risk flags |
| **Finance Controller** | Entity-level billing performance, billability rates by entity, non-billable breakdown |
| **HR / People Ops** | Attendance grid (daily status per employee), leave calendar, manager attendance scorecards |
| **Resource Manager** | Designation-wise resource count, billable/non-billable by location, timesheet compliance tracker |

---

## What Data Goes In?

Three Excel files, uploaded via drag-and-drop:

| File | What It Contains | Frequency |
|---|---|---|
| **Time Log** | Every time entry: who worked, on what project, for which client, how many hours, billable or not | Monthly |
| **Attendance Muster Roll** | Daily status per employee: Present, Absent, Leave, Weekend, Holiday | Monthly |
| **Demand Capacity** | Squad allocation: employee to project/squad mapping, designation, billability, location | As needed |

**Upload takes ~2 seconds.** The system parses the Excel, stores it in a database, and refreshes all dashboards instantly.

---

## What Comes Out?

### 1. Portfolio (formerly Overview Tab)

The first thing you see when you log in:

- **6 KPI Cards** with month-over-month trend arrows and sparklines:
  - Total Hours | Billable Hours | Active Projects | Attendance Rate | Headcount | **Approval %**
- **PMO Alert Feed** — automatic notifications for overload, bench, missing timesheets
- **Designation-wise Resource Count** — bar chart showing how many SAs, BAs, QAs, PMs, etc.
- **Timesheet Approval Status** — doughnut chart + approval breakdown with progress bars
- **Pending Actions** — real breakdown of pending, not submitted, and draft timesheet hours
- Info badge: "Excluding Skye projects from all reports"

### 2. Resource Intelligence (Resources Tab)

- **Squad Allocation Chart** — billable vs non-billable resources per squad (Everest, Rebranding, Mejoras, etc.)
- **Billable vs Non-Billable by Location** — stacked bar chart (India, Hungary, HongKong, Spain)
- **Multi-Month Resource Roster** with heatmap coloring:
  - Color scale: light blue (1-80h) → blue (81-160h) → orange (161-200h) → red (200h+)
  - Switch between Department/Squad column via global toggle
  - **CSV Export** button for sharing with managers
- **Squad Filter** — filter by project-based squad names

### 3. Workload & Compliance (Utilization Tab)

Four sub-sections accessible via tabs:

| Section | What It Shows |
|---|---|
| **Daily Effort** | Stacked bar chart: billable vs non-billable hours per day |
| **Compliance Funnel** | How many timesheet entries are Approved → Submitted → Not Submitted |
| **Department Heatmap** | Color grid showing utilization % per department per month |
| **Attendance Trend** | Line chart showing attendance rates by department over time |

### 4. Deep Analytics (Analytics Tab)

Eleven specialized views covering Entity Billing, Employee Trends, Non-Billable Analysis, Productivity Index, Department Ranking, Manager Scorecard, Leave Calendar, Location Comparison, Capacity Forecast, Burnout Risk, and Leave Patterns.

### 5. Timesheet & Attendance (Timesheet Tab)

Three sub-sections:

| Section | What It Shows |
|---|---|
| **Attendance Grid** | Full employee x day grid with color-coded cells (P=Present/blue, A=Absent/red, W=Weekend/gray, H=Holiday/purple, VH=Vacation/orange, SLR=Sick Leave/yellow). Grouped by department or squad (toggle). Search, department, and location filters. Summary columns for Present/Absent/Leave counts. |
| **Submission Compliance** | Monthly compliance summary cards + **Per-Employee Missed Timesheet Report** showing: Employee, Squad, Working Days, Days Logged, Missed Days, Compliance % (color-coded: green >=95%, yellow 80-94%, red <80%). Sorted by worst offenders first. |
| **Data Upload** | Drag-and-drop upload zones for Timelog, Attendance, and Demand Capacity files. Active version display. |

---

## Department/Squad Toggle

A global toggle in the header bar lets users switch between **Department view** and **Squad view**:

- **Department**: Groups and labels data by organizational department (from Zoho)
- **Squad**: Groups and labels data by project/squad (from Demand Capacity file — e.g., Everest, Rebranding, Mejoras, SolEng, Product, TBD)

This toggle affects the Resources roster, Timesheet attendance grid, and compliance report.

---

## Key Metrics Tracked

| Category | Metrics |
|---|---|
| **Hours** | Total logged, billable, non-billable, per-employee, per-department, per-client, per-entity, per-squad |
| **Utilization** | Hours / (FTE x 160h) per department and location, with color-coded thresholds |
| **Billability** | Billable hours / total hours at employee, department, entity, squad, and company level |
| **Compliance** | Timesheet approval rates + per-employee missed submission days |
| **Attendance** | Daily status grid, present/absent/leave days, attendance rate % |
| **Headcount** | Total employees, designation breakdown (SA, BA, QA, PM, etc.), squad allocation |
| **Risk** | Burnout flags (>160h sustained), bench flags (<40h with high presence), missing timelogs |
| **Forecast** | Linear projection of next month's department capacity |

---

## Current Data Profile (March 2026)

| Metric | Value |
|---|---|
| Total Hours Logged (excl. Skye) | 7,576 hours |
| Billable Hours | ~2,600 hours |
| Skye Hours Excluded | 1,511 hours (569 entries) |
| Time-Logging Employees | 84 |
| Total Tracked Employees | 113 |
| Demand Capacity Employees | 64 (with squad mapping) |
| Squads (Projects) | 19 (Everest, Rebranding, Mejoras, SolEng, Product, TBD, etc.) |
| Designations | 22 (System Analyst, Test Engineer, Business Analyst, etc.) |
| Legal Entities | 6 |
| Office Locations | 9 |

---

## Access

- **URL:** http://localhost:5173 (development) or deployed internal URL
- **Source Code:** https://github.com/Ramachandran-U/tinubu-pmo
- **Data Required:** Monthly Zoho exports (Time Log + Attendance) + Demand Capacity file
- **No login required** (currently) — planned for Phase 4

---

*This document provides a non-technical overview. For technical architecture, API reference, and database schema, see `product-technical-document.md`.*
*For the LLM handover guide, see `LLM_Handover_Guide.md`.*
*For the detailed Phase 4 enhancement plan, see `Phase4_Enhancement_Plan.md`.*
