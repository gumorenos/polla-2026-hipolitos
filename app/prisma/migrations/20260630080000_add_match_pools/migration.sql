-- Migration: add_match_pools
-- Additive-only. Adds MatchPool, MatchPoolEntry, and MatchPoolInvite tables.
-- No existing data is modified. No existing columns are dropped.
--
-- MatchPool: per-match referential challenge pool between league members.
-- MatchPoolEntry: one entry per user per pool with their pick and referential result.
-- MatchPoolInvite: invite tracking between participants.

-- CreateTable: match_pool
CREATE TABLE "match_pool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "settledAt" DATETIME,
    "settlementReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "match_pool_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_pool_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_pool_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: match_pool_entry
CREATE TABLE "match_pool_entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pickType" TEXT NOT NULL,
    "pickValue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "netAmount" INTEGER,
    "resultNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "match_pool_entry_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "match_pool" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_pool_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: match_pool_invite
CREATE TABLE "match_pool_invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "match_pool_invite_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "match_pool" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_pool_invite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_pool_invite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: match_pool
CREATE INDEX "match_pool_leagueId_idx" ON "match_pool"("leagueId");
CREATE INDEX "match_pool_matchId_idx" ON "match_pool"("matchId");
CREATE INDEX "match_pool_status_idx" ON "match_pool"("status");

-- CreateIndex: match_pool_entry
CREATE UNIQUE INDEX "match_pool_entry_poolId_userId_key" ON "match_pool_entry"("poolId", "userId");
CREATE INDEX "match_pool_entry_userId_idx" ON "match_pool_entry"("userId");
CREATE INDEX "match_pool_entry_status_idx" ON "match_pool_entry"("status");

-- CreateIndex: match_pool_invite
CREATE UNIQUE INDEX "match_pool_invite_poolId_invitedUserId_key" ON "match_pool_invite"("poolId", "invitedUserId");
CREATE INDEX "match_pool_invite_invitedUserId_idx" ON "match_pool_invite"("invitedUserId");
CREATE INDEX "match_pool_invite_status_idx" ON "match_pool_invite"("status");
