-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT;

-- CreateIndex
CREATE INDEX "Lead_state_idx" ON "Lead"("state");

-- CreateIndex
CREATE INDEX "Lead_country_idx" ON "Lead"("country");
