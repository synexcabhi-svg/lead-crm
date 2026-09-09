-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "technicalMemberId" TEXT;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "technicalMemberId" TEXT;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT;

-- CreateIndex
CREATE INDEX "Account_technicalMemberId_idx" ON "Account"("technicalMemberId");

-- CreateIndex
CREATE INDEX "Account_state_idx" ON "Account"("state");

-- CreateIndex
CREATE INDEX "Contact_technicalMemberId_idx" ON "Contact"("technicalMemberId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_technicalMemberId_fkey" FOREIGN KEY ("technicalMemberId") REFERENCES "TechnicalMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_technicalMemberId_fkey" FOREIGN KEY ("technicalMemberId") REFERENCES "TechnicalMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
