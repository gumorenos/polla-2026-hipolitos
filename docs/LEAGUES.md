# Private Leagues & Invitation Flow — La Polla 2026

La Polla 2026 is designed for private, invite-only prediction pools. This document details the database relationships, access controls, joining pipeline, and roles structure.

---

## 1. Relational Database Design

The leagues and memberships are governed by the following Prisma models in `schema.prisma`:

- **`League` Model:**
  - `id` (CUID): Primary key.
  - `name` (String): Display name of the league.
  - `slug` (String, unique): URL-safe name (e.g., `/liga/los-hipolitos-fc`).
  - `inviteCode` (String, unique): Randomly generated unique 8-character uppercase identifier (e.g. `HIPO2026`).
  - `createdBy` (String, links to `User.id`): The creator/owner.
  - `status` (String, defaults to `'active'`): Can be `'active'` or `'archived'`.
- **`LeagueMember` Model:**
  - `leagueId` & `userId` (composite unique key): Ensures a user can only belong to a specific league once.
  - `role` (String, defaults to `'member'`): Defines local permissions (`'owner'`, `'admin'`, or `'member'`).

---

## 2. Role Permissions & Capabilities Matrix

| Action | Member | Admin | Owner | Superadmin |
| :--- | :---: | :---: | :---: | :---: |
| View Predictions / Standings | ✓ | ✓ | ✓ | ✓ |
| Copy Invite Link | ✓ | ✓ | ✓ | ✓ |
| Regenerate Invite Code | ✗ | ✓ | ✓ | ✓ |
| Promote Member to Admin | ✗ | ✗ | ✓ | ✓ |
| Demote Admin to Member | ✗ | ✗ | ✓ | ✓ |
| Remove Member | ✗ | ✓ | ✓ | ✓ |
| Remove Admin | ✗ | ✗ | ✓ | ✓ |
| Deactivate / Archive League | ✗ | ✗ | ✓ | ✓ |
| Delete League | ✗ | ✗ | ✓ | ✓ |

> [!NOTE]
> - An **Admin** can only remove standard members (cannot remove the owner or other admins).
> - An **Owner** has complete control over their league, including appointing or demoting admins.
> - A global **Superadmin** (`User.isSuperadmin === true`) overrides all local membership rules and can manage or delete any league globally.

---

## 3. Invite Joining Flow

The joining pipeline is structured as follows:

```
                  User clicks invitation link:
                    /join/[inviteCode]
                           │
                           ▼
               Check: User is authenticated?
                     /            \
                   NO              YES
                   /                \
        Redirect to /login        Retrieve session and query DB
                                         │
                                         ▼
                             Check: inviteCode exists?
                                   /           \
                                 NO             YES
                                 /               \
                       Render Error Page       Verify membership
                                                  /         \
                                            ALREADY MEMBER   NEW USER
                                                /             \
                                       Redirect to /liga/[slug]  Show Invite Card
                                                                     │
                                                                     ▼
                                                             User clicks "Aceptar"
                                                                     │
                                                                     ▼
                                                             Create LeagueMember row
                                                                     │
                                                                     ▼
                                                             Redirect to /liga/[slug]
```

---

## 4. Server-Side Protection Checks

To guarantee security and data isolation, the following constraints are executed:

1. **Visibility Guard (`app/src/app/liga/[slug]/page.tsx`):**
   - The route handler inspects the database to check if the caller is a member of the league (or a Superadmin). If not, access is denied, redirecting the caller back to `/liga`.
2. **Action Verification (`app/src/lib/actions/leagues.ts`):**
   - Every modification Server Action (`regenerateInviteCodeAction`, `manageMemberAction`, `archiveLeagueAction`, `deleteLeagueAction`) queries the session and verifies the caller's membership status and role permission level before executing updates.
3. **Uniqueness Enforcements:**
   - **Slugs:** Automatically appended with numeric suffixes if a league with a matching name already exists.
   - **Invite Codes:** Generated inside a check loop to guarantee absolute uniqueness across all leagues.
