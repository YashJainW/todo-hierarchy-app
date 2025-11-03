# Automatic Deletion of Completed Todos (Server-Side)

This sets up a daily, server-run cleanup that deletes completed todo trees older than a retention window per user. It does not depend on the app being opened or the user being logged in.

Behavior:

- Enabled by default for all users.
- If a user enables auto-deletion and sets N days, retention is N (capped at 365).
- If a user disables it, a hard retention of 365 days is still enforced.
- Deletes top-most completed trees and all their descendants (same logic as Clear All).

## 1) Deploy Edge Function

You can deploy the Edge Function in two ways:

### Option A: Using Supabase Dashboard (Recommended for beginners)

1. Go to your Supabase Dashboard → **Edge Functions** (in the left sidebar)
2. Click **"Create a new function"** or **"New Function"**
3. Name it: `auto-delete`
4. Copy the entire contents of `supabase/functions/auto-delete/index.ts` into the editor
5. Click **"Deploy"**

### Option B: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Make sure you're in your project root
supabase functions deploy auto-delete --no-verify-jwt
```

**Note**: The `--no-verify-jwt` flag allows the function to run without authentication, which is needed for cron jobs.

## 2) Set Environment Variables (Secrets)

The function needs these environment variables (note: Supabase Dashboard forbids names starting with `SUPABASE_` for Function Secrets):

1. **PROJECT_URL**: Use the same URL as your `EXPO_PUBLIC_SUPABASE_URL` (without the `EXPO_PUBLIC_` prefix)

   - Example: If your Expo env has `EXPO_PUBLIC_SUPABASE_URL=https://abc123.supabase.co`, use `https://abc123.supabase.co`

2. **SERVICE_ROLE_KEY**: Find this in Supabase Dashboard
   - Go to: **Project Settings** → **API** → Scroll to **Project API keys**
   - Copy the **`service_role`** key (it's labeled as "secret" - keep it secret!)
   - ⚠️ **Warning**: This key bypasses Row Level Security. Never expose it in client-side code.

### Option A: Using Supabase Dashboard (Recommended)

1. Go to **Edge Functions** → Click on your `auto-delete` function
2. Look for **"Secrets"** or **"Environment Variables"** section
3. Click **"Add Secret"** or **"New Secret"**
4. Add these two secrets:
   - Name: `PROJECT_URL`, Value: `https://YOUR_PROJECT_ID.supabase.co`
   - Name: `SERVICE_ROLE_KEY`, Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
5. Click **"Save"** or **"Update"**

### Option B: Using Supabase CLI

```bash
# Replace with your actual values
supabase secrets set PROJECT_URL="https://YOUR_PROJECT_ID.supabase.co"
supabase secrets set SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example:**

```bash
supabase secrets set PROJECT_URL="https://abc123xyz.supabase.co"
supabase secrets set SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiYzEyM3h5eiIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDU3ODk2MDAsImV4cCI6MTk2MTM2NTYwMH0.abc123..."
```

## 3) Create a Daily Cron Job

You can schedule the function to run daily using one of these methods:

### Option A: Using Supabase Dashboard (pg_cron via SQL Editor)

1. Go to your Supabase Dashboard → **SQL Editor**
2. Enable required extensions (if not already enabled):

```sql
-- Enable pg_cron for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable http extension for making HTTP requests (if not available, you may need to enable it via Database → Extensions)
CREATE EXTENSION IF NOT EXISTS http;
```

**Note:** If `http` extension is not available, check **Database** → **Extensions** in your Supabase Dashboard and enable it there.

3. Create a scheduled job that calls your Edge Function:

```sql
SELECT cron.schedule(
  'auto-delete-daily',           -- Job name
  '0 3 * * *',                   -- Cron schedule: Daily at 03:00 UTC
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/auto-delete',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

**Replace:**

- `YOUR_PROJECT_ID` with your Supabase project ID (from your project URL)
- `YOUR_SERVICE_ROLE_KEY` with your service_role key from Project Settings → API

**To test the cron job immediately:**

```sql
SELECT cron.run('auto-delete-daily');
```

**To view scheduled jobs:**

```sql
SELECT * FROM cron.job;
```

**To unschedule/delete a job:**

```sql
SELECT cron.unschedule('auto-delete-daily');
```

### Option B: Using Supabase CLI

```bash
supabase functions schedule create auto-delete-daily \
  --cron "0 3 * * *" \
  --endpoint "/functions/v1/auto-delete"
```

**Note:** The cron schedule `0 3 * * *` runs every day at 03:00 UTC. Adjust as needed:

- `0 3 * * *` = Daily at 3 AM UTC
- `0 */6 * * *` = Every 6 hours
- `0 0 * * 0` = Weekly on Sunday at midnight UTC

## 4) Test Manually (Optional)

**Important:** Make sure JWT verification is disabled on the function (see Step 1).

### Test via curl (No Authorization needed if JWT verification is disabled):

**Full run (all users):**

```bash
curl -L -X POST 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/auto-delete' \
  -H 'Content-Type: application/json' \
  --data '{}'
```

**Test for a specific user:**

```bash
curl -L -X POST 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/auto-delete?userId=USER_UUID' \
  -H 'Content-Type: application/json' \
  --data '{}'
```

**Expected response:**

```json
{
  "ok": true,
  "deleted": 5
}
```

### Test via Supabase Dashboard:

1. Go to **Edge Functions** → Click on `auto-delete`
2. Click **"Invoke"** or **"Test"** tab
3. Set **Method**: `POST`
4. Set **Body**: `{}`
5. Click **"Invoke Function"**

**Note:** If you get authentication errors, ensure JWT verification is disabled in the function settings.

## Notes

- Function reads `user_metadata.autoDeleteEnabled` and `user_metadata.autoDeleteDays`.
- If not present, defaults to enabled with 30 days; if disabled, uses 365 days.
- Tree detection uses parent links (`parent_todo_id` or `parent_id`).
