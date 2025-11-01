-- =====================================================
-- Supabase Logging Automatic Cleanup Setup
-- =====================================================
-- This script sets up automatic deletion of old logs
-- using pg_cron (PostgreSQL extension for scheduled tasks)
-- =====================================================

-- Note: pg_cron is available on Supabase Pro and Enterprise plans
-- For Free tier, you'll need to use Supabase Cron Jobs (Database > Cron Jobs)

-- =====================================================
-- Option 1: Using pg_cron extension (Recommended)
-- =====================================================
-- This requires Supabase Pro or Enterprise plan
-- =====================================================

-- First, enable the pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup to delete logs older than 30 days
-- Runs daily at 2 AM UTC
SELECT cron.schedule(
  'cleanup-app-logs-daily',
  '0 2 * * *',  -- Every day at 2:00 AM UTC
  $$SELECT cleanup_old_logs(30)$$
);

-- Or schedule to keep logs for 7 days:
-- SELECT cron.schedule(
--   'cleanup-app-logs-daily',
--   '0 2 * * *',
--   $$SELECT cleanup_old_logs(7)$$
-- );

-- Or schedule to keep logs for 90 days:
-- SELECT cron.schedule(
--   'cleanup-app-logs-daily',
--   '0 2 * * *',
--   $$SELECT cleanup_old_logs(90)$$
-- );

-- =====================================================
-- View Scheduled Jobs
-- =====================================================
-- To see all scheduled cron jobs:
-- SELECT * FROM cron.job;

-- =====================================================
-- Remove Scheduled Job (if needed)
-- =====================================================
-- To remove the scheduled cleanup job:
-- SELECT cron.unschedule('cleanup-app-logs-daily');

-- =====================================================
-- Option 2: Using Supabase Cron Jobs (Free Tier)
-- =====================================================
-- For Supabase Free tier, use the Database > Cron Jobs interface:
-- 
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to Database > Cron Jobs
-- 3. Click "Create a new cron job"
-- 4. Configure:
--    - Name: cleanup-app-logs
--    - Schedule: 0 2 * * * (daily at 2 AM UTC)
--    - SQL Command: SELECT cleanup_old_logs(30);
--    - Enabled: Yes
-- 5. Click "Create cron job"
-- =====================================================

-- =====================================================
-- Alternative: More Aggressive Cleanup Options
-- =====================================================

-- Keep logs for only 7 days (more aggressive):
-- SELECT cron.schedule(
--   'cleanup-app-logs-weekly',
--   '0 2 * * *',
--   $$SELECT cleanup_old_logs(7)$$
-- );

-- Keep logs for 14 days:
-- SELECT cron.schedule(
--   'cleanup-app-logs-biweekly',
--   '0 2 * * *',
--   $$SELECT cleanup_old_logs(14)$$
-- );

-- Keep logs for 60 days:
-- SELECT cron.schedule(
--   'cleanup-app-logs-monthly',
--   '0 2 1 * *',  -- First day of month at 2 AM
--   $$SELECT cleanup_old_logs(60)$$
-- );

-- =====================================================
-- Cleanup by Log Level (Advanced)
-- =====================================================
-- If you want to keep error logs longer than other logs,
-- you can create a custom cleanup function:
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_logs_by_level(
  debug_days INTEGER DEFAULT 7,
  log_days INTEGER DEFAULT 14,
  warn_days INTEGER DEFAULT 30,
  error_days INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete debug logs older than debug_days
  DELETE FROM app_logs WHERE level = 'debug' 
    AND timestamp < NOW() - (debug_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete log-level logs older than log_days
  DELETE FROM app_logs WHERE level = 'log' 
    AND timestamp < NOW() - (log_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  -- Delete warn logs older than warn_days
  DELETE FROM app_logs WHERE level = 'warn' 
    AND timestamp < NOW() - (warn_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  -- Delete error logs older than error_days (longer retention for errors)
  DELETE FROM app_logs WHERE level = 'error' 
    AND timestamp < NOW() - (error_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Schedule the level-based cleanup (example: daily at 2 AM)
-- SELECT cron.schedule(
--   'cleanup-app-logs-by-level',
--   '0 2 * * *',
--   $$SELECT cleanup_old_logs_by_level(7, 14, 30, 90)$$
-- );

-- =====================================================
-- Verify Cleanup is Working
-- =====================================================
-- After setting up automatic cleanup, you can verify it's working:
-- =====================================================

-- Check how many logs will be deleted next run:
-- SELECT COUNT(*) as logs_to_delete
-- FROM app_logs
-- WHERE timestamp < NOW() - INTERVAL '30 days';

-- Check oldest log in database:
-- SELECT MIN(timestamp) as oldest_log
-- FROM app_logs;

-- Check recent cleanup activity (if using pg_cron):
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-app-logs-daily')
-- ORDER BY start_time DESC
-- LIMIT 10;

-- =====================================================
-- Manual Cleanup (if needed)
-- =====================================================
-- You can always manually trigger cleanup:
-- SELECT cleanup_old_logs(30);  -- Delete logs older than 30 days
-- =====================================================

