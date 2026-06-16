-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT
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
    "knockoutOutcomeBasis" TEXT NOT NULL DEFAULT 'qualified_team',
    CONSTRAINT "league_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_league" ("autoJoin", "championDeadline", "championPoints", "championTeamCode", "createdAt", "createdBy", "currency", "entryFee", "id", "inviteCode", "inviteEnabled", "isActive", "isDefault", "name", "payoutRules", "pointsConsolation", "pointsDraw", "pointsExactScore", "pointsWinner", "prizePoolOverride", "showOdds", "slug", "status") SELECT "autoJoin", "championDeadline", "championPoints", "championTeamCode", "createdAt", "createdBy", "currency", "entryFee", "id", "inviteCode", "inviteEnabled", "isActive", "isDefault", "name", "payoutRules", "pointsConsolation", "pointsDraw", "pointsExactScore", "pointsWinner", "prizePoolOverride", "showOdds", "slug", "status" FROM "league";
DROP TABLE "league";
ALTER TABLE "new_league" RENAME TO "league";
CREATE UNIQUE INDEX "league_slug_key" ON "league"("slug");
CREATE UNIQUE INDEX "league_inviteCode_key" ON "league"("inviteCode");
CREATE TABLE "new_match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phase" TEXT NOT NULL,
    "group" TEXT,
    "jornada" TEXT NOT NULL,
    "homeTeamCode" TEXT NOT NULL,
    "awayTeamCode" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "kickoffUtc" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "resultStatus" TEXT,
    "winnerTeamCode" TEXT,
    "wentToExtraTime" BOOLEAN NOT NULL DEFAULT false,
    "wentToPenalties" BOOLEAN NOT NULL DEFAULT false,
    "homePenaltyScore" INTEGER,
    "awayPenaltyScore" INTEGER,
    "resultSource" TEXT,
    "resultFetchedAt" DATETIME,
    "resultUpdatedAt" DATETIME,
    "resultVerifiedById" TEXT,
    "resultNotes" TEXT,
    CONSTRAINT "match_homeTeamCode_fkey" FOREIGN KEY ("homeTeamCode") REFERENCES "team" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "match_awayTeamCode_fkey" FOREIGN KEY ("awayTeamCode") REFERENCES "team" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_match" ("awayScore", "awayTeamCode", "city", "group", "homeScore", "homeTeamCode", "id", "jornada", "kickoffUtc", "phase", "status", "venue") SELECT "awayScore", "awayTeamCode", "city", "group", "homeScore", "homeTeamCode", "id", "jornada", "kickoffUtc", "phase", "status", "venue" FROM "match";
DROP TABLE "match";
ALTER TABLE "new_match" RENAME TO "match";
CREATE INDEX "match_phase_status_idx" ON "match"("phase", "status");
CREATE INDEX "match_kickoffUtc_idx" ON "match"("kickoffUtc");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
