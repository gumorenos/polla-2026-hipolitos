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

## 4. Audit Trail

All sensitive administrative events (league updates, user role promotions, match modifications, and results updates) write structured logs to the `AdminActionLog` table. This creates a transparent audit trail that can be viewed directly from the global Superadmin dashboard.
