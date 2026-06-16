# Email Reminders Configuration and Production Setup

This document provides instructions for configuring and deploying the email reminder system for **La Polla Hipólitos 2026**.

## 1. Environment Variables

Add the following keys to your production `.env.local` file (refer to `.env.example`):

```env
# Enable reminders system globally
REMINDERS_ENABLED=true

# Enable the email alert channel
EMAIL_REMINDERS_ENABLED=true

# Minutes before kickoff to send reminder (default: 30)
REMINDER_MINUTES_BEFORE_DEADLINE=30

# Email provider configuration (Resend is the default supported provider)
EMAIL_PROVIDER=resend
RESEND_API_KEY="re_yourApiKeyGoesHere"
EMAIL_FROM="La Polla Hipólitos <no-reply@todoestaaca.com>"

# Application URL used for mapping redirect links in templates
APP_URL="https://pollahipolitos.todoestaaca.com"

# Maximum reminders allowed to send in a single run (safeguard)
REMINDERS_BATCH_LIMIT=50
```

## 2. Background Worker Execution

The background worker determines which matches start within 30 minutes, finds pool participants who have opted-in but haven't submitted a prediction yet, and fires an alert.

### Manual Run
Run the background script manually via:
```bash
npm run reminders:send-due
```

### Dry Run (Simulated Execution)
To audit what reminders would be sent without firing actual API requests to Resend or creating success/failure audit logs:
```bash
npm run reminders:send-due -- --dryRun
```

### Test Email Connectivity
To trigger a mock test email immediately to confirm connectivity and configuration validity:
```bash
npm run reminders:send-due -- --testEmail=your_email@example.com
```
Or combine with dry-run check:
```bash
npm run reminders:send-due -- --testEmail=your_email@example.com --dryRun
```

## 3. Production Cron Setup (Raspberry Pi 5)

On the production server, configure a cron job to trigger the check every 5 minutes. The script will automatically skip execution if no match kicks off in the next 30 minutes, or if all users have already predicted.

1. SSH into your Raspberry Pi 5.
2. Create the logs directory:
   ```bash
   mkdir -p /home/gumorenos/logs
   ```
3. Edit the crontab config:
   ```bash
   crontab -e
   ```
4. Append the following job to check for due reminders every 5 minutes:
   ```cron
   */5 * * * * cd /home/gumorenos/apps/polla-2026-hipolitos/app && npm run reminders:send-due >> /home/gumorenos/logs/reminders.log 2>&1
   ```
5. Save and exit. Logs will be written to `/home/gumorenos/logs/reminders.log`.
