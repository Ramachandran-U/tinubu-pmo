const express = require('express');
const { pool } = require('../db');

const router = express.Router();

/**
 * GET /api/months
 * Returns a list of all distinct `year_month` periods present in the database, sorted descending.
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT year_month 
       FROM timelog_raw 
       ORDER BY year_month DESC`
    );
    res.json({ months: result.rows.map(r => r.year_month) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/uploads
 * Returns the audit trail of all file uploads.
 */
router.get('/uploads', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, upload_id, file_type, file_name, file_size_bytes, year_month, row_count, status, error_message, created_at 
       FROM uploads 
       ORDER BY created_at DESC 
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
