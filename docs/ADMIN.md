# Administration Documentation — La Polla 2026

This document describes the role hierarchy, administration tools, and audit log tracking for **La Polla 2026**.

---

## 1. Role Hierarchy

The application enforces a dual administration model:

| Role | Scope | Key Capabilities |
|------|-------|------------------|
| **League Owner** | Single League | Edit league details, view member list, promote/demote admins within the league, remove league members, regenerate invite codes. |
| **League Admin** | Single League | View member list, promote/demote admins, remove league members (cannot edit league details, reactivate/archive league, or modify the Owner). |
| **Superadmin (Global)** | All App | Manage teams, edit match schedules, enter final scores, trigger rankings recalculation globally. |

---

## 2. Admin Routes

All administration pages are protected server-side. Unauthenticated users are redirected to `/login`, and unauthorized users are redirected to `/liga`.

- **`/admin`**: Global dashboard showing app-wide statistics (total leagues, matches, users, predictions) and displaying the 10 most recent system audit logs.
- **`/admin/resultados`**: Interface for Superadmins to enter final match scores, which triggers automatic calculations of prediction points and league standings.
- **`/admin/partidos`**: Interface for Superadmins to update match schedules, kickoff timestamps, cities, venues, and status parameters.
- **`/admin/ligas`**: Global auditer for Superadmins to view, archive, or delete private leagues.
- **`/admin/usuarios`**: Interface for Superadmins to promote or demote other users to/from global Superadmin roles.

---

## 3. Audit Logging

Every critical administrative action is recorded in the `AdminActionLog` database table. The logged actions include:

- `league_creation`: Logged when a user creates a new league.
- `invite_regeneration`: Logged when a league owner/admin regenerates their league's invite code.
- `member_role_change`: Logged when a member is promoted to admin or demoted to member.
- `member_removal`: Logged when a member is removed/expelled from a league.
- `edit_match`: Logged when a Superadmin updates match parameters.
- `update_match_result`: Logged when a Superadmin updates final scores.
- `ranking_recalculation`: Logged when a Superadmin triggers a manual global standings recalculation.
