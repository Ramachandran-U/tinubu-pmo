const express = require('express');
const { pool } = require('../db');
const shared = require('./shared');
const { SKYE_EXCLUSION } = require('./shared');
const { entityToLocation } = require('../etl/entity-location');

const router = express.Router();
router.use(shared);

/**
 * GET /api/charts/daily?months=...
 */
router.get('/daily', async (req, res, next) => {
  try {
    let query = `
      SELECT date,
             SUM(hours) as total,
             SUM(hours) FILTER (WHERE billable_status = 'Billable') as billable
      FROM timelog_raw
      WHERE ${SKYE_EXCLUSION}
    `;
    let params = [];
    if (req.selectedMonths) {
      query += ` AND year_month = ANY($1::text[])`;
      params.push(req.selectedMonths);
    }
    query += ` GROUP BY date ORDER BY date ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows.map(r => ({
      date: r.date.toISOString().split('T')[0],
      total: Number(r.total || 0),
      billable: Number(r.billable || 0)
    })));
  } catch (err) { next(err); }
});

/**
 * GET /api/charts/clients?months=...
 */
router.get('/clients', async (req, res, next) => {
  try {
    let query = `
      SELECT client_name as client, 
             SUM(total_hours) as hours, 
             SUM(billable_hours) as "billableHours"
      FROM mv_client_hours
    `;
    let params = [];
    if (req.selectedMonths) {
      query += ` WHERE year_month = ANY($1::text[])`;
      params.push(req.selectedMonths);
    }
    query += ` GROUP BY client_name ORDER BY hours DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows.map(r => ({ ...r, hours: Number(r.hours), billableHours: Number(r.billableHours) })));
  } catch (err) { next(err); }
});

/**
 * GET /api/charts/departments?months=...
 */
router.get('/departments', async (req, res, next) => {
  try {
    let query = `
      SELECT department, SUM(total_hours) as hours
      FROM mv_dept_hours
    `;
    let params = [];
    if (req.selectedMonths) {
      query += ` WHERE year_month = ANY($1::text[])`;
      params.push(req.selectedMonths);
    }
    query += ` GROUP BY department ORDER BY hours DESC LIMIT 10`;

    const result = await pool.query(query, params);
    res.json(result.rows.map(r => ({ ...r, hours: Number(r.hours) })));
  } catch (err) { next(err); }
});

/**
 * GET /api/charts/approval?months=...
 */
router.get('/approval', async (req, res, next) => {
  try {
    let query = `SELECT approval_status, SUM(hours) as hours FROM timelog_raw WHERE ${SKYE_EXCLUSION}`;
    let params = [];
    if (req.selectedMonths) {
      query += ` AND year_month = ANY($1::text[])`;
      params.push(req.selectedMonths);
    }
    query += ` GROUP BY approval_status`;

    const result = await pool.query(query, params);
    const chart = { Approved: 0, Pending: 0, 'Not Submitted': 0, Draft: 0 };
    result.rows.forEach(r => chart[r.approval_status || 'Pending'] = Number(r.hours));
    res.json(chart);
  } catch (err) { next(err); }
});

/**
 * GET /api/charts/locations?months=...
 */
router.get('/locations', async (req, res, next) => {
  try {
    let query = `
      SELECT entity, COUNT(DISTINCT employee_id) as count
      FROM mv_resource_summary
    `;
    let params = [];
    if (req.selectedMonths) {
      query += ` WHERE year_month = ANY($1::text[])`;
      params.push(req.selectedMonths);
    }
    query += ` GROUP BY entity`;

    const result = await pool.query(query, params);
    const locations = {};
    result.rows.forEach(r => {
      const loc = entityToLocation(r.entity);
      locations[loc] = (locations[loc] || 0) + Number(r.count);
    });
    res.json(locations);
  } catch (err) { next(err); }
});

/**
 * GET /api/charts/top-resources?months=...&limit=10
 */
router.get('/top-resources', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    let query = `
      SELECT MAX(full_name) as name, SUM(total_hours) as "totalHours", SUM(billable_hours) as "billableHours"
      FROM mv_resource_summary
    `;
    let params = [];
    if (req.selectedMonths) {
      query += ` WHERE year_month = ANY($1::text[])`;
      params.push(req.selectedMonths);
    }
    query += ` GROUP BY employee_id ORDER BY "totalHours" DESC LIMIT $${params.length + 1}`;

    const result = await pool.query(query, [...params, limit]);
    res.json(result.rows.map(r => ({ ...r, totalHours: Number(r.totalHours), billableHours: Number(r.billableHours) })));
  } catch (err) { next(err); }
});

module.exports = router;
