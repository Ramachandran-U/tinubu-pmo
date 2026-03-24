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

module.exports = router;
