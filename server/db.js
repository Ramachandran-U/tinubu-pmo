const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

/**
 * Execute a parameterized SQL query.
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    console.log(`Slow query (${duration}ms):`, text.substring(0, 80));
  }
  return result;
}

/**
 * Refresh all materialized views (called after each upload).
 */
async function refreshViews() {
  console.log('Refreshing materialized views...');
  const start = Date.now();
  await pool.query('SELECT refresh_all_views()');
  console.log(`Views refreshed in ${Date.now() - start}ms`);
}

/**
 * Batch insert rows into a table.
 * @param {string} table - Table name
 * @param {string[]} columns - Column names
 * @param {Array<object>} rows - Array of row objects
 * @param {object} txClient - Optional existing client for transactions
 */
async function batchInsert(table, columns, rows, batchSize = 500, txClient = null) {
  const client = txClient || await pool.connect();
  try {
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];

      batch.forEach((row, batchIdx) => {
        const rowPlaceholders = columns.map((col, colIdx) => {
          values.push(row[col]);
          return `$${batchIdx * columns.length + colIdx + 1}`;
        });
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
      });

      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;
      await client.query(sql, values);
      inserted += batch.length;
    }
    return inserted;
  } finally {
    if (!txClient) client.release();
  }
}

/**
 * Get a client from the pool (for transactions).
 */
async function getClient() {
  return pool.connect();
}

module.exports = { pool, query, refreshViews, batchInsert, getClient };
