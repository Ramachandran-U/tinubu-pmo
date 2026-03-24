# Tinubu PMO Intelligence Platform — Executive Overview

*For CXOs, Delivery Heads, and PMO Stakeholders*
*March 2026*

---

## What Is This?

The **Tinubu PMO Dashboard** is a web-based command center that turns your monthly Zoho exports into actionable intelligence. Instead of opening Excel files and manually comparing numbers, the PMO team uploads the files once and gets instant access to dashboards, alerts, and trend analysis across your entire global workforce.

**In one sentence:** Upload two Excel files per month, get a live PMO command center.

---

## What Problem Does It Solve?

| Before (Manual Process) | After (PMO Dashboard) |
|---|---|
| Download Excel from Zoho, open in spreadsheet, manually compare months | Upload once, see trends automatically |
| No visibility into who is overloaded or underutilized | Automatic alerts for burnout risk and bench employees |
| Entity billing requires manual cross-referencing | One-click entity comparison across all 6 legal entities |
| Attendance data sits in a separate file, never cross-referenced | Attendance and timesheets combined in a single view |
| Compliance tracking requires counting cells in Excel | Real-time compliance funnel with approval rates |
| No forecasting or trend detection | Linear capacity forecasts and leave seasonality patterns |
| Each stakeholder asks for a different cut of the data | Self-service: filter by month, department, location, entity |

---

## Who Uses It?

| Role | What They See |
|---|---|
| **CXO / Leadership** | Executive Summary — total hours, billability rate, headcount, attendance pulse, MoM trends |
| **PMO Director** | Alert feed (overload, bench, compliance drops), department heatmap, capacity forecast |
| **Delivery Head** | Resource roster, utilization by department, employee trend with burnout risk flags |
| **Finance Controller** | Entity-level billing performance, billability rates by entity, non-billable breakdown |
| **HR / People Ops** | Attendance trends, leave calendar, manager attendance scorecards |
| **Resource Manager** | Employee utilization grid, location comparison, bench identification |

---

## What Data Goes In?

Two Excel files exported from Zoho People, uploaded monthly:

| File | What It Contains | Example |
|---|---|---|
| **Time Log** | Every time entry: who worked, on what project, for which client, how many hours, billable or not | `TimeLog_ALL (63).xlsx` — 2,805 entries |
| **Attendance Muster Roll** | Daily status per employee: Present, Absent, Leave, Weekend, Holiday | `Attendance_Musterroll_Report (9).xlsx` — 3,503 records |

**Upload takes ~2 seconds.** The system parses the Excel, stores it in a database, and refreshes all dashboards instantly.

---

## What Comes Out?

### 1. Executive Summary (Overview Tab)

The first thing you see when you log in:

- **5 KPI Cards** with month-over-month trend arrows and sparklines:
  - Total Hours | Billable Hours | Active Projects | Attendance Rate | Headcount
- **PMO Alert Feed** — automatic notifications:
  - "Szabolcs Albert Fekete logged 204h (exceeds 160h threshold)" [Critical]
  - "Thiru Sivasubramanian present 17d with zero time logged" [Warning]
- **Client Allocation Chart** — which clients consume the most effort
- **Approval Breakdown** — how many timesheets are approved vs pending

### 2. Resource Intelligence (Resources Tab)

- **Multi-Month Resource Roster** — every employee, every month, side by side
  - Color-coded: red = overloaded (>160h), amber = high (>120h)
  - Utilization % with visual progress bars
  - Filterable by name, department, location
  - **CSV Export** button for sharing with managers
- **Department & Location Charts** — where your people are and how they're allocated

### 3. Workload & Compliance (Utilization Tab)

Four sub-sections accessible via tabs:

| Section | What It Shows |
|---|---|
| **Daily Effort** | Stacked bar chart: billable vs non-billable hours per day |
| **Compliance Funnel** | How many timesheet entries are Approved → Submitted → Not Submitted |
| **Department Heatmap** | Color grid showing utilization % per department per month |
| **Attendance Trend** | Line chart showing attendance rates by department over time |

### 4. Deep Analytics (Analytics Tab)

Eleven specialized views:

| View | Business Question It Answers |
|---|---|
| **Entity Billing** | Which legal entity has the highest billability? |
| **Employee Trend** | Who has been consistently overloaded or underutilized for months? |
| **Non-Billable** | Where are non-project hours going? (Training, admin, configuration) |
| **Productivity Index** | How many hours per present day are employees logging? (Target: 7.5h) |
| **Department Ranking** | Which departments deliver the most hours? Toggle between total/billable/utilization |
| **Manager Scorecard** | Which departments have the worst attendance? |
| **Leave Calendar** | GitHub-style heatmap: when do people take leave? Filter by department |
| **Location Comparison** | How do Zurich, Budapest, Princeton, Bangalore compare? |
| **Capacity Forecast** | Based on trends, what capacity is projected next month? |
| **Burnout Risk** | Who has worked >160h for consecutive months? 4-tier risk flagging |
| **Leave Patterns** | What day of the week has the most leave? What week of the month? |

### 5. Data Management (Timesheet Tab)

- **Drag-and-drop upload** for both file types
- **Active Data Versions** — see which version of each file is currently loaded
- **Attendance Muster Roll** — present/absent counts per employee

---

## How Does It Work? (Non-Technical)

```
Step 1: PMO team downloads Excel from Zoho (monthly routine)
            ↓
Step 2: Opens the dashboard → Timesheet tab → drags file onto the upload zone
            ↓
Step 3: System automatically:
        - Reads the Excel file
        - Extracts and validates every row
        - Stores it in a database
        - Assigns a version number (v1, v2, v3...)
        - Refreshes all calculations
            ↓
Step 4: All dashboards, charts, and alerts update instantly
            ↓
Step 5: Any stakeholder can filter by month, department, or location
        and see real-time analytics without touching Excel
```

**If data needs correction:** Simply re-upload the corrected file. The system creates a new version (v2) and marks the old one as inactive. Full audit trail is maintained.

---

## Key Metrics Tracked

| Category | Metrics |
|---|---|
| **Hours** | Total logged, billable, non-billable, per-employee, per-department, per-client, per-entity |
| **Utilization** | Hours / (FTE x 160h) per department and location, with color-coded thresholds |
| **Billability** | Billable hours / total hours, tracked at employee, department, entity, and company level |
| **Compliance** | Timesheet approval rates: approved, pending, draft, not submitted |
| **Attendance** | Present days, absent days, leave days, holiday days, attendance rate % |
| **Headcount** | Total employees, time-logging subset, overhead ratio (26% non-billing) |
| **Risk** | Burnout flags (>160h sustained), bench flags (<40h with high presence), missing timelogs |
| **Forecast** | Linear projection of next month's department capacity |

---

## Current Data Profile (March 2026)

| Metric | Value |
|---|---|
| Total Hours Logged | 9,087 hours |
| Billable Hours | 3,287 hours (36% billability) |
| Time-Logging Employees | 89 |
| Total Tracked Employees | 113 |
| Overhead Headcount | 29 (26% — G&A/Finance/HR roles) |
| Compliance Rate | 81% approved |
| Burnout Flags | 2 employees (Szabolcs: 204h, Gergely: 175h) |
| Legal Entities | 6 |
| Office Locations | 9 |

---

## What's Next? (Planned Enhancements)

| Enhancement | Business Value |
|---|---|
| **User Authentication** | Role-based access — admins upload, managers see their teams, viewers see dashboards |
| **Project Profitability** | Budget vs actuals per project, burn rate tracking, SOW value comparison |
| **Portfolio Management** | Active projects with milestone timelines, risk flags for over-budget projects |
| **Data Export** | Download any table or chart as CSV or Excel directly from the dashboard |
| **Dark Mode** | Visual preference toggle for extended screen time |
| **Global Search** | Search any employee, project, or client from the header bar |
| **Skills Matrix** | Map employee skills to projects for better allocation decisions |
| **Automated Import** | Scheduled pickup of Excel files from a shared folder — no manual upload needed |

---

## Access

- **URL:** http://localhost:5173 (development) or deployed internal URL
- **Source Code:** https://github.com/Ramachandran-U/tinubu-pmo
- **Data Required:** Monthly Zoho exports (Time Log + Attendance Muster Roll)
- **No login required** (currently) — planned for Phase 4

---

*This document provides a non-technical overview. For technical architecture, API reference, and database schema, see `product-technical-document.md`.*
*For the detailed Phase 4 enhancement plan, see `Phase4_Enhancement_Plan.md`.*
