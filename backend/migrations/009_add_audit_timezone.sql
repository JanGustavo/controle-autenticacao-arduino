-- Preserve the original timestamp and record the timezone used when it was written.
-- Legacy rows inherit the database session timezone. If a database was imported
-- from a different timezone, reconcile those rows against the source backup.
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS created_at_timezone TEXT NOT NULL
    DEFAULT current_setting('TimeZone');
