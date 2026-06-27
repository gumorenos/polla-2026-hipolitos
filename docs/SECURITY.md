# Security Guidelines — La Polla 2026

Security and fairness are critical for a competitive prediction pool. This document details the security model, authorization controls, and safety measures implemented in **La Polla 2026**.

---

## 1. Authentication Security

- **Library**: Better Auth.
- **Provider**: Email & Password with secure server-side bcrypt-equivalent hashing.
- **Session Strategy**: Session cookies are marked as `HttpOnly`, `Secure`, and `SameSite=Lax`. Sessions are kept in the database (`Session` table) with sliding 30-day expirations.
- **Client-Side Protection**: Session tokens are not exposed to JavaScript, preventing token leakage through XSS.

---

## 2. Server-Side Authorization Enforcements

Client-provided parameters are never trusted. All access control checks are validated at the server level on every route render and mutation action:

- **Route Protection**: Middleware (`middleware.ts`) protects all routes except `/login`, `/register`, and static assets. 
- **Superadmin Guards**: Global actions (updating scores, modifying matches, toggling superadmins) fetch the session user ID from the database and verify `isSuperadmin === true`.
- **Role Hierarchy**: 
  - Admins cannot modify owners.
  - Users cannot modify or remove themselves from administrative roles if it leaves the league with zero owners.
  - Admins can only modify members, not other admins.

---

## 3. Prediction Fairness & Cutoff Locks

- **Server-Side Lock**: A prediction can only be submitted or updated when `match.kickoffUtc > new Date()`.
- **Enforcement**: This check is performed inside the `savePredictionAction` Server Action. Even if a user attempts to bypass the client UI or send a direct payload, the server checks the current timestamp against the match's kickoff timestamp fetched from the database.

---

## 4. API Key Protection and Rate Limiting

- **Server-Only API Keys:** Las API keys pueden almacenarse cifradas en `ProviderCredential` usando `API_KEYS_ENCRYPTION_SECRET`, con variables de entorno como respaldo. Nunca se exponen con prefijo `NEXT_PUBLIC_`, al cliente o en logs.
- **Concurrency Rate-Limiting Protection:** Manual user odds refreshes are locked to 1 request per local day per user (America/Lima timezone). To prevent race conditions or double-click bypasses, this rate limit check and usage logging is executed in a single atomic database transaction.

---

## 5. Audit Trail

All sensitive administrative events (league updates, user role promotions, match modifications, results updates, and global odds/H2H updates) write structured logs to the `AdminActionLog` table. This creates a transparent audit trail that can be viewed directly from the global Superadmin dashboard.

---

## 6. Dependency Vulnerability Status

We periodically audit our dependencies to minimize vulnerability exposure:

- **esbuild / vite**: Any reported vulnerabilities in esbuild or Vite are contained within development-only tooling and do not impact the production Next.js runtime environment.
- **postcss**: Managed and tracked directly as an internal dependency of the `next` framework packages. Next.js releases regularly include updates to its sub-dependencies.
- **xlsx**: The Excel spreadsheet library was completely uninstalled and removed from our dependencies due to high-severity vulnerabilities without available patches. Excel results import/export has been replaced by native RFC 4180-compliant CSV generation and parsing, eliminating the risk entirely.


