# Authentication Documentation — La Polla 2026

La Polla 2026 uses **Better Auth** with its built-in Prisma adapter configured for **SQLite** to manage secure, standalone credentials-based authentication.

---

## 1. Authentication Architecture

Better Auth is configured for local email & password login. It operates entirely self-hosted without external dependencies (no Supabase, no SaaS API keys, no social OAuth required by default).

### Key Components:
- **Server Configuration (`app/src/lib/auth.ts`):** Defines database adapter, password providers, and custom fields mapping.
- **React Client Wrapper (`app/src/lib/auth-client.ts`):** Exposes auth triggers and standard hooks like `useSession` for client-side pages.
- **API Catch-All Route (`app/src/app/api/auth/[...all]/route.ts`):** Better Auth handler that maps REST endpoints to Next.js route handlers.
- **Route Guard Middleware (`app/src/middleware.ts`):** Intercepts requests to protected pages, calls `/api/auth/get-session` internally forwarding cookies, and handles redirects.

---

## 2. Session Management

- Sessions are **database-backed** rather than JWT-only, allowing instant revocation (upon user logout or session expiration).
- A session is registered in the `Session` table in SQLite.
- The corresponding session token is transmitted via an HTTP cookie named `better-auth.session_token` with `HttpOnly`, `Secure` (in production), and `SameSite=Lax` properties to guard against XSS and CSRF attacks.

---

## 3. Database Schema

Better Auth populates and manages four tables in the Prisma schema:
- **`user`:** Extends user metadata. Contains our custom columns:
  - `displayName` (nullable string): Profile username.
  - `whatsapp` (nullable string): Phone number for kickoff notifications.
  - `isSuperadmin` (boolean, defaults to `false`): Superadmin dashboard privileges.
- **`session`:** Stores active browser login tokens.
- **`account`:** Stores authentication methods. For email/password login, `providerId` is set to `"email"`, `accountId` holds the user email, and the `password` field holds the scrypt hashed password.
- **`verification`:** Stores validation and sign-up verification tokens.

---

## 4. SQLite Concurrency & WAL Mode

Since SQLite is a file-based single-instance database, high concurrency during close prediction deadlines could lead to write contention (`SQLITE_BUSY`). To prevent locking issues, we configure:
1. **Connection Pooling in Dev/Prod:** Connection limit is clamped to 1 in connection strings:
   `DATABASE_URL="file:./dev.db?connection_limit=1&socket_timeout=20"`
2. **Write-Ahead Logging (WAL) Mode:** WAL mode is persistently set on the database by running:
   ```sql
   PRAGMA journal_mode=WAL;
   PRAGMA synchronous=NORMAL;
   PRAGMA foreign_keys=ON;
   ```
   This allows simultaneous reads while a write transaction is executing.

---

## 5. Development Credentials

The seed script (`app/prisma/seed.ts`) automatically populates test users with secure hashed passwords:
- **Superadmin:**
  - Email: `gustavo@example.com`
  - Password: `Admin123!`
- **Standard User:**
  - Email: `carlos@example.com`
  - Password: `User123!`

---

## 6. How to Promote a User to Admin Locally

If a user registers or is created programmatically, they can be elevated to Superadmin status directly via SQLite:

### Option A: Using Prisma Studio (Recommended)
1. Run Prisma Studio in the `app` folder:
   ```bash
   npx prisma studio
   ```
2. Navigate to the `User` model.
3. Find the row matching the user's email.
4. Double click the `isSuperadmin` field and toggle it to `true`.
5. Click **Save Changes** in the top bar.

### Option B: Using SQLite CLI
1. Open the SQLite database file:
   ```bash
   sqlite3 app/prisma/dev.db
   ```
2. Execute the update query:
   ```sql
   UPDATE user SET isSuperadmin = 1 WHERE email = 'target-user@example.com';
   .exit
   ```

---

## 7. Origin Configuration & Security

To prevent "Invalid origin" errors during registration or login (especially when deploying behind a reverse proxy or Cloudflare Tunnel), the server configuration validates requests against allowed hosts and origins.

### Environment Variables:
- **`BETTER_AUTH_URL`** (or fallback **`APP_URL`**): Specifies the base URL for Better Auth. Defaults to `http://localhost:3000` in development.
- **`TRUSTED_ORIGINS`**: A comma-separated list of additional trusted origins (e.g. `https://pollahipolitos.todoestaaca.com,http://localhost:3030`).

### Built-in Fallback Trusted Origins:
Better Auth is pre-configured with the following fallback origins:
- `https://pollahipolitos.todoestaaca.com`
- `http://localhost:3000`
- `http://localhost:3030`
- `http://192.168.100.53:3030`
