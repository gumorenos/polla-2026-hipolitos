-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "displayName" TEXT,
    "whatsapp" TEXT,
    "isSuperadmin" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME,
    "updatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "team" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "hue" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "match" (
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
    CONSTRAINT "match_homeTeamCode_fkey" FOREIGN KEY ("homeTeamCode") REFERENCES "team" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "match_awayTeamCode_fkey" FOREIGN KEY ("awayTeamCode") REFERENCES "team" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "league" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "league_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "league_member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "league_member_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "league_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "homePrediction" INTEGER NOT NULL,
    "awayPrediction" INTEGER NOT NULL,
    "pointsEarned" INTEGER,
    "scoreType" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "standing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "exacts" INTEGER NOT NULL DEFAULT 0,
    "tendencies" INTEGER NOT NULL DEFAULT 0,
    "consolations" INTEGER NOT NULL DEFAULT 0,
    "misses" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "previousRank" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "standing_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "standing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_action_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_action_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "match_phase_status_idx" ON "match"("phase", "status");

-- CreateIndex
CREATE INDEX "match_kickoffUtc_idx" ON "match"("kickoffUtc");

-- CreateIndex
CREATE UNIQUE INDEX "league_slug_key" ON "league"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "league_inviteCode_key" ON "league"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "league_member_leagueId_userId_key" ON "league_member"("leagueId", "userId");

-- CreateIndex
CREATE INDEX "prediction_matchId_idx" ON "prediction"("matchId");

-- CreateIndex
CREATE INDEX "prediction_userId_idx" ON "prediction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "prediction_userId_matchId_key" ON "prediction"("userId", "matchId");

-- CreateIndex
CREATE INDEX "standing_leagueId_block_idx" ON "standing"("leagueId", "block");

-- CreateIndex
CREATE UNIQUE INDEX "standing_leagueId_userId_block_key" ON "standing"("leagueId", "userId", "block");
