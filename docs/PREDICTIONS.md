# Predictions Design — La Polla 2026

This document details the architecture, data structures, validation rules, and user flow of the match predictions system in **La Polla 2026**.

---

## 1. Prediction Scope: Global vs. League-Specific

### Decision
Predictions in **La Polla 2026** are **global** per user per match, rather than league-specific. 

### Rationale
- **User Experience (UX):** In a World Cup tournament, predicting 72 matches takes significant effort. If predictions were league-specific and a user belonged to 5 different leagues, they would have to input $72 \times 5 = 360$ scores. This causes severe cognitive fatigue and duplicate effort.
- **Fairness:** Entering different predictions for the same match in different leagues encourages split-betting strategies (e.g., predicting Home wins in one league and Away wins in another to hedge bets), which undermines the spirit of a genuine prediction pool.
- **Database Efficiency:** Storing a single prediction per user-match reduces storage footprint and simplifies the computation of standing leaderboards.

---

## 2. Database Schema

The `Prediction` model is defined as follows in `prisma/schema.prisma`:

```prisma
model Prediction {
  id             String   @id @default(cuid())
  userId         String
  matchId        String
  homePrediction Int
  awayPrediction Int
  pointsEarned   Int?
  scoreType      String?  // "exact" | "tendency" | "consolation" | "miss"
  updatedAt      DateTime @updatedAt

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  match Match @relation(fields: [matchId], references: [id], onDelete: Cascade)

  @@unique([userId, matchId]) // Enforces global scope per user-match
  @@index([matchId])
  @@index([userId])
  @@map("prediction")
}
```

---

## 3. Server-Side Cutoff Locking

### Hard Rule
Predictions are strictly locked at the official match kickoff time. Under no circumstances can a prediction be created, updated, or deleted after the kickoff time.

### Enforcement
Locking is enforced **server-side** in the `savePredictionAction` Server Action:
1. When a save request arrives, the server queries the match details from the database.
2. The server compares the match's `kickoffUtc` against the current server time:
   ```typescript
   export function isMatchLocked(kickoffUtc: Date | string, status: string): boolean {
     const kickoffDate = new Date(kickoffUtc);
     const now = new Date();
     return kickoffDate <= now || status === 'live' || status === 'result';
   }
   ```
3. If `isMatchLocked` is true, the server aborts the transaction and returns a validation error.
4. **Client-side indicators** (countdown timer, locked padlock icons) are provided purely for visual guidance and do not serve as security controls.

---

## 4. Match Visual States

The UI maps database values to five distinct match states using [MatchStatusBadge](file:///d:/projects/antigravity/lapolla2026/app/src/components/ui/MatchStatusBadge.tsx):

| Visual State | Visual Indicator | Condition | Description |
|--------------|------------------|-----------|-------------|
| **Programado** | Gray Badge | `kickoffUtc > now` and status is default | Match is scheduled, predictions are open. |
| **Abierto** | Green Badge | `kickoffUtc > now` | Predictions are open for submissions/updates. |
| **Cerrado** | Red Badge | `kickoffUtc <= now` and status not live/result | Predictions are locked. No edits allowed. |
| **En Juego** | Red (Pulsing) | `status == 'live'` | Match is active. Real-time standings update. |
| **Finalizado** | Gold Badge | `status == 'result'` | Match finished. Points and score types computed. |

---

## 5. Input Validation Rules

The `savePredictionAction` performs the following server-side checks:
1. **Authenticated Session:** Resolves session via HTTP headers. Rejects guest submissions.
2. **Value Boundaries:**
   - Home and away prediction scores must be integer values: `Number.isInteger(val)`.
   - Scores cannot be negative: `val >= 0`.
3. **Locking Check:** Verifies kickoff has not passed.
4. **Completion Check:** Rejects submissions for matches that already have a final result (`status === 'result'`).

---

## 6. Informational Odds and H2H Statistics Helpers

To help users make informed predictions, each match card can display two helper panels (if enabled in the league configuration via `showOdds`):

1. **Market Probabilities:** Shows the decimal odds and implied percentages calculated from bookmakers (L/E/V), pointing out which team is considered the favorite according to market odds.
2. **Head-to-Head (H2H):** Shows historical match statistics, including total matches played, wins per team, draws, and scores of the last 5 direct meetings between the two teams.
3. **Private Odds Refresh:** Users can trigger exactly one private odds refresh per local day (resets at midnight in the America/Lima timezone) to get updated real-time odds snapshots for any match.

