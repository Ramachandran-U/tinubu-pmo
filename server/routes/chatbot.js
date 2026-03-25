const express = require('express');
const { pool } = require('../db');
const shared = require('./shared');
const { SKYE_EXCLUSION } = require('./shared');

const router = express.Router();
router.use(shared);

// ════════════════════════════════════════════════════════════════
// Intent definitions: pattern → handler
// Each intent has: patterns (regex), handler (async fn → string), category
// ════════════════════════════════════════════════════════════════

function buildIntents(months, monthClause, params) {
  return [
    // ── PORTFOLIO / OVERVIEW ──
    {
      category: 'portfolio',
      patterns: [/total\s*hours/i, /how\s*many\s*hours/i, /hours\s*logged/i, /total\s*effort/i],
      handler: async () => {
        const r = await pool.query(`SELECT COALESCE(SUM(total_hours),0) as hrs, COALESCE(SUM(billable_hours),0) as bill FROM mv_kpis_monthly ${monthClause}`, params);
        const { hrs, bill } = r.rows[0];
        const pct = Number(hrs) > 0 ? Math.round(Number(bill) / Number(hrs) * 100) : 0;
        return `Total hours logged: **${Number(hrs).toLocaleString()}h** (${Number(bill).toLocaleString()}h billable, ${pct}% billability rate).`;
      }
    },
    {
      category: 'portfolio',
      patterns: [/billable|billability/i],
      handler: async () => {
        const r = await pool.query(`SELECT COALESCE(SUM(total_hours),0) as hrs, COALESCE(SUM(billable_hours),0) as bill FROM mv_kpis_monthly ${monthClause}`, params);
        const pct = Number(r.rows[0].hrs) > 0 ? Math.round(Number(r.rows[0].bill) / Number(r.rows[0].hrs) * 100) : 0;
        return `Billability rate: **${pct}%** (${Number(r.rows[0].bill).toLocaleString()}h billable out of ${Number(r.rows[0].hrs).toLocaleString()}h total).`;
      }
    },
    {
      category: 'portfolio',
      patterns: [/how\s*many\s*(active\s*)?projects/i, /project\s*count/i, /number\s*of\s*projects/i],
      handler: async () => {
        const r = await pool.query(`SELECT COUNT(DISTINCT project_name) as cnt FROM timelog_raw WHERE ${SKYE_EXCLUSION} ${months ? 'AND year_month = ANY($1::text[])' : ''}`, params);
        return `There are **${r.rows[0].cnt} active projects** in the selected period (excluding Skye).`;
      }
    },
    {
      category: 'portfolio',
      patterns: [/approval|approved|pending\s*timesheet|timesheet\s*status/i],
      handler: async () => {
        const r = await pool.query(`SELECT approval_status, SUM(hours) as hrs FROM timelog_raw WHERE ${SKYE_EXCLUSION} ${months ? 'AND year_month = ANY($1::text[])' : ''} GROUP BY approval_status`, params);
        const map = {};
        r.rows.forEach(row => { map[row.approval_status || 'Pending'] = Number(row.hrs); });
        const total = Object.values(map).reduce((a, b) => a + b, 0);
        const approved = map['Approved'] || 0;
        const pct = total > 0 ? Math.round(approved / total * 100) : 0;
        return `Timesheet approval: **${pct}% approved** (${approved.toLocaleString()}h / ${total.toLocaleString()}h).\n- Approved: ${(map['Approved'] || 0).toLocaleString()}h\n- Pending: ${(map['Pending'] || 0).toLocaleString()}h\n- Draft: ${(map['Draft'] || 0).toLocaleString()}h\n- Not Submitted: ${(map['Not Submitted'] || 0).toLocaleString()}h`;
      }
    },
    {
      category: 'portfolio',
      patterns: [/headcount|how\s*many\s*(employees|people|staff|resources)/i, /total\s*employees/i],
      handler: async () => {
        const tl = await pool.query(`SELECT COUNT(DISTINCT employee_id) as cnt FROM timelog_raw WHERE ${SKYE_EXCLUSION} ${months ? 'AND year_month = ANY($1::text[])' : ''}`, params);
        const att = await pool.query(`SELECT COUNT(DISTINCT employee_id) as cnt FROM attendance ${monthClause}`, params);
        return `Headcount: **${att.rows[0].cnt} employees tracked** in attendance, **${tl.rows[0].cnt} actively logging time**.`;
      }
    },
    {
      category: 'portfolio',
      patterns: [/designation|how\s*many\s*(sa|ba|qa|pm|scrum)/i, /role\s*breakdown|job\s*titles/i],
      handler: async () => {
        const r = await pool.query(`SELECT designation_name, COUNT(DISTINCT employee_id) as cnt FROM demand_capacity WHERE designation_name != '' GROUP BY designation_name ORDER BY cnt DESC LIMIT 10`);
        if (r.rows.length === 0) return 'No designation data available. Please upload the Demand Capacity file.';
        const lines = r.rows.map(row => `- ${row.designation_name}: **${row.cnt}**`);
        return `Top designations by resource count:\n${lines.join('\n')}`;
      }
    },

    // ── RESOURCES ──
    {
      category: 'resources',
      patterns: [/top\s*(resources|employees|performers)/i, /who\s*(logged|worked)\s*(the\s*)?most/i, /highest\s*hours/i],
      handler: async () => {
        const r = await pool.query(`SELECT MAX(full_name) as name, SUM(total_hours) as hrs, SUM(billable_hours) as bill FROM mv_resource_summary ${monthClause} GROUP BY employee_id ORDER BY hrs DESC LIMIT 5`, params);
        const lines = r.rows.map((row, i) => `${i + 1}. **${row.name}** — ${Number(row.hrs).toLocaleString()}h (${Number(row.bill).toLocaleString()}h billable)`);
        return `Top 5 resources by hours:\n${lines.join('\n')}`;
      }
    },
    {
      category: 'resources',
      patterns: [/lowest\s*(hours|utilization)|least\s*(hours|utilized)|who\s*(logged|worked)\s*(the\s*)?least/i, /underutilized/i],
      handler: async () => {
        const r = await pool.query(`SELECT MAX(full_name) as name, SUM(total_hours) as hrs FROM mv_resource_summary ${monthClause} GROUP BY employee_id HAVING SUM(total_hours) > 0 ORDER BY hrs ASC LIMIT 5`, params);
        const lines = r.rows.map((row, i) => `${i + 1}. **${row.name}** — ${Number(row.hrs).toLocaleString()}h`);
        return `Bottom 5 resources by hours (with activity):\n${lines.join('\n')}`;
      }
    },
    {
      category: 'resources',
      patterns: [/squad\s*(allocation|breakdown|summary|distribution)/i, /squads?$/i, /show\s*squads/i],
      handler: async () => {
        const r = await pool.query(`SELECT project AS squad, COUNT(*) as cnt, COUNT(*) FILTER (WHERE billable_status='Billable') as bill FROM demand_capacity GROUP BY project ORDER BY cnt DESC`);
        if (r.rows.length === 0) return 'No squad data. Upload the Demand Capacity file first.';
        const lines = r.rows.map(row => `- **${row.squad}**: ${row.cnt} resources (${row.bill} billable)`);
        return `Squad allocation (${r.rows.length} squads):\n${lines.join('\n')}`;
      }
    },
    {
      category: 'resources',
      patterns: [/billable.*(location|city|country)|location.*billable/i, /resources?\s*by\s*location/i],
      handler: async () => {
        const r = await pool.query(`SELECT location, COUNT(*) FILTER (WHERE billable_status='Billable') as bill, COUNT(*) FILTER (WHERE billable_status!='Billable') as non_bill FROM demand_capacity WHERE location != '' GROUP BY location ORDER BY (COUNT(*)) DESC`);
        const lines = r.rows.map(row => `- **${row.location}**: ${row.bill} billable, ${row.non_bill} non-billable`);
        return `Resources by location:\n${lines.join('\n')}`;
      }
    },
    {
      category: 'resources',
      patterns: [/who\s*is\s*in\s*(\w+)\s*squad/i, /(\w+)\s*squad\s*members/i, /members?\s*of\s*(\w+)/i],
      handler: async (match) => {
        const squad = (match[1] || match[2] || match[3] || '').trim();
        const r = await pool.query(`SELECT resource_name, designation_name, billable_status FROM demand_capacity WHERE LOWER(project) LIKE $1 ORDER BY resource_name`, [`%${squad.toLowerCase()}%`]);
        if (r.rows.length === 0) return `No members found for squad matching "${squad}".`;
        const lines = r.rows.map(row => `- **${row.resource_name}** (${row.designation_name}) — ${row.billable_status}`);
        return `Members of "${squad}" squad (${r.rows.length}):\n${lines.join('\n')}`;
      }
    },

    // ── UTILIZATION ──
    {
      category: 'utilization',
      patterns: [/utilization|capacity/i],
      handler: async () => {
        const r = await pool.query(`SELECT department, SUM(total_hours) as hrs, COUNT(DISTINCT employee_id) as hc, ROUND(SUM(total_hours)/(COUNT(DISTINCT employee_id)*160.0)*100,1) as pct FROM mv_resource_summary ${monthClause} GROUP BY department ORDER BY pct DESC LIMIT 5`, params);
        const lines = r.rows.map(row => `- **${row.department}**: ${row.pct}% (${Number(row.hrs).toLocaleString()}h, ${row.hc} FTE)`);
        return `Top 5 departments by utilization:\n${lines.join('\n')}`;
      }
    },
    {
      category: 'utilization',
      patterns: [/overloaded|overwork|burnout|over\s*160/i, /who\s*is\s*(overloaded|burning\s*out)/i],
      handler: async () => {
        const r = await pool.query(`SELECT MAX(full_name) as name, MAX(department) as dept, SUM(total_hours) as hrs FROM mv_resource_summary ${monthClause} GROUP BY employee_id HAVING SUM(total_hours) > 160 ORDER BY hrs DESC`, params);
        if (r.rows.length === 0) return 'No employees exceeding 160h threshold in the selected period.';
        const lines = r.rows.map(row => `- **${row.name}** (${row.dept}): ${Number(row.hrs).toLocaleString()}h`);
        return `Overloaded employees (>160h):\n${lines.join('\n')}`;
      }
    },
    {
      category: 'utilization',
      patterns: [/bench|idle|zero\s*hours|no\s*hours/i, /who\s*(is\s*on|are\s*on)\s*bench/i],
      handler: async () => {
        const r = await pool.query(`
          SELECT a.employee_id, MAX(a.employee_name) as name, MAX(a.department) as dept,
            SUM(a.present_days) as present, COALESCE(SUM(r.total_hours),0) as hrs
          FROM mv_attendance_summary a
          LEFT JOIN mv_resource_summary r USING (employee_id, year_month)
          ${monthClause ? monthClause.replace('WHERE', 'WHERE a.') : ''}
          GROUP BY a.employee_id
          HAVING SUM(a.present_days) >= 10 AND COALESCE(SUM(r.total_hours),0) < 40
          ORDER BY hrs ASC LIMIT 10
        `, params);
        if (r.rows.length === 0) return 'No bench employees detected (all present employees have logged 40h+).';
        const lines = r.rows.map(row => `- **${row.name}** (${row.dept}): ${row.present}d present, only ${Number(row.hrs)}h logged`);
        return `Potential bench employees (present but <40h logged):\n${lines.join('\n')}`;
      }
    },
    {
      category: 'utilization',
      patterns: [/daily\s*(effort|hours)|hours\s*per\s*day|average\s*daily/i],
      handler: async () => {
        const r = await pool.query(`SELECT date, SUM(hours) as hrs FROM timelog_raw WHERE ${SKYE_EXCLUSION} ${months ? 'AND year_month = ANY($1::text[])' : ''} GROUP BY date ORDER BY date DESC LIMIT 5`, params);
        const lines = r.rows.map(row => `- ${row.date.toISOString().split('T')[0]}: **${Number(row.hrs).toLocaleString()}h**`);
        return `Last 5 days of effort:\n${lines.join('\n')}`;
      }
    },
    {
      category: 'utilization',
      patterns: [/department\s*(ranking|comparison|top)/i, /top\s*departments/i],
      handler: async () => {
        const r = await pool.query(`SELECT department, SUM(total_hours) as hrs, SUM(billable_hours) as bill FROM mv_dept_hours ${monthClause} GROUP BY department ORDER BY hrs DESC LIMIT 7`, params);
        const lines = r.rows.map((row, i) => `${i + 1}. **${row.department}**: ${Number(row.hrs).toLocaleString()}h (${Number(row.bill).toLocaleString()}h billable)`);
        return `Top departments by effort:\n${lines.join('\n')}`;
      }
    },

    // ── ATTENDANCE ──
    {
      category: 'attendance',
      patterns: [/attendance\s*(rate|percentage|%)|how\s*is\s*attendance/i],
      handler: async () => {
        const r = await pool.query(`SELECT SUM(present_days) as p, SUM(absent_days) as a, SUM(leave_days) as l FROM mv_attendance_summary ${monthClause}`, params);
        const { p, a, l } = r.rows[0];
        const total = Number(p) + Number(a) + Number(l);
        const rate = total > 0 ? Math.round(Number(p) / total * 100) : 0;
        return `Attendance rate: **${rate}%**\n- Present: ${Number(p).toLocaleString()} days\n- Absent: ${Number(a).toLocaleString()} days\n- Leave: ${Number(l).toLocaleString()} days`;
      }
    },
    {
      category: 'attendance',
      patterns: [/who\s*(is|was)\s*absent|most\s*absent|highest\s*absent/i],
      handler: async () => {
        const r = await pool.query(`SELECT MAX(employee_name) as name, MAX(department) as dept, SUM(absent_days) as absent FROM mv_attendance_summary ${monthClause} GROUP BY employee_id HAVING SUM(absent_days) > 0 ORDER BY absent DESC LIMIT 5`, params);
        if (r.rows.length === 0) return 'No absences recorded in the selected period.';
        const lines = r.rows.map((row, i) => `${i + 1}. **${row.name}** (${row.dept}): ${row.absent} absent days`);
        return `Employees with most absences:\n${lines.join('\n')}`;
      }
    },
    {
      category: 'attendance',
      patterns: [/who\s*(is|was)\s*on\s*leave|most\s*leave|leave\s*takers/i],
      handler: async () => {
        const r = await pool.query(`SELECT employee_id, MAX(employee_name) as name, MAX(department) as dept, COUNT(*) as days FROM attendance WHERE status NOT IN ('P','PDA','W','H','-','') ${months ? 'AND year_month = ANY($1::text[])' : ''} GROUP BY employee_id ORDER BY days DESC LIMIT 5`, params);
        if (r.rows.length === 0) return 'No leave records found.';
        const lines = r.rows.map((row, i) => `${i + 1}. **${row.name}** (${row.dept}): ${row.days} leave days`);
        return `Top leave takers:\n${lines.join('\n')}`;
      }
    },
    {
      category: 'attendance',
      patterns: [/attendance.*department|department.*attendance/i],
      handler: async () => {
        const r = await pool.query(`SELECT department, SUM(present_days) as p, SUM(absent_days) as a, ROUND(100.0*SUM(present_days)/NULLIF(SUM(present_days+absent_days+leave_days),0),1) as rate FROM mv_attendance_summary ${monthClause} GROUP BY department ORDER BY rate ASC LIMIT 7`, params);
        const lines = r.rows.map(row => `- **${row.department}**: ${row.rate}% (${row.p}P / ${row.a}A)`);
        return `Attendance by department (worst first):\n${lines.join('\n')}`;
      }
    },
    {
      category: 'attendance',
      patterns: [/present\s*today|who\s*(is|was)\s*present/i],
      handler: async () => {
        const r = await pool.query(`SELECT COUNT(DISTINCT employee_id) as cnt FROM attendance WHERE status IN ('P','PDA') ${months ? 'AND year_month = ANY($1::text[])' : ''}`, params);
        return `**${r.rows[0].cnt} employees** were marked present in the selected period.`;
      }
    },

    // ── TIMESHEET / COMPLIANCE ──
    {
      category: 'compliance',
      patterns: [/missed\s*timesheet|timesheet\s*compliance|who\s*missed|missing\s*timesheet/i],
      handler: async () => {
        const r = await pool.query(`
          WITH wd AS (SELECT employee_id, MAX(employee_name) as name, SUM(present_days) as days FROM mv_attendance_summary ${monthClause ? monthClause.replace('WHERE','WHERE') : ''} GROUP BY employee_id),
          ld AS (SELECT employee_id, COUNT(DISTINCT date) as logged FROM timelog_raw WHERE hours > 0 AND ${SKYE_EXCLUSION} ${months ? 'AND year_month = ANY($1::text[])' : ''} GROUP BY employee_id)
          SELECT wd.name, wd.days as working, COALESCE(ld.logged,0) as logged, GREATEST(wd.days - COALESCE(ld.logged,0),0) as missed
          FROM wd LEFT JOIN ld USING (employee_id)
          WHERE wd.days > 0 AND GREATEST(wd.days - COALESCE(ld.logged,0),0) > 3
          ORDER BY missed DESC LIMIT 10
        `, params);
        if (r.rows.length === 0) return 'All employees are within acceptable compliance (missed 3 or fewer days).';
        const lines = r.rows.map((row, i) => `${i + 1}. **${row.name}**: ${row.missed} missed days (${row.logged}/${row.working} logged)`);
        return `Employees with most missed timesheet days (>3):\n${lines.join('\n')}`;
      }
    },
    {
      category: 'compliance',
      patterns: [/compliance\s*rate|overall\s*compliance/i],
      handler: async () => {
        const r = await pool.query(`
          SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE approval_status='Approved') as approved,
            ROUND(100.0*COUNT(*) FILTER (WHERE approval_status='Approved')/NULLIF(COUNT(*),0),1) as rate
          FROM timelog_raw WHERE ${SKYE_EXCLUSION} ${months ? 'AND year_month = ANY($1::text[])' : ''}
        `, params);
        return `Overall compliance rate: **${r.rows[0].rate}%** (${Number(r.rows[0].approved).toLocaleString()} approved out of ${Number(r.rows[0].total).toLocaleString()} entries).`;
      }
    },
    {
      category: 'compliance',
      patterns: [/unapproved|not\s*approved|pending\s*approval/i],
      handler: async () => {
        const r = await pool.query(`SELECT approval_status, COUNT(*) as cnt, SUM(hours) as hrs FROM timelog_raw WHERE ${SKYE_EXCLUSION} AND approval_status != 'Approved' ${months ? 'AND year_month = ANY($1::text[])' : ''} GROUP BY approval_status ORDER BY cnt DESC`, params);
        if (r.rows.length === 0) return 'All entries are approved!';
        const lines = r.rows.map(row => `- **${row.approval_status}**: ${Number(row.cnt).toLocaleString()} entries (${Number(row.hrs).toLocaleString()}h)`);
        return `Unapproved timesheet entries:\n${lines.join('\n')}`;
      }
    },
    {
      category: 'compliance',
      patterns: [/upload|data\s*version|last\s*upload|when.*uploaded/i],
      handler: async () => {
        const r = await pool.query(`SELECT file_type, file_name, year_month, version, row_count, created_at FROM uploads WHERE status='success' AND is_active=TRUE ORDER BY created_at DESC LIMIT 5`);
        if (r.rows.length === 0) return 'No uploads found.';
        const lines = r.rows.map(row => `- **${row.file_type}** v${row.version}: ${row.file_name} (${row.year_month}, ${row.row_count} rows)`);
        return `Active data versions:\n${lines.join('\n')}`;
      }
    },
    {
      category: 'compliance',
      patterns: [/non.?billable|non\s*billing/i],
      handler: async () => {
        const r = await pool.query(`SELECT COALESCE(task_name,'Unspecified') as task, SUM(hours) as hrs FROM timelog_raw WHERE billable_status != 'Billable' AND ${SKYE_EXCLUSION} ${months ? 'AND year_month = ANY($1::text[])' : ''} GROUP BY task_name ORDER BY hrs DESC LIMIT 7`, params);
        const lines = r.rows.map(row => `- **${row.task}**: ${Number(row.hrs).toLocaleString()}h`);
        return `Top non-billable tasks:\n${lines.join('\n')}`;
      }
    },

    // ── ANALYTICS ──
    {
      category: 'analytics',
      patterns: [/entity|legal\s*entity|entities/i],
      handler: async () => {
        const r = await pool.query(`SELECT entity, SUM(total_hours) as hrs, SUM(billable_hours) as bill, COUNT(DISTINCT employee_id) as hc FROM mv_resource_summary ${monthClause} GROUP BY entity ORDER BY hrs DESC`, params);
        const lines = r.rows.map(row => {
          const pct = Number(row.hrs) > 0 ? Math.round(Number(row.bill) / Number(row.hrs) * 100) : 0;
          return `- **${row.entity}**: ${Number(row.hrs).toLocaleString()}h (${pct}% billable, ${row.hc} employees)`;
        });
        return `Entity breakdown:\n${lines.join('\n')}`;
      }
    },
    {
      category: 'analytics',
      patterns: [/client\s*(breakdown|allocation|top|hours)/i, /top\s*clients/i, /which\s*client/i],
      handler: async () => {
        const r = await pool.query(`SELECT client_name, SUM(total_hours) as hrs FROM mv_client_hours ${monthClause} GROUP BY client_name ORDER BY hrs DESC LIMIT 7`, params);
        const lines = r.rows.map((row, i) => `${i + 1}. **${row.client_name}**: ${Number(row.hrs).toLocaleString()}h`);
        return `Top clients by hours:\n${lines.join('\n')}`;
      }
    },
    {
      category: 'analytics',
      patterns: [/productivity|hours\s*per\s*day/i],
      handler: async () => {
        const r = await pool.query(`
          SELECT a.department, ROUND(COALESCE(SUM(r.total_hours),0)/NULLIF(SUM(a.present_days),0),2) as idx
          FROM mv_attendance_summary a LEFT JOIN mv_resource_summary r USING(employee_id,year_month)
          ${monthClause ? monthClause.replace('WHERE','WHERE a.') : ''}
          GROUP BY a.department ORDER BY idx DESC LIMIT 5
        `, params);
        const lines = r.rows.map(row => `- **${row.department}**: ${row.idx}h/day`);
        return `Top departments by productivity (hours per present day):\n${lines.join('\n')}\nTarget: 7.5h/day`;
      }
    },
    {
      category: 'analytics',
      patterns: [/location.*(comparison|utilization|performance)|compare\s*locations/i],
      handler: async () => {
        const r = await pool.query(`SELECT location, COUNT(*) as cnt, COUNT(*) FILTER (WHERE billable_status='Billable') as bill FROM demand_capacity WHERE location != '' GROUP BY location ORDER BY cnt DESC`);
        const lines = r.rows.map(row => `- **${row.location}**: ${row.cnt} resources (${row.bill} billable)`);
        return `Location breakdown:\n${lines.join('\n')}`;
      }
    },
    {
      category: 'analytics',
      patterns: [/skye|excluded/i],
      handler: async () => {
        const r = await pool.query(`SELECT COUNT(*) as cnt, SUM(hours) as hrs FROM timelog_raw WHERE LOWER(COALESCE(project_name,'')) LIKE '%skye%' OR LOWER(COALESCE(client_name,'')) LIKE '%skye%'`);
        return `Skye project data: **${r.rows[0].cnt} entries** totaling **${Number(r.rows[0].hrs).toLocaleString()}h** — excluded from all dashboard metrics.`;
      }
    },

    // ── HELP / META ──
    {
      category: 'help',
      patterns: [/^(hi|hello|hey|good\s*(morning|afternoon|evening))/i],
      handler: async () => 'Hello! I\'m the PMO Assistant. Ask me anything about hours, resources, squads, attendance, compliance, or analytics. Try: "Who logged the most hours?" or "Show squad allocation".'
    },
    {
      category: 'help',
      patterns: [/help|what\s*can\s*you|capabilities|commands/i],
      handler: async () => `I can answer questions about:\n\n**Portfolio**: hours, billability, projects, approval %, designations\n**Resources**: top/bottom performers, squad allocation, members, locations\n**Utilization**: department utilization, overloaded employees, bench, daily effort\n**Attendance**: rates, absences, leave, department attendance\n**Compliance**: missed timesheets, approval rates, unapproved entries, uploads\n**Analytics**: entities, clients, productivity, locations, Skye exclusion\n\nJust ask a question in plain English!`
    },
    {
      category: 'help',
      patterns: [/thank|thanks|cheers/i],
      handler: async () => 'You\'re welcome! Let me know if you need anything else.'
    },
  ];
}

/**
 * POST /api/chatbot
 * Body: { message: "user query", months: ["2026-03"] }
 */
router.post('/', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.json({ reply: 'Please type a question.' });
    }

    const months = req.selectedMonths;
    const monthClause = months ? 'WHERE year_month = ANY($1::text[])' : '';
    const params = months ? [months] : [];

    const intents = buildIntents(months, monthClause, params);

    // Try to match
    for (const intent of intents) {
      for (const pattern of intent.patterns) {
        const match = message.match(pattern);
        if (match) {
          const reply = await intent.handler(match);
          return res.json({ reply, category: intent.category });
        }
      }
    }

    // No match
    return res.json({
      reply: `I couldn't understand that question. Here are some things you can ask:\n\n- "What are the total hours?"\n- "Who logged the most hours?"\n- "Show squad allocation"\n- "Who missed timesheets?"\n- "What's the attendance rate?"\n- "Show top clients"\n- "Who is overloaded?"\n\nType **help** for the full list.`,
      category: 'help'
    });

  } catch (err) {
    console.error('Chatbot error:', err.message);
    res.json({ reply: `Sorry, something went wrong processing your question. Error: ${err.message}`, category: 'error' });
  }
});

module.exports = router;
