const express = require('express');
const { pool } = require('../db');
const shared = require('./shared');

const router = express.Router();
router.use(shared);

/**
 * GET /api/kpis?months=...
 * Returns aggregated high-level KPIs across the selected months from the materialized views.
 */
router.get('/', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    
    let kpiQuery = `
      SELECT 
        SUM(total_hours) as "totalHours",
        SUM(billable_hours) as "billableHours",
        SUM(non_billable_hours) as "nonBillableHours",
        COUNT(DISTINCT employee_id) as "uniqueEmployees",
        COUNT(DISTINCT client_name) as "uniqueClients",
        COUNT(DISTINCT project_name) as "uniqueProjects"
      FROM mv_kpis_monthly
    `;
    
    let kpiParams = [];
    if (selectedMonths) {
      kpiQuery += `WHERE year_month = ANY($1::text[])`;
      kpiParams.push(selectedMonths);
    }

    // Since mv_kpis_monthly is aggregated per month, summing across months directly isn't perfectly accurate 
    // for DISTINCT counts (e.g. unique employees across 2 months). But for this dashboard, we just need raw totals:
    // Actually, to get true distinct counts across months, we must query `timelog_raw`.
    // Let's use `timelog_raw` for accurate unique counts across multiple months, and the view for hours.
    
    let hoursQuery = `
      SELECT 
        COALESCE(SUM(total_hours), 0) as "totalHours",
        COALESCE(SUM(billable_hours), 0) as "billableHours",
        COALESCE(SUM(non_billable_hours), 0) as "nonBillableHours"
      FROM mv_kpis_monthly
    `;
    if (selectedMonths) hoursQuery += ` WHERE year_month = ANY($1::text[])`;

    let distinctQuery = `
      SELECT 
        COUNT(DISTINCT employee_id) as "uniqueEmployees",
        COUNT(DISTINCT client_name) as "uniqueClients",
        COUNT(DISTINCT project_name) as "uniqueProjects"
      FROM timelog_raw
    `;
    if (selectedMonths) distinctQuery += ` WHERE year_month = ANY($1::text[])`;

    let attQuery = `
      SELECT 
        COALESCE(SUM(present_days), 0) as "totalPresent",
        COALESCE(SUM(absent_days), 0) as "totalAbsent",
        COUNT(DISTINCT employee_id) as "attendanceEmployees"
      FROM mv_attendance_summary
    `;
    if (selectedMonths) attQuery += ` WHERE year_month = ANY($1::text[])`;

    const [hoursRes, distinctRes, attRes] = await Promise.all([
      pool.query(hoursQuery, kpiParams),
      pool.query(distinctQuery, kpiParams),
      pool.query(attQuery, kpiParams)
    ]);

    const kpis = {
      ...hoursRes.rows[0],
      ...distinctRes.rows[0],
      ...attRes.rows[0],
      billablePct: 0
    };

    // Cast strings from Postgres SUM() to numbers
    Object.keys(kpis).forEach(k => kpis[k] = Number(kpis[k]));

    if (kpis.totalHours > 0) {
      kpis.billablePct = Math.round((kpis.billableHours / kpis.totalHours) * 100);
    }

    res.json(kpis);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
