-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "propertyTypeKey" TEXT;

-- CreateTable
CREATE TABLE "PropertyType" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PropertyType_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Lead_propertyTypeKey_idx" ON "Lead"("propertyTypeKey");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_propertyTypeKey_fkey" FOREIGN KEY ("propertyTypeKey") REFERENCES "PropertyType"("key") ON DELETE SET NULL ON UPDATE CASCADE;
