-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'OPERATOR', 'AUDITOR');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "PurposeCategory" AS ENUM ('TRANSACTIONAL', 'SERVICE', 'PROMOTIONAL', 'POLITICAL');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('OPT_OUT_IVR', 'OPT_OUT_WEB', 'MANUAL', 'DND', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecipientStatus" AS ENUM ('PENDING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('QUEUED', 'SUBMITTED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'NO_ANSWER', 'BUSY', 'FAILED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID');

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "globalEmergencyStop" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "emergencyStop" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "callWindowStart" TEXT NOT NULL DEFAULT '09:00',
    "callWindowEnd" TEXT NOT NULL DEFAULT '21:00',
    "ratePerMinutePaise" INTEGER NOT NULL DEFAULT 60,
    "tenantDailyCap" INTEGER NOT NULL DEFAULT 20000,
    "contactDailyCap" INTEGER NOT NULL DEFAULT 1,
    "contactWeeklyCap" INTEGER NOT NULL DEFAULT 3,
    "defaultConcurrency" INTEGER NOT NULL DEFAULT 10,
    "secondApprovalAbove" INTEGER NOT NULL DEFAULT 5000,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "retryBackoffSec" INTEGER NOT NULL DEFAULT 300,
    "retryNoAnswer" BOOLEAN NOT NULL DEFAULT false,
    "failureAutoPausePct" INTEGER NOT NULL DEFAULT 60,
    "retentionDays" INTEGER NOT NULL DEFAULT 0,
    "requireMfa" BOOLEAN NOT NULL DEFAULT false,
    "providerKey" TEXT NOT NULL DEFAULT 'mock',
    "dltEntityId" TEXT,
    "politicalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "politicalProviderOk" BOOLEAN NOT NULL DEFAULT false,
    "politicalAttestedBy" TEXT,
    "politicalAttestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEnc" TEXT,
    "mfaPendingEnc" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "mustChangePw" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mfaPassed" BOOLEAN NOT NULL DEFAULT false,
    "tenantView" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purpose" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PurposeCategory" NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purpose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phoneEnc" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneMasked" TEXT NOT NULL,
    "nameEnc" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "purposeId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'VOICE',
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "evidenceRef" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeNote" TEXT,
    "importId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suppression" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneMasked" TEXT NOT NULL DEFAULT '',
    "reason" "SuppressionReason" NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallerId" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "providerRef" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "approvedCategories" "PurposeCategory"[] DEFAULT ARRAY[]::"PurposeCategory"[],
    "notes" TEXT,
    "requestedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallerId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "codec" TEXT NOT NULL,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "forPolitical" BOOLEAN NOT NULL DEFAULT false,
    "mcmcCertificate" TEXT,
    "transcript" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IvrFlow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IvrFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purposeId" TEXT NOT NULL,
    "audioAssetId" TEXT NOT NULL,
    "callerIdId" TEXT NOT NULL,
    "ivrFlowId" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "segmentTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduledAt" TIMESTAMP(3),
    "windowStart" TEXT NOT NULL DEFAULT '09:00',
    "windowEnd" TEXT NOT NULL DEFAULT '21:00',
    "dailyCap" INTEGER NOT NULL DEFAULT 5000,
    "concurrency" INTEGER NOT NULL DEFAULT 10,
    "consentBasis" TEXT NOT NULL,
    "optOutMethod" TEXT NOT NULL DEFAULT 'Press 9 during the call, or visit /optout',
    "audienceCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostPaise" INTEGER NOT NULL DEFAULT 0,
    "needsSecondApproval" BOOLEAN NOT NULL DEFAULT false,
    "attested" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "secondApprovedById" TEXT,
    "secondApprovedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "RecipientStatus" NOT NULL DEFAULT 'PENDING',
    "skipReason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eligibilityCheckedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT,
    "recipientId" TEXT,
    "contactId" TEXT NOT NULL,
    "callerIdId" TEXT NOT NULL,
    "audioAssetId" TEXT NOT NULL,
    "purposeId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "providerCallId" TEXT,
    "status" "CallStatus" NOT NULL DEFAULT 'QUEUED',
    "failureReason" TEXT,
    "transient" BOOLEAN NOT NULL DEFAULT false,
    "dtmf" TEXT,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "costPaise" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallEvent" (
    "id" TEXT NOT NULL,
    "callAttemptId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadRedacted" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactImport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "purposeId" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "total" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SilencePeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SilencePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'warning',
    "message" TEXT NOT NULL,
    "campaignId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "callCount" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Purpose_tenantId_name_key" ON "Purpose"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Contact_tenantId_createdAt_idx" ON "Contact"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_tenantId_phoneHash_key" ON "Contact"("tenantId", "phoneHash");

-- CreateIndex
CREATE INDEX "ConsentRecord_tenantId_contactId_purposeId_idx" ON "ConsentRecord"("tenantId", "contactId", "purposeId");

-- CreateIndex
CREATE UNIQUE INDEX "Suppression_tenantId_phoneHash_key" ON "Suppression"("tenantId", "phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "CallerId_tenantId_providerKey_phoneE164_key" ON "CallerId"("tenantId", "providerKey", "phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "AudioAsset_tenantId_groupKey_version_key" ON "AudioAsset"("tenantId", "groupKey", "version");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_status_idx" ON "Campaign"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Campaign_status_scheduledAt_idx" ON "Campaign"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "CampaignRecipient_campaignId_status_nextAttemptAt_idx" ON "CampaignRecipient"("campaignId", "status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_contactId_key" ON "CampaignRecipient"("campaignId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "CallAttempt_idempotencyKey_key" ON "CallAttempt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CallAttempt_providerCallId_key" ON "CallAttempt"("providerCallId");

-- CreateIndex
CREATE INDEX "CallAttempt_tenantId_createdAt_idx" ON "CallAttempt"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CallAttempt_campaignId_status_idx" ON "CallAttempt"("campaignId", "status");

-- CreateIndex
CREATE INDEX "CallAttempt_contactId_createdAt_idx" ON "CallAttempt"("contactId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CallEvent_providerEventId_key" ON "CallEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "CallEvent_callAttemptId_idx" ON "CallEvent"("callAttemptId");

-- CreateIndex
CREATE INDEX "Alert_tenantId_resolvedAt_idx" ON "Alert"("tenantId", "resolvedAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_periodStart_key" ON "Invoice"("tenantId", "periodStart");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purpose" ADD CONSTRAINT "Purpose_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "Purpose"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suppression" ADD CONSTRAINT "Suppression_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallerId" ADD CONSTRAINT "CallerId_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioAsset" ADD CONSTRAINT "AudioAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IvrFlow" ADD CONSTRAINT "IvrFlow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "Purpose"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_callerIdId_fkey" FOREIGN KEY ("callerIdId") REFERENCES "CallerId"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ivrFlowId_fkey" FOREIGN KEY ("ivrFlowId") REFERENCES "IvrFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallAttempt" ADD CONSTRAINT "CallAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallAttempt" ADD CONSTRAINT "CallAttempt_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallAttempt" ADD CONSTRAINT "CallAttempt_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallAttempt" ADD CONSTRAINT "CallAttempt_callerIdId_fkey" FOREIGN KEY ("callerIdId") REFERENCES "CallerId"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallAttempt" ADD CONSTRAINT "CallAttempt_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallEvent" ADD CONSTRAINT "CallEvent_callAttemptId_fkey" FOREIGN KEY ("callAttemptId") REFERENCES "CallAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactImport" ADD CONSTRAINT "ContactImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SilencePeriod" ADD CONSTRAINT "SilencePeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
