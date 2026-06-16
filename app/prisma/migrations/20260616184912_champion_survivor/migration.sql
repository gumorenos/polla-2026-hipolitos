-- CreateTable
CREATE TABLE "ChampionPick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME,
    "correctionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "correctedByAdminId" TEXT,
    "correctedAt" DATETIME,
    "lastCorrectionReason" TEXT,
    "previousTeamCode" TEXT,
    "newTeamCode" TEXT,
    CONSTRAINT "ChampionPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChampionPick_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChampionPick_teamCode_fkey" FOREIGN KEY ("teamCode") REFERENCES "team" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamTournamentStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "teamCode" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "eliminatedAt" DATETIME,
    "eliminatedInMatchId" TEXT,
    "finalRank" INTEGER,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "TeamTournamentStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamTournamentStatus_teamCode_fkey" FOREIGN KEY ("teamCode") REFERENCES "team" ("code") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamTournamentStatus_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChampionOddsSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "decimalOdds" REAL NOT NULL,
    "impliedProbability" REAL NOT NULL DEFAULT 0,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceMarket" TEXT NOT NULL,
    "rawSourceRef" TEXT,
    "userId" TEXT,
    CONSTRAINT "ChampionOddsSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChampionOddsSnapshot_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChampionOddsSnapshot_teamCode_fkey" FOREIGN KEY ("teamCode") REFERENCES "team" ("code") ON DELETE CASCADE ON UPDATE CASCADE
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
    "competitionType" TEXT NOT NULL DEFAULT 'full_prediction',
    CONSTRAINT "league_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_league" ("autoJoin", "championDeadline", "championPoints", "championTeamCode", "createdAt", "createdBy", "currency", "entryFee", "id", "inviteCode", "inviteEnabled", "isActive", "isDefault", "knockoutOutcomeBasis", "name", "payoutRules", "pointsConsolation", "pointsDraw", "pointsExactScore", "pointsWinner", "prizePoolOverride", "showOdds", "slug", "status") SELECT "autoJoin", "championDeadline", "championPoints", "championTeamCode", "createdAt", "createdBy", "currency", "entryFee", "id", "inviteCode", "inviteEnabled", "isActive", "isDefault", "knockoutOutcomeBasis", "name", "payoutRules", "pointsConsolation", "pointsDraw", "pointsExactScore", "pointsWinner", "prizePoolOverride", "showOdds", "slug", "status" FROM "league";
DROP TABLE "league";
ALTER TABLE "new_league" RENAME TO "league";
CREATE UNIQUE INDEX "league_slug_key" ON "league"("slug");
CREATE UNIQUE INDEX "league_inviteCode_key" ON "league"("inviteCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ChampionPick_leagueId_userId_key" ON "ChampionPick"("leagueId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamTournamentStatus_teamCode_leagueId_key" ON "TeamTournamentStatus"("teamCode", "leagueId");
