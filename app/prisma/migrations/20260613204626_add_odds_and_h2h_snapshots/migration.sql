/*
  Warnings:

  - You are about to drop the column `awayOdds` on the `odds_snapshot` table. All the data in the column will be lost.
  - You are about to drop the column `awayProbability` on the `odds_snapshot` table. All the data in the column will be lost.
  - You are about to drop the column `drawOdds` on the `odds_snapshot` table. All the data in the column will be lost.
  - You are about to drop the column `drawProbability` on the `odds_snapshot` table. All the data in the column will be lost.
  - You are about to drop the column `homeOdds` on the `odds_snapshot` table. All the data in the column will be lost.
  - You are about to drop the column `homeProbability` on the `odds_snapshot` table. All the data in the column will be lost.
  - Added the required column `decimalOdds` to the `odds_snapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `impliedProbability` to the `odds_snapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `outcomeLabel` to the `odds_snapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `outcomeType` to the `odds_snapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceType` to the `odds_snapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `visibility` to the `odds_snapshot` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "user_odds_refresh_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "oddsSnapshotId" TEXT,
    CONSTRAINT "user_odds_refresh_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_odds_refresh_usage_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "head_to_head_snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'api-football',
    "homeTeamCode" TEXT NOT NULL,
    "awayTeamCode" TEXT NOT NULL,
    "totalMatches" INTEGER NOT NULL,
    "homeWins" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "awayWins" INTEGER NOT NULL,
    "homeGoals" INTEGER NOT NULL,
    "awayGoals" INTEGER NOT NULL,
    "lastMatchesJson" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "head_to_head_snapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "head_to_head_snapshot_homeTeamCode_fkey" FOREIGN KEY ("homeTeamCode") REFERENCES "team" ("code") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "head_to_head_snapshot_awayTeamCode_fkey" FOREIGN KEY ("awayTeamCode") REFERENCES "team" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_odds_snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "outcomeType" TEXT NOT NULL,
    "teamCode" TEXT,
    "outcomeLabel" TEXT NOT NULL,
    "decimalOdds" REAL NOT NULL,
    "impliedProbability" REAL NOT NULL,
    "normalizedProbability" REAL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visibility" TEXT NOT NULL,
    "userId" TEXT,
    "sourceType" TEXT NOT NULL,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "odds_snapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "odds_snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "odds_snapshot_teamCode_fkey" FOREIGN KEY ("teamCode") REFERENCES "team" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_odds_snapshot" ("bookmaker", "capturedAt", "id", "marketType", "matchId", "provider") SELECT "bookmaker", "capturedAt", "id", "marketType", "matchId", "provider" FROM "odds_snapshot";
DROP TABLE "odds_snapshot";
ALTER TABLE "new_odds_snapshot" RENAME TO "odds_snapshot";
CREATE INDEX "odds_snapshot_matchId_marketType_visibility_userId_capturedAt_idx" ON "odds_snapshot"("matchId", "marketType", "visibility", "userId", "capturedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "user_odds_refresh_usage_userId_dateKey_key" ON "user_odds_refresh_usage"("userId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "head_to_head_snapshot_matchId_key" ON "head_to_head_snapshot"("matchId");
