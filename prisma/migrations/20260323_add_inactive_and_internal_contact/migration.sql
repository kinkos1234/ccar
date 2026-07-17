-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'INACTIVE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "erpId" VARCHAR(50);

-- CreateTable
CREATE TABLE "CarInternalContact" (
    "carId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "CarInternalContact_pkey" PRIMARY KEY ("carId","userId")
);

-- CreateIndex
CREATE INDEX "idx_carinternalcontact_carid" ON "CarInternalContact"("carId");

-- CreateIndex
CREATE INDEX "idx_carinternalcontact_userid" ON "CarInternalContact"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_erpId_key" ON "User"("erpId");

-- CreateIndex
CREATE INDEX "idx_user_erpid" ON "User"("erpId");

-- AddForeignKey
ALTER TABLE "CarInternalContact" ADD CONSTRAINT "fk_carinternalcontact_car" FOREIGN KEY ("carId") REFERENCES "CAR"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CarInternalContact" ADD CONSTRAINT "fk_carinternalcontact_user" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
