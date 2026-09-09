-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "technicalMemberId" TEXT;

-- CreateTable
CREATE TABLE "TechnicalMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicalMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechnicalMember_isActive_idx" ON "TechnicalMember"("isActive");

-- CreateIndex
CREATE INDEX "Lead_technicalMemberId_idx" ON "Lead"("technicalMemberId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_technicalMemberId_fkey" FOREIGN KEY ("technicalMemberId") REFERENCES "TechnicalMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
