const express = require('express');
const { pool } = require('../db');
const shared = require('./shared');
const { SKYE_EXCLUSION } = require('./shared');

const router = express.Router();
router.use(shared);

/**
 * GET /api/timelog?months=...&page=1&pageSize=50
 * Returns paginated raw timelog entries.
 */
router.get('/', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const offset = (page - 1) * pageSize;
    
    let whereClause = SKYE_EXCLUSION;
    let params = [];
    let paramCounter = 1;

    if (selectedMonths) {
      whereClause += ` AND year_month = ANY($${paramCounter}::text[])`;
      params.push(selectedMonths);
      paramCounter++;
    }

    if (req.query.client) {
      whereClause += ` AND client_name = $${paramCounter}`;
      params.push(req.query.client);
      paramCounter++;
    }

    if (req.query.search) {
      whereClause += ` AND (full_name ILIKE $${paramCounter} OR employee_id ILIKE $${paramCounter} OR project_name ILIKE $${paramCounter})`;
      params.push(`%${req.query.search}%`);
      paramCounter++;
    }

    // Count Total
    const countRes = await pool.query(`SELECT COUNT(*) FROM timelog_raw WHERE ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    // Fetch Rows
    const rowsRes = await pool.query(`
      SELECT date, employee_id as "employeeId", full_name as "fullName", client_name as "clientName",
             project_name as "projectName", task_name as "taskName", hours,
             billable_status as "billableStatus", approval_status as "approvalStatus"
      FROM timelog_raw
      WHERE ${whereClause}
      ORDER BY date DESC, full_name ASC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `, [...params, pageSize, offset]);

    // Format hours to float
    const rows = rowsRes.rows.map(r => ({ ...r, hours: Number(r.hours) }));

    res.json({ rows, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
