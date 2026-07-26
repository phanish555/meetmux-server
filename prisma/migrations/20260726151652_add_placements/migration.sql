-- CreateTable
CREATE TABLE "placements" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "offered_ctc_paise" BIGINT NOT NULL,
    "title_at_offer" VARCHAR(200) NOT NULL,
    "placed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "placements_student_id_key" ON "placements"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "placements_application_id_key" ON "placements"("application_id");

-- CreateIndex
CREATE INDEX "placements_job_id_idx" ON "placements"("job_id");

-- AddForeignKey
ALTER TABLE "placements" ADD CONSTRAINT "placements_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placements" ADD CONSTRAINT "placements_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placements" ADD CONSTRAINT "placements_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

