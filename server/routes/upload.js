const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool, getClient, refreshViews, batchInsert } = require('../db');
const { parseTimelog } = require('../etl/parse-timelog');
const { parseAttendance } = require('../etl/parse-attendance');

const router = express.Router();

// Setup multer for temporary file storage
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: (process.env.MAX_UPLOAD_SIZE_MB || 15) * 1024 * 1024 }
});

/**
 * Get next version number for a file_type + year_month combo
 */
async function getNextVersion(client, fileType, yearMonth) {
  const res = await client.query(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
     FROM uploads WHERE file_type = $1 AND year_month = $2 AND status = 'success'`,
    [fileType, yearMonth]
  );
  return res.rows[0].next_version;
}

/**
 * Deactivate previous uploads for a file_type + year_month
 */
async function deactivatePrevious(client, fileType, yearMonth) {
  await client.query(
    `UPDATE uploads SET is_active = FALSE
     WHERE file_type = $1 AND year_month = $2 AND is_active = TRUE`,
    [fileType, yearMonth]
  );
}

/**
 * Handle POST /api/upload/timelog
 */
router.post('/timelog', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const uploadId = 'tl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const startTime = Date.now();
  let client;

  try {
    // 1. Initial Insert into Audit Trail
    await pool.query(
      `INSERT INTO uploads (upload_id, file_type, file_name, file_size_bytes, year_month, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uploadId, 'timelog', req.file.originalname, req.file.size, 'pending', 'processing']
    );

    // 2. Parse using ETL script
    console.log(`[Upload ${uploadId}] Parsing Time Log file...`);
    const { rows, yearMonth } = await parseTimelog(req.file.path);
    console.log(`[Upload ${uploadId}] Parsed ${rows.length} rows for period ${yearMonth}.`);

    if (rows.length === 0) {
      throw new Error("No valid rows found in the uploaded file.");
    }

    // Assign the upload_id to all rows
    rows.forEach(r => r.upload_id = uploadId);

    // 3. Database Transaction: Version-based replacement
    client = await getClient();
    await client.query('BEGIN');

    // Get next version & deactivate previous uploads
    const version = await getNextVersion(client, 'timelog', yearMonth);
    await deactivatePrevious(client, 'timelog', yearMonth);

    // Delete existing records for this period (keep using replace strategy for data tables)
    const resDelete = await client.query('DELETE FROM timelog_raw WHERE year_month = $1', [yearMonth]);
    console.log(`[Upload ${uploadId}] Deleted ${resDelete.rowCount} existing records for ${yearMonth}.`);

    // Batch Insert new records
    const columns = [
      'upload_id', 'year_month', 'date', 'hours', 'entity', 'business_unit', 'department',
      'designation', 'employee_id', 'full_name', 'last_name', 'first_name', 'client_name',
      'project_name', 'approval_status', 'billable_status', 'task_name', 'task_code',
      'jira_no', 'contractor_company', 'comment'
    ];

    const insertedCount = await batchInsert('timelog_raw', columns, rows, 500, client);
    console.log(`[Upload ${uploadId}] Inserted ${insertedCount} new records.`);

    // Update the Audit Log with version info
    await client.query(
      `UPDATE uploads SET status = 'success', row_count = $1, year_month = $2, version = $3, is_active = TRUE
       WHERE upload_id = $4`,
      [insertedCount, yearMonth, version, uploadId]
    );

    // Refresh Materialized Views
    await client.query('SELECT refresh_all_views()');

    await client.query('COMMIT');

    // Cleanup temporary file
    fs.unlinkSync(req.file.path);

    const durationMs = Date.now() - startTime;
    res.json({
      success: true,
      uploadId,
      yearMonth,
      rowCount: insertedCount,
      version,
      durationMs
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error(`[Upload ${uploadId}] Error:`, error.message);

    try {
      await pool.query(
        `UPDATE uploads SET status = 'failed', error_message = $1 WHERE upload_id = $2`,
        [error.message.substring(0, 500), uploadId]
      );
    } catch (auditErr) { /* ignore secondary failure */ }

    // Cleanup temporary file
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    next(error);
  } finally {
    if (client) client.release();
  }
});


/**
 * Handle POST /api/upload/attendance
 */
router.post('/attendance', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const uploadId = 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const startTime = Date.now();
  let client;

  try {
    // 1. Initial Insert into Audit Trail
    await pool.query(
      `INSERT INTO uploads (upload_id, file_type, file_name, file_size_bytes, year_month, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uploadId, 'attendance', req.file.originalname, req.file.size, 'pending', 'processing']
    );

    // 2. Parse using ETL script
    console.log(`[Upload ${uploadId}] Parsing Attendance Muster Roll file...`);
    const { rows, yearMonth } = await parseAttendance(req.file.path);
    console.log(`[Upload ${uploadId}] Parsed ${rows.length} day-status rows for period ${yearMonth}.`);

    if (rows.length === 0) {
      throw new Error("No valid rows found in the uploaded file.");
    }

    // Assign the upload_id to all rows
    rows.forEach(r => r.upload_id = uploadId);

    // 3. Database Transaction: Version-based replacement
    client = await getClient();
    await client.query('BEGIN');

    // Get next version & deactivate previous uploads
    const version = await getNextVersion(client, 'attendance', yearMonth);
    await deactivatePrevious(client, 'attendance', yearMonth);

    // Delete existing records for this period
    const resDelete = await client.query('DELETE FROM attendance WHERE year_month = $1', [yearMonth]);
    console.log(`[Upload ${uploadId}] Deleted ${resDelete.rowCount} existing records for ${yearMonth}.`);

    // Batch Insert new records
    const columns = [
      'upload_id', 'year_month', 'date', 'employee_id', 'employee_name', 'email',
      'entity', 'business_unit', 'department', 'designation', 'location', 'status'
    ];

    const insertedCount = await batchInsert('attendance', columns, rows, 500, client);
    console.log(`[Upload ${uploadId}] Inserted ${insertedCount} new records.`);

    // Update the Audit Log with version info
    await client.query(
      `UPDATE uploads SET status = 'success', row_count = $1, year_month = $2, version = $3, is_active = TRUE
       WHERE upload_id = $4`,
      [insertedCount, yearMonth, version, uploadId]
    );

    // Refresh Materialized Views
    await client.query('SELECT refresh_all_views()');

    await client.query('COMMIT');

    // Cleanup temporary file
    fs.unlinkSync(req.file.path);

    const durationMs = Date.now() - startTime;
    res.json({
      success: true,
      uploadId,
      yearMonth,
      rowCount: insertedCount,
      version,
      durationMs
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error(`[Upload ${uploadId}] Error:`, error.message);

    try {
      await pool.query(
        `UPDATE uploads SET status = 'failed', error_message = $1 WHERE upload_id = $2`,
        [error.message.substring(0, 500), uploadId]
      );
    } catch (auditErr) { /* ignore */ }

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(error);
  } finally {
    if (client) client.release();
  }
});

/**
 * GET /api/upload/history?yearMonth=2026-03&fileType=timelog
 * Returns version history for a specific period and file type.
 */
router.get('/history', async (req, res, next) => {
  try {
    const { yearMonth, fileType } = req.query;
    let query = `
      SELECT upload_id, file_type, file_name, file_size_bytes, year_month,
             row_count, status, version, is_active, uploaded_by, created_at
      FROM uploads
      WHERE status = 'success'
    `;
    const params = [];
    if (yearMonth) {
      params.push(yearMonth);
      query += ` AND year_month = $${params.length}`;
    }
    if (fileType) {
      params.push(fileType);
      query += ` AND file_type = $${params.length}`;
    }
    query += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/upload/:uploadId/restore
 * Restore a previous upload version as the active one.
 */
router.post('/:uploadId/restore', async (req, res, next) => {
  const { uploadId } = req.params;
  let client;
  try {
    client = await getClient();
    await client.query('BEGIN');

    // Find the upload to restore
    const uploadRes = await client.query(
      `SELECT * FROM uploads WHERE upload_id = $1 AND status = 'success'`,
      [uploadId]
    );
    if (uploadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Upload not found or not successful.' });
    }
    const upload = uploadRes.rows[0];

    // Deactivate all uploads for this file_type + year_month
    await client.query(
      `UPDATE uploads SET is_active = FALSE
       WHERE file_type = $1 AND year_month = $2`,
      [upload.file_type, upload.year_month]
    );

    // Activate the selected one
    await client.query(
      `UPDATE uploads SET is_active = TRUE WHERE upload_id = $1`,
      [uploadId]
    );

    // Note: data restoration would require keeping old rows, which we don't do yet.
    // For now, versioning tracks the audit trail. Full data restore requires keeping
    // old rows tagged by upload_id (future enhancement).

    await client.query('COMMIT');
    res.json({ success: true, restoredUploadId: uploadId });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    next(err);
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
