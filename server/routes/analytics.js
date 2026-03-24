const express = require('express');
const { pool } = require('../db');
const shared = require('./shared');

const router = express.Router();
router.use(shared);

/**
 * GET /api/analytics/kpi-trends?months=2026-01,2026-02,2026-03
 * Returns per-month KPI values for temporal comparison (MoM cards + sparklines).
 */
router.get('/kpi-trends', async (req, res, next) => {
  try {
    const { selectedMonths } = req;

    // Get all months up to the latest selected, for sparkline context
    let monthsClause = '';
    let params = [];
    if (selectedMonths) {
      monthsClause = `WHERE year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    const hoursRes = await pool.query(`
      SELECT year_month,
             COALESCE(SUM(total_hours), 0) AS "totalHours",
             COALESCE(SUM(billable_hours), 0) AS "billableHours",
             COALESCE(SUM(non_billable_hours), 0) AS "nonBillableHours"
      FROM mv_kpis_monthly
      ${monthsClause}
      GROUP BY year_month
      ORDER BY year_month
    `, params);

    const distinctRes = await pool.query(`
      SELECT year_month,
             COUNT(DISTINCT employee_id) AS "uniqueEmployees",
             COUNT(DISTINCT client_name) AS "uniqueClients",
             COUNT(DISTINCT project_name) AS "uniqueProjects"
      FROM timelog_raw
      ${monthsClause}
      GROUP BY year_month
      ORDER BY year_month
    `, params);

    const attRes = await pool.query(`
      SELECT year_month,
             COALESCE(SUM(present_days), 0) AS "totalPresent",
             COALESCE(SUM(absent_days), 0) AS "totalAbsent",
             COUNT(DISTINCT employee_id) AS "attendanceEmployees"
      FROM mv_attendance_summary
      ${monthsClause}
      GROUP BY year_month
      ORDER BY year_month
    `, params);

    // Merge all into a single per-month map
    const monthMap = {};
    for (const row of hoursRes.rows) {
      monthMap[row.year_month] = { yearMonth: row.year_month, ...row };
    }
    for (const row of distinctRes.rows) {
      monthMap[row.year_month] = { ...monthMap[row.year_month], ...row };
    }
    for (const row of attRes.rows) {
      monthMap[row.year_month] = { ...monthMap[row.year_month], ...row };
    }

    // Cast all numeric strings
    const months = Object.values(monthMap).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    months.forEach(m => {
      Object.keys(m).forEach(k => {
        if (k !== 'yearMonth' && k !== 'year_month') m[k] = Number(m[k]);
      });
      if (m.totalHours > 0) {
        m.billablePct = Math.round((m.billableHours / m.totalHours) * 100);
      } else {
        m.billablePct = 0;
      }
      if (m.totalPresent + m.totalAbsent > 0) {
        m.attendanceRate = Math.round((m.totalPresent / (m.totalPresent + m.totalAbsent)) * 100);
      } else {
        m.attendanceRate = 0;
      }
    });

    res.json(months);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/compliance?months=...
 * Returns timesheet compliance funnel data per month.
 */
router.get('/compliance', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    let clause = '';
    let params = [];
    if (selectedMonths) {
      clause = `WHERE year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    const result = await pool.query(`
      SELECT
        year_month,
        COUNT(*) AS total_entries,
        COUNT(*) FILTER (WHERE approval_status IS NOT NULL AND approval_status != 'Not Submitted') AS submitted,
        COUNT(*) FILTER (WHERE approval_status = 'Approved') AS approved,
        COUNT(*) FILTER (WHERE approval_status = 'Pending') AS pending,
        COUNT(*) FILTER (WHERE approval_status = 'Draft') AS draft,
        COUNT(*) FILTER (WHERE approval_status = 'Not Submitted' OR approval_status IS NULL) AS not_submitted,
        SUM(hours) AS total_hours,
        SUM(hours) FILTER (WHERE approval_status = 'Approved') AS approved_hours
      FROM timelog_raw
      ${clause}
      GROUP BY year_month
      ORDER BY year_month
    `, params);

    res.json(result.rows.map(r => ({
      yearMonth: r.year_month,
      totalEntries: Number(r.total_entries),
      submitted: Number(r.submitted),
      approved: Number(r.approved),
      pending: Number(r.pending),
      draft: Number(r.draft),
      notSubmitted: Number(r.not_submitted),
      totalHours: Number(r.total_hours),
      approvedHours: Number(r.approved_hours),
      complianceRate: Number(r.total_entries) > 0
        ? Math.round((Number(r.approved) / Number(r.total_entries)) * 100)
        : 0
    })));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/dept-heatmap?months=...
 * Returns department utilization data per month for heatmap grid.
 */
router.get('/dept-heatmap', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    let clause = '';
    let params = [];
    if (selectedMonths) {
      clause = `WHERE year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    const result = await pool.query(`
      SELECT
        department,
        year_month,
        SUM(total_hours) AS dept_hours,
        SUM(billable_hours) AS dept_billable,
        COUNT(DISTINCT employee_id) AS headcount,
        ROUND(SUM(total_hours) / (COUNT(DISTINCT employee_id) * 160.0) * 100, 1) AS utilization_pct
      FROM mv_resource_summary
      ${clause}
      GROUP BY department, year_month
      ORDER BY department, year_month
    `, params);

    res.json(result.rows.map(r => ({
      department: r.department,
      yearMonth: r.year_month,
      deptHours: Number(r.dept_hours),
      deptBillable: Number(r.dept_billable),
      headcount: Number(r.headcount),
      utilizationPct: Number(r.utilization_pct)
    })));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/attendance-trend?months=...
 * Returns attendance rate trend by department per month.
 */
router.get('/attendance-trend', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    let clause = '';
    let params = [];
    if (selectedMonths) {
      clause = `WHERE year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    const result = await pool.query(`
      SELECT
        year_month,
        department,
        SUM(present_days) AS total_present,
        SUM(absent_days) AS total_absent,
        SUM(leave_days) AS total_leave,
        SUM(present_days + absent_days + leave_days) AS total_tracked_days,
        ROUND(100.0 * SUM(present_days) /
          NULLIF(SUM(present_days + absent_days + leave_days), 0), 1) AS attendance_rate
      FROM mv_attendance_summary
      ${clause}
      GROUP BY year_month, department
      ORDER BY department, year_month
    `, params);

    res.json(result.rows.map(r => ({
      yearMonth: r.year_month,
      department: r.department,
      totalPresent: Number(r.total_present),
      totalAbsent: Number(r.total_absent),
      totalLeave: Number(r.total_leave),
      totalTrackedDays: Number(r.total_tracked_days),
      attendanceRate: Number(r.attendance_rate || 0)
    })));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/resource-roster?months=...
 * Returns per-employee, per-month breakdown for the multi-month roster table.
 */
router.get('/resource-roster', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    let clause = '';
    let params = [];
    if (selectedMonths) {
      clause = `WHERE r.year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    const result = await pool.query(`
      SELECT
        r.employee_id,
        MAX(r.full_name) AS full_name,
        MAX(r.entity) AS entity,
        MAX(r.department) AS department,
        MAX(r.designation) AS designation,
        r.year_month,
        SUM(r.total_hours) AS total_hours,
        SUM(r.billable_hours) AS billable_hours
      FROM mv_resource_summary r
      ${clause}
      GROUP BY r.employee_id, r.year_month
      ORDER BY r.employee_id, r.year_month
    `, params);

    // Also get location from attendance
    const locResult = await pool.query(`
      SELECT DISTINCT employee_id, MAX(location) AS location
      FROM attendance
      ${selectedMonths ? 'WHERE year_month = ANY($1::text[])' : ''}
      GROUP BY employee_id
    `, params);

    const locMap = {};
    locResult.rows.forEach(r => { locMap[r.employee_id] = r.location; });

    res.json(result.rows.map(r => ({
      employeeId: r.employee_id,
      fullName: r.full_name,
      entity: r.entity,
      department: r.department,
      designation: r.designation,
      location: locMap[r.employee_id] || null,
      yearMonth: r.year_month,
      totalHours: Number(r.total_hours),
      billableHours: Number(r.billable_hours)
    })));
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Phase 2 Endpoints
// ============================================================

/**
 * GET /api/analytics/entity-billing?months=...
 * Entity-level billing performance.
 */
router.get('/entity-billing', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    let clause = '';
    let params = [];
    if (selectedMonths) {
      clause = `WHERE r.year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    const result = await pool.query(`
      SELECT
        r.entity,
        r.year_month,
        SUM(r.total_hours) AS total_hours,
        SUM(r.billable_hours) AS billable_hours,
        COUNT(DISTINCT r.employee_id) AS headcount,
        ROUND(SUM(r.billable_hours) / NULLIF(SUM(r.total_hours), 0) * 100, 1) AS billability_pct
      FROM mv_resource_summary r
      ${clause}
      GROUP BY r.entity, r.year_month
      ORDER BY r.entity, r.year_month
    `, params);

    res.json(result.rows.map(r => ({
      entity: r.entity,
      yearMonth: r.year_month,
      totalHours: Number(r.total_hours),
      billableHours: Number(r.billable_hours),
      headcount: Number(r.headcount),
      billabilityPct: Number(r.billability_pct || 0)
    })));
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/employee-trend?months=...
 * Per-employee monthly hours with rolling average for utilization trend.
 */
router.get('/employee-trend', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    let clause = '';
    let params = [];
    if (selectedMonths) {
      clause = `WHERE year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    const result = await pool.query(`
      SELECT
        employee_id,
        MAX(full_name) AS full_name,
        MAX(department) AS department,
        year_month,
        SUM(total_hours) AS total_hours,
        SUM(billable_hours) AS billable_hours
      FROM mv_resource_summary
      ${clause}
      GROUP BY employee_id, year_month
      ORDER BY employee_id, year_month
    `, params);

    res.json(result.rows.map(r => ({
      employeeId: r.employee_id,
      fullName: r.full_name,
      department: r.department,
      yearMonth: r.year_month,
      totalHours: Number(r.total_hours),
      billableHours: Number(r.billable_hours)
    })));
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/alerts?months=...
 * Computes PMO alert conditions from current data.
 */
router.get('/alerts', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    let clause = '';
    let params = [];
    if (selectedMonths) {
      clause = `WHERE year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    const alerts = [];

    // Overload: employee > 160h in selected months
    const overload = await pool.query(`
      SELECT employee_id, MAX(full_name) AS full_name, MAX(department) AS department,
             SUM(total_hours) AS total_hours
      FROM mv_resource_summary ${clause}
      GROUP BY employee_id
      HAVING SUM(total_hours) > 160
      ORDER BY total_hours DESC
    `, params);
    overload.rows.forEach(r => {
      alerts.push({
        type: 'overload', severity: 'critical',
        message: `${r.full_name} logged ${Number(r.total_hours).toFixed(0)}h (exceeds 160h threshold)`,
        employee: r.full_name, department: r.department, value: Number(r.total_hours)
      });
    });

    // Bench: employee < 40h but present 15+ days
    const bench = await pool.query(`
      SELECT a.employee_id, MAX(a.employee_name) AS name, MAX(a.department) AS department,
             SUM(a.present_days) AS present_days, COALESCE(SUM(r.total_hours), 0) AS hours
      FROM mv_attendance_summary a
      LEFT JOIN mv_resource_summary r USING (employee_id, year_month)
      ${clause ? clause.replace('year_month', 'a.year_month') : ''}
      GROUP BY a.employee_id
      HAVING SUM(a.present_days) >= 15 AND COALESCE(SUM(r.total_hours), 0) < 40
    `, params);
    bench.rows.forEach(r => {
      alerts.push({
        type: 'bench', severity: 'warning',
        message: `${r.name} present ${Number(r.present_days)}d but only ${Number(r.hours).toFixed(0)}h logged`,
        employee: r.name, department: r.department, value: Number(r.hours)
      });
    });

    // Utilization Spike: dept > 100%
    const spike = await pool.query(`
      SELECT department, SUM(total_hours) AS hrs, COUNT(DISTINCT employee_id) AS hc,
             ROUND(SUM(total_hours) / (COUNT(DISTINCT employee_id) * 160.0) * 100, 1) AS util_pct
      FROM mv_resource_summary ${clause}
      GROUP BY department
      HAVING ROUND(SUM(total_hours) / (COUNT(DISTINCT employee_id) * 160.0) * 100, 1) > 100
    `, params);
    spike.rows.forEach(r => {
      alerts.push({
        type: 'utilization_spike', severity: 'critical',
        message: `${r.department} at ${Number(r.util_pct)}% utilization (${Number(r.hc)} FTE)`,
        department: r.department, value: Number(r.util_pct)
      });
    });

    // Missing Timelog: in attendance but 0 hours for 10+ workdays
    const missing = await pool.query(`
      SELECT a.employee_id, MAX(a.employee_name) AS name, MAX(a.department) AS department,
             SUM(a.present_days) AS present_days
      FROM mv_attendance_summary a
      LEFT JOIN mv_resource_summary r USING (employee_id, year_month)
      ${clause ? clause.replace('year_month', 'a.year_month') : ''}
      GROUP BY a.employee_id
      HAVING SUM(a.present_days) >= 10 AND COALESCE(SUM(r.total_hours), 0) = 0
    `, params);
    missing.rows.forEach(r => {
      alerts.push({
        type: 'missing_timelog', severity: 'warning',
        message: `${r.name} present ${Number(r.present_days)}d with zero time logged`,
        employee: r.name, department: r.department, value: Number(r.present_days)
      });
    });

    // Sort: critical first, then by value desc
    alerts.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
      return b.value - a.value;
    });

    res.json(alerts);
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/manager-scorecard?months=...
 * Manager-level attendance scorecard.
 */
router.get('/manager-scorecard', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    // We need the reporting_to field from raw attendance
    let clause = '';
    let params = [];
    if (selectedMonths) {
      clause = `WHERE a.year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    // Get per-employee attendance grouped by department (proxy for manager since
    // reporting_to is not in current schema — use department as grouping)
    const result = await pool.query(`
      SELECT
        a.department AS manager_group,
        COUNT(DISTINCT a.employee_id) AS direct_reports,
        SUM(a.present_days) AS total_present,
        SUM(a.absent_days) AS total_absent,
        SUM(a.leave_days) AS total_leave,
        SUM(a.present_days + a.absent_days + a.leave_days) AS total_tracked,
        ROUND(100.0 * SUM(a.present_days) /
          NULLIF(SUM(a.present_days + a.absent_days + a.leave_days), 0), 1) AS attendance_rate
      FROM mv_attendance_summary a
      ${clause}
      GROUP BY a.department
      ORDER BY attendance_rate ASC
    `, params);

    res.json(result.rows.map(r => ({
      managerGroup: r.manager_group,
      directReports: Number(r.direct_reports),
      totalPresent: Number(r.total_present),
      totalAbsent: Number(r.total_absent),
      totalLeave: Number(r.total_leave),
      totalTracked: Number(r.total_tracked),
      attendanceRate: Number(r.attendance_rate || 0)
    })));
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/non-billable?months=...
 * Non-billable hours breakdown by task and department.
 */
router.get('/non-billable', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    let clause = "WHERE billable_status != 'Billable'";
    let params = [];
    if (selectedMonths) {
      clause += ` AND year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    // By task
    const byTask = await pool.query(`
      SELECT COALESCE(task_name, 'Unspecified') AS task_name, SUM(hours) AS hours
      FROM timelog_raw ${clause}
      GROUP BY task_name ORDER BY hours DESC LIMIT 15
    `, params);

    // By department per month
    const byDept = await pool.query(`
      SELECT department, year_month, SUM(hours) AS hours
      FROM timelog_raw ${clause}
      GROUP BY department, year_month ORDER BY department, year_month
    `, params);

    // Totals by dept
    const deptTotals = await pool.query(`
      SELECT department,
        SUM(hours) AS non_billable,
        (SELECT SUM(hours) FROM timelog_raw t2
         WHERE t2.department = timelog_raw.department
         ${selectedMonths ? "AND t2.year_month = ANY($1::text[])" : ''}
        ) AS total
      FROM timelog_raw ${clause}
      GROUP BY department ORDER BY non_billable DESC
    `, params);

    res.json({
      byTask: byTask.rows.map(r => ({ taskName: r.task_name, hours: Number(r.hours) })),
      byDeptMonth: byDept.rows.map(r => ({ department: r.department, yearMonth: r.year_month, hours: Number(r.hours) })),
      deptTotals: deptTotals.rows.map(r => ({
        department: r.department,
        nonBillable: Number(r.non_billable),
        total: Number(r.total),
        pct: Number(r.total) > 0 ? Math.round(Number(r.non_billable) / Number(r.total) * 100) : 0
      }))
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/productivity-index?months=...
 * Hours logged per present day by department.
 */
router.get('/productivity-index', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    let clause = '';
    let params = [];
    if (selectedMonths) {
      clause = `WHERE a.year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    const result = await pool.query(`
      SELECT
        a.department,
        a.year_month,
        SUM(a.present_days) AS present_days,
        COALESCE(SUM(r.total_hours), 0) AS total_hours,
        ROUND(COALESCE(SUM(r.total_hours), 0) / NULLIF(SUM(a.present_days), 0), 2) AS productivity_index
      FROM mv_attendance_summary a
      LEFT JOIN mv_resource_summary r USING (employee_id, year_month)
      ${clause}
      GROUP BY a.department, a.year_month
      ORDER BY a.department, a.year_month
    `, params);

    res.json(result.rows.map(r => ({
      department: r.department,
      yearMonth: r.year_month,
      presentDays: Number(r.present_days),
      totalHours: Number(r.total_hours),
      productivityIndex: Number(r.productivity_index || 0)
    })));
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/dept-ranking?months=...
 * Department ranking by hours per month for racing bar chart.
 */
router.get('/dept-ranking', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    let clause = '';
    let params = [];
    if (selectedMonths) {
      clause = `WHERE year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    const result = await pool.query(`
      SELECT department, year_month,
        SUM(total_hours) AS total_hours,
        SUM(billable_hours) AS billable_hours,
        COUNT(DISTINCT employee_id) AS headcount,
        ROUND(SUM(total_hours) / (COUNT(DISTINCT employee_id) * 160.0) * 100, 1) AS utilization_pct
      FROM mv_resource_summary ${clause}
      GROUP BY department, year_month
      ORDER BY year_month, total_hours DESC
    `, params);

    res.json(result.rows.map(r => ({
      department: r.department,
      yearMonth: r.year_month,
      totalHours: Number(r.total_hours),
      billableHours: Number(r.billable_hours),
      headcount: Number(r.headcount),
      utilizationPct: Number(r.utilization_pct || 0)
    })));
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/leave-calendar?months=...&dept=...
 * Daily leave data for calendar heatmap.
 */
router.get('/leave-calendar', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    const dept = req.query.dept;
    let clause = "WHERE status NOT IN ('P','PDA','W','H','-','')";
    let params = [];
    if (selectedMonths) {
      params.push(selectedMonths);
      clause += ` AND year_month = ANY($${params.length}::text[])`;
    }
    if (dept) {
      params.push(dept);
      clause += ` AND department = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT date, COUNT(*) AS on_leave,
        array_agg(DISTINCT employee_name) AS employees,
        array_agg(DISTINCT status) AS leave_types
      FROM attendance ${clause}
      GROUP BY date ORDER BY date
    `, params);

    const calendar = {};
    result.rows.forEach(r => {
      const dateStr = r.date.toISOString().split('T')[0];
      calendar[dateStr] = {
        onLeave: Number(r.on_leave),
        employees: r.employees.filter(Boolean),
        leaveTypes: r.leave_types.filter(Boolean)
      };
    });

    res.json(calendar);
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/location-utilization?months=...
 * Location-level utilization comparison.
 */
router.get('/location-utilization', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    let clause = '';
    let params = [];
    if (selectedMonths) {
      clause = `WHERE a.year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    const result = await pool.query(`
      SELECT
        a.location,
        r.year_month,
        SUM(r.total_hours) AS total_hours,
        SUM(r.billable_hours) AS billable_hours,
        COUNT(DISTINCT r.employee_id) AS headcount,
        ROUND(SUM(r.total_hours) / (COUNT(DISTINCT r.employee_id) * 160.0) * 100, 1) AS utilization_pct
      FROM mv_resource_summary r
      JOIN (
        SELECT DISTINCT employee_id, MAX(location) AS location, year_month
        FROM attendance
        ${selectedMonths ? 'WHERE year_month = ANY($1::text[])' : ''}
        GROUP BY employee_id, year_month
      ) a ON a.employee_id = r.employee_id AND a.year_month = r.year_month
      ${clause ? '' : ''}
      GROUP BY a.location, r.year_month
      ORDER BY a.location, r.year_month
    `, params);

    res.json(result.rows.map(r => ({
      location: r.location,
      yearMonth: r.year_month,
      totalHours: Number(r.total_hours),
      billableHours: Number(r.billable_hours),
      headcount: Number(r.headcount),
      utilizationPct: Number(r.utilization_pct || 0)
    })));
  } catch (err) { next(err); }
});

module.exports = router;
