const express = require('express');
const { pool } = require('../db');
const shared = require('./shared');

const router = express.Router();
router.use(shared);

/**
 * GET /api/squads
 * Returns squad (Project-based) summary data.
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT project AS squad, location,
        COUNT(*) AS total_resources,
        COUNT(*) FILTER (WHERE billable_status = 'Billable') AS billable_count,
        COUNT(*) FILTER (WHERE billable_status != 'Billable') AS non_billable_count
      FROM demand_capacity
      GROUP BY project, location
      ORDER BY project, location
    `);
    res.json(result.rows.map(r => ({
      squad: r.squad,
      location: r.location,
      totalResources: Number(r.total_resources),
      billableCount: Number(r.billable_count),
      nonBillableCount: Number(r.non_billable_count)
    })));
  } catch (err) { next(err); }
});

/**
 * GET /api/squads/list
 * Returns distinct squad (project) identifiers.
 */
router.get('/list', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT project AS squad FROM demand_capacity WHERE project IS NOT NULL AND project != '' ORDER BY project
    `);
    res.json(result.rows.map(r => r.squad));
  } catch (err) { next(err); }
});

/**
 * GET /api/squads/designations
 * Returns designation-wise resource count for overview bar chart.
 */
router.get('/designations', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT designation_name, COUNT(DISTINCT employee_id) AS count
      FROM demand_capacity
      WHERE designation_name IS NOT NULL AND designation_name != ''
      GROUP BY designation_name
      ORDER BY count DESC
    `);
    res.json(result.rows.map(r => ({
      designation: r.designation_name,
      count: Number(r.count)
    })));
  } catch (err) { next(err); }
});

/**
 * GET /api/squads/billable-by-location
 * Returns billable vs non-billable counts grouped by location.
 */
router.get('/billable-by-location', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT location,
        COUNT(*) FILTER (WHERE billable_status = 'Billable') AS billable,
        COUNT(*) FILTER (WHERE billable_status != 'Billable') AS non_billable
      FROM demand_capacity
      WHERE location IS NOT NULL AND location != ''
      GROUP BY location
      ORDER BY (COUNT(*)) DESC
    `);
    res.json(result.rows.map(r => ({
      location: r.location,
      billable: Number(r.billable),
      nonBillable: Number(r.non_billable)
    })));
  } catch (err) { next(err); }
});

/**
 * GET /api/squads/allocation?months=...
 * Returns squad allocation with hours data (joined with timelog).
 */
router.get('/allocation', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    let monthClause = '';
    let params = [];
    if (selectedMonths) {
      monthClause = `AND r.year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }

    const result = await pool.query(`
      SELECT
        dc.project AS squad,
        COUNT(DISTINCT dc.employee_id) AS total_resources,
        COUNT(DISTINCT dc.employee_id) FILTER (WHERE dc.billable_status = 'Billable') AS billable_count,
        COALESCE(SUM(r.total_hours), 0) AS total_hours,
        COALESCE(SUM(r.billable_hours), 0) AS billable_hours
      FROM demand_capacity dc
      LEFT JOIN mv_resource_summary r ON dc.employee_id = r.employee_id ${monthClause}
      GROUP BY dc.project
      ORDER BY total_hours DESC
    `, params);

    res.json(result.rows.map(r => ({
      squad: r.squad,
      totalResources: Number(r.total_resources),
      billableCount: Number(r.billable_count),
      totalHours: Number(r.total_hours),
      billableHours: Number(r.billable_hours),
      avgUtilization: Number(r.total_resources) > 0
        ? Math.round(Number(r.total_hours) / (Number(r.total_resources) * 160) * 100)
        : 0
    })));
  } catch (err) { next(err); }
});

/**
 * GET /api/squads/employee-mapping
 * Returns employee_id -> squad (project) mapping for frontend use.
 */
router.get('/employee-mapping', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT employee_id, project AS squad FROM demand_capacity
    `);
    const map = {};
    result.rows.forEach(r => { map[r.employee_id] = r.squad; });
    res.json(map);
  } catch (err) { next(err); }
});

module.exports = router;
