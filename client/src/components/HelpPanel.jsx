import { useState } from 'react';

const SECTIONS = [
  {
    id: 'portfolio',
    icon: 'dashboard',
    title: 'Portfolio (Executive Summary)',
    description: 'High-level overview of the entire PMO performance. This is your starting point for understanding workforce output, billing efficiency, and compliance.',
    items: [
      {
        title: 'Total Hours KPI',
        logic: 'Sum of all hours from timelog_raw for the selected months, excluding Skye projects.',
        formula: 'SUM(hours) WHERE year_month IN selected_months AND project/client NOT LIKE "Skye"'
      },
      {
        title: 'Billable Hours KPI',
        logic: 'Hours where billable_status = "Billable". The billability rate is (Billable Hours / Total Hours) x 100.',
        formula: 'Billability % = (Billable Hours / Total Hours) x 100'
      },
      {
        title: 'Approval % KPI',
        logic: 'Percentage of total hours that have been approved by managers. Color-coded: Green (>=90%), Yellow (70-89%), Red (<70%).',
        formula: 'Approval % = (Approved Hours / Total Hours) x 100'
      },
      {
        title: 'Designation-wise Resource Count',
        logic: 'Counts distinct employees per job title from the Demand Capacity file. Shows how many System Analysts, Business Analysts, QA Engineers, etc. are available.',
        formula: 'COUNT(DISTINCT employee_id) GROUP BY designation_name FROM demand_capacity'
      },
      {
        title: 'Timesheet Approvals Doughnut',
        logic: 'Breaks down total hours into 4 categories: Approved, Pending, Draft, and Not Submitted. Data comes from the approval_status field in timelog entries.',
      },
      {
        title: 'Pending Actions',
        logic: 'Shows real-time count of hours that need attention: pending review, not submitted, and draft. This helps PMO identify action items immediately.',
      },
      {
        title: 'PMO Alert Feed',
        logic: 'Auto-generated alerts based on 4 rules:\n- Overload: Employee logged >160h in selected period\n- Bench: Employee present 15+ days but logged <40h\n- Utilization Spike: Department at >100% utilization\n- Missing Timelog: Employee present 10+ days with zero hours logged',
      },
      {
        title: 'MoM Trend Badges',
        logic: 'Compares the latest selected month against the previous month. Shows percentage change with up/down arrows. Sparklines show the trend across all available months.',
      },
      {
        title: 'Skye Exclusion',
        logic: 'All Skye projects are excluded from every metric on the dashboard. This is applied at the database level (materialized views) and in every raw query. An info badge confirms this is active.',
      }
    ]
  },
  {
    id: 'resources',
    icon: 'group',
    title: 'Resources',
    description: 'Squad-level and individual resource allocation, billability by location, and a multi-month roster with heatmap visualization.',
    items: [
      {
        title: 'Squad Allocation Chart',
        logic: 'Groups employees by their Project/Squad from the Demand Capacity file (e.g., Everest, Rebranding, Mejoras). Shows billable vs non-billable count per squad as a stacked bar chart.',
        formula: 'COUNT(employee_id) GROUP BY project, FILTER by billable_status FROM demand_capacity'
      },
      {
        title: 'Billable vs Non-Billable by Location',
        logic: 'Horizontal stacked bar showing how many employees at each location (India, Hungary, HongKong, Spain) are billable vs non-billable, based on Demand Capacity data.',
      },
      {
        title: 'Multi-Month Roster with Heatmap',
        logic: 'Shows every employee with their hours per month in a grid. Cells are color-coded by intensity:\n- Light Blue (1-80h): Low activity\n- Blue (81-120h): Normal\n- Dark Blue (121-160h): Full capacity\n- Orange (161-200h): High — approaching overload\n- Red (200h+): Critical — burnout risk',
        formula: 'Hours per employee per month from mv_resource_summary'
      },
      {
        title: 'Utilization % Column',
        logic: 'Shows billable hours as a percentage of total hours for each employee. This indicates how much of their time is directly revenue-generating.',
        formula: 'Utilization % = (Billable Hours / Total Hours) x 100'
      },
      {
        title: 'Squad Filter',
        logic: 'Filters the roster by project/squad from the Demand Capacity file. Squads include: Everest, Rebranding, Mejoras, SolEng, Product, TBD, etc.',
      },
      {
        title: 'Department/Squad Toggle',
        logic: 'Global toggle in the header bar. When set to "Squad", the roster shows the Project assignment from Demand Capacity instead of the Zoho department. Affects Resources, Timesheet, and Compliance views.',
      },
      {
        title: 'CSV Export',
        logic: 'Downloads the entire filtered roster as a CSV file with columns: Employee ID, Name, Squad/Department, Location, monthly hours, grand total, billable total, and utilization %.',
      }
    ]
  },
  {
    id: 'utilization',
    icon: 'speed',
    title: 'Utilization',
    description: 'Workload intensity analysis across 4 sub-sections: Daily Effort, Compliance Funnel, Department Heatmap, and Attendance Trend.',
    items: [
      {
        title: 'Daily Effort Distribution',
        logic: 'Stacked bar chart showing billable and non-billable hours for each calendar day. Helps identify patterns like low-effort Fridays or spike days before deadlines.',
        formula: 'SUM(hours) GROUP BY date, SPLIT BY billable_status'
      },
      {
        title: 'Compliance Funnel',
        logic: 'Per-month breakdown of timesheet entries into: Approved, Submitted (not yet approved), and Not Submitted. The compliance rate line shows the approval trend.',
        formula: 'Compliance Rate = (Approved entries / Total entries) x 100'
      },
      {
        title: 'Department Utilization Heatmap',
        logic: 'Grid of departments x months. Each cell shows the utilization % for that department in that month. Color-coded:\n- Gray (<50%): Underutilized\n- Light Blue (50-70%): Below target\n- Blue (70-85%): On target\n- Dark Blue (85-100%): High\n- Red (>100%): Over-capacity',
        formula: 'Utilization % = Total Dept Hours / (Headcount x 160h) x 100\n160h = assumed FTE monthly capacity'
      },
      {
        title: 'Attendance Rate Trend',
        logic: 'Multi-line chart showing attendance rate % by department over time (top 8 departments by headcount). Helps spot departments with declining attendance.',
        formula: 'Attendance % = Present Days / (Present + Absent + Leave Days) x 100'
      },
      {
        title: 'Raw Timesheet Table',
        logic: 'Paginated table of individual time entries showing employee, project, client, task, hours, billing status, and approval status. Shows top 200 entries for the selected period.',
      }
    ]
  },
  {
    id: 'analytics',
    icon: 'insights',
    title: 'Analytics',
    description: 'Deep-dive analytics with 11 specialized views for entity billing, employee trends, non-billable analysis, and predictive insights.',
    items: [
      {
        title: 'Entity Billing',
        logic: 'Compares billing performance across the 6 legal entities (AG Switzerland, Kft Hungary, Inc Americas, India Inc, Limited HK, SL Spain). Shows total hours, billability %, and headcount per entity.',
      },
      {
        title: 'Employee Utilization Trend',
        logic: 'Monthly hours per employee with rolling average. Employees are flagged with status badges: At Risk (>160h), High (120-160h), Healthy (40-120h), Bench (<40h).',
      },
      {
        title: 'Burnout Risk Detection',
        logic: '4-tier risk system based on consecutive month analysis:\n- Critical: 3+ consecutive months >160h\n- High: 2 consecutive months >160h\n- Elevated: 3+ consecutive months >130h\n- Watch: Current month >160h',
      },
      {
        title: 'Non-Billable Analysis',
        logic: 'Breaks down non-billable hours by task type (Training, Configuration, Admin, etc.) and by department. Helps identify where non-revenue time is being spent.',
      },
      {
        title: 'Productivity Index',
        logic: 'Hours logged per present day by department. Target is 7.5h/day. Departments below target may have logging gaps or inefficiencies.',
        formula: 'Productivity = Total Hours / Present Days'
      },
      {
        title: 'Leave Forecast',
        logic: 'Analyzes historical leave patterns to predict high-leave periods. Shows patterns by day-of-week, week-of-month, and monthly trends. Identifies top leave takers.',
      },
      {
        title: 'Capacity Forecast',
        logic: 'Linear projection of next month\'s department capacity based on recent trends. Helps with resource planning and allocation decisions.',
      }
    ]
  },
  {
    id: 'timesheet',
    icon: 'schedule',
    title: 'Timesheet & Attendance',
    description: 'Data upload hub, full attendance grid, and timesheet submission compliance tracking.',
    items: [
      {
        title: 'Attendance Grid',
        logic: 'Full employee x day matrix showing daily attendance status. Each cell is color-coded:\n- P (Blue): Present\n- A (Red): Absent\n- W (Gray): Weekend\n- H (Purple): Holiday\n- VH/VRL/VEL (Orange): Various vacation types\n- SLR/SL (Yellow): Sick leave\n- CL (Pink): Casual leave\nGrouped by Department or Squad (toggle). Summary columns show Present, Absent, and Leave day totals.',
      },
      {
        title: 'Submission Compliance Report',
        logic: 'Cross-references attendance (present days) with timesheet entries (days with hours logged) for each employee. Identifies who is present at work but not logging time.\n- Working Days: Days marked Present in attendance\n- Days Logged: Distinct days with timesheet entries (>0h)\n- Missed Days: Working Days - Days Logged\n- Compliance %: (Days Logged / Working Days) x 100',
        formula: 'Compliance % = (Days with timesheet / Present days) x 100\nGreen: >=95% | Yellow: 80-94% | Red: <80%'
      },
      {
        title: 'Data Upload',
        logic: 'Three upload zones for the data files:\n- **Zoho Time Log**: Monthly timesheet export with hours, projects, approval status\n- **Zoho Attendance**: Daily attendance muster roll with presence/absence status\n- **Demand Capacity**: Squad allocation file mapping employees to projects/squads\n\nEach upload creates a new version. Old versions are deactivated but preserved in the audit trail.',
      },
      {
        title: 'Upload Versioning',
        logic: 'Every upload gets a version number (v1, v2, v3...). Only the latest version is active. Previous versions are kept for audit but their data is replaced. The system shows which version is currently active for each period.',
      },
      {
        title: 'Monthly Approval Compliance',
        logic: 'Monthly aggregate table showing total entries, approved count, pending count, not submitted count, and overall compliance rate per month.',
      }
    ]
  },
  {
    id: 'chatbot',
    icon: 'smart_toy',
    title: 'PMO Assistant (Chatbot)',
    description: 'A rule-based chatbot that answers questions about your PMO data in plain English. No API or LLM required — it runs entirely on pattern matching and database queries.',
    items: [
      {
        title: 'How It Works',
        logic: 'The chatbot matches your question against 30+ predefined patterns using regex. When a match is found, it runs the corresponding database query and formats the result into a conversational response. It respects the currently selected months from the MonthPicker.',
      },
      {
        title: 'Supported Topics',
        logic: 'Portfolio: hours, billability, projects, approval %, designations\nResources: top/bottom performers, squad allocation, squad members, locations\nUtilization: department utilization, overloaded employees, bench detection, daily effort\nAttendance: rates, absences, leave takers, department attendance\nCompliance: missed timesheets, approval rates, unapproved entries, upload history\nAnalytics: entities, clients, productivity, location comparison, Skye data',
      },
      {
        title: 'Tips',
        logic: 'Use natural questions like "Who logged the most hours?" or "Show squad allocation". Type "help" for the full list of capabilities. If the bot doesn\'t understand, it will suggest similar questions you can try.',
      }
    ]
  },
  {
    id: 'data',
    icon: 'database',
    title: 'Data Model & Exclusions',
    description: 'Understanding the data sources, calculations, and exclusions applied across the dashboard.',
    items: [
      {
        title: 'Data Sources',
        logic: 'Three Excel files feed the dashboard:\n1. **Zoho Time Log**: Individual time entries (who, what project, how many hours, billable/not, approved/not)\n2. **Zoho Attendance Muster Roll**: Daily attendance status per employee (Present, Absent, Leave, etc.)\n3. **Demand Capacity**: Squad/project allocation, designation, billability, location per employee',
      },
      {
        title: 'Skye Project Exclusion',
        logic: 'All entries where project_name or client_name contains "Skye" (case-insensitive) are excluded from every metric. This is applied at the database level in all materialized views and in all raw queries. Currently excludes 569 entries totaling ~1,511 hours.',
      },
      {
        title: 'FTE Capacity Assumption',
        logic: 'The dashboard assumes 160 hours/month as full-time equivalent (FTE) capacity. This is used to calculate utilization percentages. Formula: Utilization % = Actual Hours / (Headcount x 160) x 100.',
      },
      {
        title: 'Materialized Views',
        logic: 'The database pre-computes 6 materialized views for performance. These are refreshed after every upload:\n- mv_resource_summary: Per-employee monthly hours\n- mv_kpis_monthly: Global monthly aggregates\n- mv_client_hours: Hours per client\n- mv_dept_hours: Hours per department\n- mv_attendance_summary: Attendance day counts\n- mv_squad_summary: Squad allocation summary',
      },
      {
        title: 'Department vs Squad',
        logic: 'Department comes from the Zoho system (organizational structure). Squad comes from the Demand Capacity file\'s Project column (project-based teams like Everest, Rebranding, Mejoras). The global toggle in the header lets you switch between these two views.',
      }
    ]
  }
];

export default function HelpPanel({ isOpen, onClose }) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col animate-fade-in">
        {/* Header */}
        <div className="bg-[#004ac6] px-6 py-5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-white text-2xl">help</span>
              <div>
                <h2 className="text-lg font-bold text-white">Help Center</h2>
                <p className="text-xs text-white/70">Section explanations, formulas, and logic</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {SECTIONS.map(section => (
            <div key={section.id} className="border-b border-slate-100">
              {/* Section header */}
              <button
                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                className="w-full px-6 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-[#004ac6]/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#004ac6] text-lg">{section.icon}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
                </div>
                <span className={`material-symbols-outlined text-slate-400 transition-transform ${expandedSection === section.id ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>

              {/* Section items */}
              {expandedSection === section.id && (
                <div className="px-6 pb-4 space-y-1">
                  {section.items.map((item, idx) => {
                    const itemKey = `${section.id}-${idx}`;
                    const isExpanded = expandedItem === itemKey;
                    return (
                      <div key={idx} className="rounded-lg border border-slate-100 overflow-hidden">
                        <button
                          onClick={() => setExpandedItem(isExpanded ? null : itemKey)}
                          className="w-full px-4 py-3 flex items-center gap-2 hover:bg-slate-50 transition-colors text-left"
                        >
                          <span className={`material-symbols-outlined text-sm transition-transform ${isExpanded ? 'rotate-90 text-[#004ac6]' : 'text-slate-400'}`}>
                            chevron_right
                          </span>
                          <span className="text-sm font-semibold text-slate-800">{item.title}</span>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-0 ml-6">
                            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{item.logic}</p>
                            {item.formula && (
                              <div className="mt-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Formula / Query</p>
                                <code className="text-xs text-[#004ac6] font-mono whitespace-pre-line">{item.formula}</code>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400 text-sm">info</span>
          <p className="text-[10px] text-slate-500">All metrics exclude Skye projects. FTE capacity assumed as 160h/month. Data refreshed on each upload.</p>
        </div>
      </div>
    </div>
  );
}
