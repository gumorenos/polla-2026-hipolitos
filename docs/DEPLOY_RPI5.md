# Raspberry Pi 5 Production Deployment Guide — La Polla 2026

This guide explains how to set up the production environment and deploy the **La Polla 2026** web application on a self-hosted Raspberry Pi 5.

---

## 1. System Requirements

- **Device:** Raspberry Pi 5 (4GB or 8GB RAM recommended)
- **OS:** Raspberry Pi OS 64-bit (Debian Bookworm)
- **Node.js:** version 22 (LTS) ARM64
- **Database:** SQLite
- **Process Manager:** PM2
- **Proxy/SSL:** Cloudflare Tunnel (`cloudflared`)

---

## 2. Directory & Database Setup

The production database is stored **outside** the application repository directory at `/var/lib/la-polla-2026/prod.db`. This isolates persistent database records from application pulls or reinstalls.

### Create Directories & Set Permissions
Execute the following commands on the Raspberry Pi 5 terminal to create the database directory and assign write permissions to the application execution user (e.g., `pi` or `admin`):

```bash
# Create directories for DB and daily backups
sudo mkdir -p /var/lib/la-polla-2026/backups

# Change ownership to the active user (replace 'pi' with your application execution user)
sudo chown -R pi:pi /var/lib/la-polla-2026/
sudo chmod -R 770 /var/lib/la-polla-2026/
```

---

## 3. Environment Configuration

Create a `.env` or `.env.local` file inside the cloned repository root folder (`/home/pi/lapolla2026/app/.env`) containing the production settings:

```env
# Production SQLite Connection String
DATABASE_URL="file:/var/lib/la-polla-2026/prod.db?connection_limit=1&socket_timeout=20"

# Hashed Secrets
BETTER_AUTH_SECRET="<generate-random-32-byte-hex-key>"

# Application URLs
APP_URL="https://lapolla.yourdomain.com"
BETTER_AUTH_URL="https://lapolla.yourdomain.com"
NODE_ENV=production
PORT=3000
```

> [!WARNING]
> Never commit this `.env` file to git. It is ignored by the root `.gitignore`.

---

## 4. Deployment Steps

Deployment utilizes a direct **Git Pull** delivery pipeline. Executed on the Raspberry Pi 5:

```bash
# 1. Pull the latest code from GitHub
cd /home/pi/lapolla2026
git pull origin main

# 2. Install production dependencies
cd app
npm install --omit=dev

# 3. Apply database schema migrations
npx prisma migrate deploy

# 4. Seed teams and matches (safe for execution multiple times; runs upserts)
npx prisma db seed

# 5. Build Next.js production optimize bundle
npm run build

# 6. Restart/Reload application via PM2
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js
```

---

## 5. Automated Database Backups

To protect against database corruption, configure a daily automated backup cron job. 

Create a cron file at `/etc/cron.d/lapolla-backup` on the Raspberry Pi:

```bash
# /etc/cron.d/lapolla-backup
# Execute daily backup at 3:00 AM using the application user 'pi'
0 3 * * * pi sqlite3 /var/lib/la-polla-2026/prod.db ".backup '/var/lib/la-polla-2026/backups/lapolla-$(date +\%Y\%m\%d).sqlite'" && find /var/lib/la-polla-2026/backups -name 'lapolla-*.sqlite' -mtime +30 -delete
```

This script:
1. Performs a non-blocking online backup of the SQLite database using `.backup`.
2. Stores it with a date suffix.
3. Automatically purges backups older than 30 days.

---

## 6. PM2 Configuration

Ensure PM2 is configured to restart the app on system reboots:

```bash
# Generate PM2 startup script
pm2 startup

# Follow the output instructions to copy-paste the sudo command
# Save current running processes
pm2 save
```
