const express = require('express');
const { pool } = require('../db');
const shared = require('./shared');

const router = express.Router();
router.use(shared);

/**
 * GET /api/attendance?months=...
 * Returns a matrix of employees and their daily attendance status, plus distinct active dates.
 */
router.get('/', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    
    // We get all attendance rows, and then pivot them in memory
    // because dynamic cross-tab pivoting in postgres is complex and rigid without knowing exact columns
    
    let query = `
      SELECT employee_id as "employeeId", employee_name as "name", department, location, date, status
      FROM attendance
    `;
    let params = [];
    if (selectedMonths) {
      query += ` WHERE year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }
    query += ` ORDER BY date ASC`;

    const result = await pool.query(query, params);
    const rawRows = result.rows;

    const employeesMap = new Map();
    const datesSet = new Set();

    rawRows.forEach(row => {
      const dateStr = row.date.toISOString().split('T')[0];
      datesSet.add(dateStr);

      if (!employeesMap.has(row.employeeId)) {
        employeesMap.set(row.employeeId, {
          employeeId: row.employeeId,
          name: row.name,
          department: row.department,
          location: row.location,
          days: {},
          presentDays: 0,
          absentDays: 0
        });
      }

      const emp = employeesMap.get(row.employeeId);
      emp.days[dateStr] = row.status;
      
      // Calculate basic aggregates inline
      if (row.status === 'P' || row.status === 'PDA') emp.presentDays++;
      if (row.status === 'A') emp.absentDays++;
    });

    const dates = Array.from(datesSet).sort();
    
    // Sort employees alphabetically
    const employees = Array.from(employeesMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    res.json({ employees, dates });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
