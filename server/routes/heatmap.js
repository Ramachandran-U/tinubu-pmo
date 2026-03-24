const express = require('express');
const { pool } = require('../db');
const shared = require('./shared');

const router = express.Router();
router.use(shared);

/**
 * GET /api/heatmap?months=...
 * Returns daily aggregated billable and non-billable hours.
 */
router.get('/', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    
    // Aggregate global hours per day, split by billing status
    let query = `
      SELECT 
        date,
        SUM(CASE WHEN billable_status = 'Billable' THEN hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN billable_status != 'Billable' THEN hours ELSE 0 END) as non_billable_hours
      FROM timelog_raw
    `;
    
    let params = [];
    if (selectedMonths) {
      query += ` WHERE year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }
    
    query += ` GROUP BY date ORDER BY date ASC`;

    const result = await pool.query(query, params);

    const heatmap = result.rows.map(row => ({
      dateStr: row.date.toISOString().split('T')[0],
      billableHours: Number(row.billable_hours),
      nonBillableHours: Number(row.non_billable_hours)
    }));

    res.json(heatmap);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
