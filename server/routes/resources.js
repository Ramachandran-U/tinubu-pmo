const express = require('express');
const { pool } = require('../db');
const shared = require('./shared');
const { entityToLocation } = require('../etl/entity-location');

const router = express.Router();
router.use(shared);

/**
 * GET /api/resources?months=...
 * Returns aggregated metrics per employee across the selected months.
 */
router.get('/', async (req, res, next) => {
  try {
    const { selectedMonths } = req;
    
    let query = `
      SELECT 
        employee_id as "employeeId",
        MAX(full_name) as "fullName",
        MAX(entity) as "entity",
        MAX(business_unit) as "businessUnit",
        MAX(department) as "department",
        MAX(designation) as "designation",
        SUM(total_hours) as "totalHours",
        SUM(billable_hours) as "billableHours"
      FROM mv_resource_summary
    `;
    
    const params = [];
    if (selectedMonths) {
      query += ` WHERE year_month = ANY($1::text[])`;
      params.push(selectedMonths);
    }
    
    query += ` GROUP BY employee_id ORDER BY "totalHours" DESC`;

    const result = await pool.query(query, params);

    // After fetching, attach the evaluated location derived from the entity,
    // and format any numbers
    let resources = result.rows.map(r => {
      const total = Number(r.totalHours || 0);
      const billable = Number(r.billableHours || 0);
      
      return {
        ...r,
        totalHours: total,
        billableHours: billable,
        billablePct: total > 0 ? Math.round((billable / total) * 100) : 0,
        location: entityToLocation(r.entity)
      };
    });

    res.json(resources);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
