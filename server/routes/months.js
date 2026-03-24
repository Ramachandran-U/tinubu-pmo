const express = require('express');
const { pool } = require('../db');

const router = express.Router();

/**
 * GET /api/months
 * Returns distinct year_month periods with active upload version info.
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
 * GET /api/months/uploads
 * Returns the audit trail of all file uploads with version info.
 */
router.get('/uploads', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, upload_id, file_type, file_name, file_size_bytes, year_month,
              row_count, status, error_message, version, is_active, uploaded_by, created_at
       FROM uploads
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/months/active-versions
 * Returns the currently active upload version for each year_month + file_type combo.
 */
router.get('/active-versions', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT year_month, file_type, version, file_name, row_count, created_at
       FROM uploads
       WHERE is_active = TRUE AND status = 'success'
       ORDER BY year_month DESC, file_type`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
