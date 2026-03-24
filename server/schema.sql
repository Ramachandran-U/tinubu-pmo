-- ============================================================
-- Tinubu PMO Dashboard — Database Schema
-- Run via: node server/migrate.js
-- ============================================================

-- ━━━ Upload audit trail ━━━
CREATE TABLE IF NOT EXISTS uploads (
    id              SERIAL PRIMARY KEY,
    upload_id       TEXT UNIQUE NOT NULL,
    file_type       TEXT NOT NULL,
    file_name       TEXT NOT NULL,
    file_size_bytes INTEGER,
    year_month      TEXT NOT NULL,
    row_count       INTEGER DEFAULT 0,
    status          TEXT DEFAULT 'processing',
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━ Raw timelog (one row per time entry) ━━━
CREATE TABLE IF NOT EXISTS timelog_raw (
    id              SERIAL PRIMARY KEY,
    upload_id       TEXT NOT NULL REFERENCES uploads(upload_id),
    year_month      TEXT NOT NULL,
    date            DATE NOT NULL,
    hours           NUMERIC(6,1) NOT NULL,
    entity          TEXT,
    business_unit   TEXT,
    department      TEXT,
    designation     TEXT,
    employee_id     TEXT NOT NULL,
    full_name       TEXT,
    last_name       TEXT,
    first_name      TEXT,
    client_name     TEXT,
    project_name    TEXT,
    approval_status TEXT,
    billable_status TEXT,
    task_name       TEXT,
    task_code       TEXT,
    jira_no         TEXT,
    contractor_company TEXT,
    comment         TEXT
);

CREATE INDEX IF NOT EXISTS idx_tl_year_month ON timelog_raw(year_month);
CREATE INDEX IF NOT EXISTS idx_tl_employee   ON timelog_raw(employee_id);
CREATE INDEX IF NOT EXISTS idx_tl_client     ON timelog_raw(client_name);
CREATE INDEX IF NOT EXISTS idx_tl_upload     ON timelog_raw(upload_id);
CREATE INDEX IF NOT EXISTS idx_tl_date       ON timelog_raw(date);

-- ━━━ Attendance (one row per employee per day) ━━━
CREATE TABLE IF NOT EXISTS attendance (
    id              SERIAL PRIMARY KEY,
    upload_id       TEXT NOT NULL REFERENCES uploads(upload_id),
    year_month      TEXT NOT NULL,
    date            DATE NOT NULL,
    employee_id     TEXT NOT NULL,
    employee_name   TEXT,
    email           TEXT,
    entity          TEXT,
    business_unit   TEXT,
    department      TEXT,
    designation     TEXT,
    location        TEXT,
    status          TEXT NOT NULL,
    UNIQUE(year_month, date, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_att_year_month ON attendance(year_month);
CREATE INDEX IF NOT EXISTS idx_att_employee   ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_upload     ON attendance(upload_id);


-- ============================================================
-- Materialized Views (refreshed after each upload)
-- ============================================================

-- ━━━ Per-employee monthly summary ━━━
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_matviews WHERE matviewname = 'mv_resource_summary'
  ) THEN
    EXECUTE '
      CREATE MATERIALIZED VIEW mv_resource_summary AS
      SELECT
          employee_id,
          MAX(full_name)          AS full_name,
          MAX(entity)             AS entity,
          MAX(business_unit)      AS business_unit,
          MAX(department)         AS department,
          MAX(designation)        AS designation,
          year_month,
          SUM(hours)                                                    AS total_hours,
          SUM(hours) FILTER (WHERE billable_status = ''Billable'')     AS billable_hours,
          COUNT(DISTINCT client_name)                                   AS unique_clients,
          COUNT(DISTINCT project_name)                                  AS unique_projects
      FROM timelog_raw
      GROUP BY employee_id, year_month
    ';
    CREATE UNIQUE INDEX ON mv_resource_summary (employee_id, year_month);
  END IF;
END $$;

-- ━━━ Monthly KPI aggregates ━━━
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_matviews WHERE matviewname = 'mv_kpis_monthly'
  ) THEN
    EXECUTE '
      CREATE MATERIALIZED VIEW mv_kpis_monthly AS
      SELECT
          year_month,
          SUM(hours)                                                    AS total_hours,
          SUM(hours) FILTER (WHERE billable_status = ''Billable'')     AS billable_hours,
          SUM(hours) FILTER (WHERE billable_status != ''Billable'')    AS non_billable_hours,
          COUNT(DISTINCT employee_id)                                   AS unique_employees,
          COUNT(DISTINCT client_name)                                   AS unique_clients,
          COUNT(DISTINCT project_name)                                  AS unique_projects
      FROM timelog_raw
      GROUP BY year_month
    ';
    CREATE UNIQUE INDEX ON mv_kpis_monthly (year_month);
  END IF;
END $$;

-- ━━━ Client hours per month ━━━
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_matviews WHERE matviewname = 'mv_client_hours'
  ) THEN
    EXECUTE '
      CREATE MATERIALIZED VIEW mv_client_hours AS
      SELECT
          year_month,
          client_name,
          SUM(hours) AS total_hours,
          SUM(hours) FILTER (WHERE billable_status = ''Billable'') AS billable_hours,
          COUNT(DISTINCT employee_id) AS headcount,
          COUNT(DISTINCT project_name) AS project_count
      FROM timelog_raw
      GROUP BY year_month, client_name
    ';
    CREATE UNIQUE INDEX ON mv_client_hours (year_month, client_name);
  END IF;
END $$;

-- ━━━ Department hours per month ━━━
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_matviews WHERE matviewname = 'mv_dept_hours'
  ) THEN
    EXECUTE '
      CREATE MATERIALIZED VIEW mv_dept_hours AS
      SELECT
          year_month,
          department,
          SUM(hours) AS total_hours,
          SUM(hours) FILTER (WHERE billable_status = ''Billable'') AS billable_hours,
          COUNT(DISTINCT employee_id) AS headcount
      FROM timelog_raw
      GROUP BY year_month, department
    ';
    CREATE UNIQUE INDEX ON mv_dept_hours (year_month, department);
  END IF;
END $$;

-- ━━━ Attendance summary per employee per month ━━━
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_matviews WHERE matviewname = 'mv_attendance_summary'
  ) THEN
    EXECUTE '
      CREATE MATERIALIZED VIEW mv_attendance_summary AS
      SELECT
          year_month,
          employee_id,
          MAX(employee_name) AS employee_name,
          MAX(location) AS location,
          MAX(department) AS department,
          COUNT(*) FILTER (WHERE status = ''P'' OR status = ''PDA'')  AS present_days,
          COUNT(*) FILTER (WHERE status = ''A'')                      AS absent_days,
          COUNT(*) FILTER (WHERE status = ''W'')                      AS weekend_days,
          COUNT(*) FILTER (WHERE status = ''H'')                      AS holiday_days,
          COUNT(*) FILTER (WHERE status NOT IN (''P'',''PDA'',''A'',''W'',''H'',''-'',''''))  AS leave_days
      FROM attendance
      GROUP BY year_month, employee_id
    ';
    CREATE UNIQUE INDEX ON mv_attendance_summary (year_month, employee_id);
  END IF;
END $$;


-- ============================================================
-- Refresh function (called after each upload)
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_all_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_resource_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpis_monthly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_client_hours;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dept_hours;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attendance_summary;
END;
$$ LANGUAGE plpgsql;
