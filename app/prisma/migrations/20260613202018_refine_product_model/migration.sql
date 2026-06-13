/*
  Warnings:

  - Added the required column `leagueId` to the `prediction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "winner_prediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "pointsEarned" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "winner_prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "winner_prediction_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "winner_prediction_teamCode_fkey" FOREIGN KEY ("teamCode") REFERENCES "team" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "odds_snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "homeOdds" REAL NOT NULL,
    "drawOdds" REAL NOT NULL,
    "awayOdds" REAL NOT NULL,
    "homeProbability" REAL NOT NULL,
    "drawProbability" REAL NOT NULL,
    "awayProbability" REAL NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "odds_snapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_league" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "entryFee" REAL NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "prizePoolOverride" REAL,
    "payoutRules" TEXT,
    "autoJoin" BOOLEAN NOT NULL DEFAULT false,
    "inviteEnabled" BOOLEAN NOT NULL DEFAULT true,
    "championDeadline" DATETIME,
    "championPoints" INTEGER NOT NULL DEFAULT 10,
    "pointsExactScore" INTEGER NOT NULL DEFAULT 5,
    "pointsWinner" INTEGER NOT NULL DEFAULT 3,
    "pointsDraw" INTEGER NOT NULL DEFAULT 3,
    "pointsConsolation" INTEGER NOT NULL DEFAULT 1,
    "showOdds" BOOLEAN NOT NULL DEFAULT true,
    "championTeamCode" TEXT,
    CONSTRAINT "league_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_league" ("createdAt", "createdBy", "id", "inviteCode", "name", "slug", "status") SELECT "createdAt", "createdBy", "id", "inviteCode", "name", "slug", "status" FROM "league";
DROP TABLE "league";
ALTER TABLE "new_league" RENAME TO "league";
CREATE UNIQUE INDEX "league_slug_key" ON "league"("slug");
CREATE UNIQUE INDEX "league_inviteCode_key" ON "league"("inviteCode");
CREATE TABLE "new_prediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "homePrediction" INTEGER NOT NULL,
    "awayPrediction" INTEGER NOT NULL,
    "pointsEarned" INTEGER,
    "scoreType" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prediction_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_prediction" ("awayPrediction", "homePrediction", "id", "matchId", "pointsEarned", "scoreType", "updatedAt", "userId") SELECT "awayPrediction", "homePrediction", "id", "matchId", "pointsEarned", "scoreType", "updatedAt", "userId" FROM "prediction";
DROP TABLE "prediction";
ALTER TABLE "new_prediction" RENAME TO "prediction";
CREATE INDEX "prediction_matchId_idx" ON "prediction"("matchId");
CREATE INDEX "prediction_userId_leagueId_idx" ON "prediction"("userId", "leagueId");
CREATE UNIQUE INDEX "prediction_userId_leagueId_matchId_key" ON "prediction"("userId", "leagueId", "matchId");
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "username" TEXT,
    "displayUsername" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "canCreateLeagues" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "whatsapp" TEXT,
    "isSuperadmin" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_user" ("createdAt", "displayName", "email", "emailVerified", "id", "image", "isSuperadmin", "name", "updatedAt", "whatsapp") SELECT "createdAt", "displayName", "email", "emailVerified", "id", "image", "isSuperadmin", "name", "updatedAt", "whatsapp" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "winner_prediction_userId_leagueId_key" ON "winner_prediction"("userId", "leagueId");
