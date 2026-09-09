-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_technicalMemberId_fkey";

-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_technicalMemberId_fkey";

-- DropForeignKey
ALTER TABLE "Deal" DROP CONSTRAINT "Deal_technicalMemberId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_technicalMemberId_fkey";

-- DropForeignKey
ALTER TABLE "Territory" DROP CONSTRAINT "Territory_technicalMemberId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#6b7280',
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "role" SET DEFAULT 'SALES';

-- DropTable
DROP TABLE "TechnicalMember";

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_technicalMemberId_fkey" FOREIGN KEY ("technicalMemberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_technicalMemberId_fkey" FOREIGN KEY ("technicalMemberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_technicalMemberId_fkey" FOREIGN KEY ("technicalMemberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_technicalMemberId_fkey" FOREIGN KEY ("technicalMemberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_technicalMemberId_fkey" FOREIGN KEY ("technicalMemberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
