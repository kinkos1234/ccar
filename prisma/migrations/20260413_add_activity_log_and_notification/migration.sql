-- AlterTable
ALTER TABLE "User" ADD COLUMN "notificationEmail" BOOLEAN DEFAULT true;

-- CreateTable
CREATE TABLE "CarActivityLog" (
    "id" SERIAL NOT NULL,
    "carId" INTEGER NOT NULL,
    "userId" INTEGER,
    "activityType" VARCHAR(50) NOT NULL,
    "changedField" VARCHAR(100),
    "oldValue" TEXT,
    "newValue" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "carId" INTEGER,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(6),
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_caractivitylog_carid" ON "CarActivityLog"("carId");

-- CreateIndex
CREATE INDEX "idx_caractivitylog_userid" ON "CarActivityLog"("userId");

-- CreateIndex
CREATE INDEX "idx_caractivitylog_createdat" ON "CarActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "idx_caractivitylog_activitytype" ON "CarActivityLog"("activityType");

-- CreateIndex
CREATE INDEX "idx_notification_userid" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "idx_notification_carid" ON "Notification"("carId");

-- CreateIndex
CREATE INDEX "idx_notification_isread" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "idx_notification_createdat" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "idx_notification_type" ON "Notification"("type");

-- AddForeignKey
ALTER TABLE "CarActivityLog" ADD CONSTRAINT "fk_caractivitylog_car" FOREIGN KEY ("carId") REFERENCES "CAR"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CarActivityLog" ADD CONSTRAINT "fk_caractivitylog_user" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "fk_notification_user" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "fk_notification_car" FOREIGN KEY ("carId") REFERENCES "CAR"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
