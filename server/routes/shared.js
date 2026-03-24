const express = require('express');
const { pool } = require('../db');

const router = express.Router();

/**
 * Helper to parse the `months` query parameter.
 * Converts "?months=2026-03,2026-04" into an array ['2026-03', '2026-04'].
 * If empty, returns null (meaning ALL months).
 */
function getSelectedMonths(req) {
  if (!req.query.months) return null;
  return req.query.months.split(',').map(m => m.trim()).filter(Boolean);
}

// Attach helper
router.use((req, res, next) => {
  req.selectedMonths = getSelectedMonths(req);
  next();
});

module.exports = router;
