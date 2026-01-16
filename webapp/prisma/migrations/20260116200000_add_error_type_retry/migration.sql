-- AlterTable
ALTER TABLE "ChannelEntry" ADD COLUMN "errorType" TEXT,
ADD COLUMN "lastErrorAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ChannelEntry_errorType_status_idx" ON "ChannelEntry"("errorType", "status");
