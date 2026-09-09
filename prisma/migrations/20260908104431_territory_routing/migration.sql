-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "technicalMemberId" TEXT NOT NULL,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Territory_technicalMemberId_idx" ON "Territory"("technicalMemberId");

-- CreateIndex
CREATE INDEX "Territory_state_idx" ON "Territory"("state");

-- CreateIndex
CREATE INDEX "Territory_city_idx" ON "Territory"("city");

-- CreateIndex
CREATE INDEX "Territory_isActive_idx" ON "Territory"("isActive");

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_technicalMemberId_fkey" FOREIGN KEY ("technicalMemberId") REFERENCES "TechnicalMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
