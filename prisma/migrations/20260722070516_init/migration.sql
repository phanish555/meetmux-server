-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('SEEKING', 'PLACED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('INTERNSHIP', 'FULL_TIME');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'REJECTED', 'OFFERED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InterviewOutcome" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "industry" VARCHAR(120) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "employee_count" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "website_url" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "city" VARCHAR(120) NOT NULL,
    "type" "JobType" NOT NULL,
    "stipend_paise" INTEGER,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "deadline" DATE NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "branch" VARCHAR(120) NOT NULL,
    "graduation_year" INTEGER NOT NULL,
    "cgpa" DECIMAL(3,2),
    "status" "StudentStatus" NOT NULL DEFAULT 'SEEKING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "category" VARCHAR(80),

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_skills" (
    "student_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "student_skills_pkey" PRIMARY KEY ("student_id","skill_id")
);

-- CreateTable
CREATE TABLE "job_skills" (
    "job_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "job_skills_pkey" PRIMARY KEY ("job_id","skill_id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "cover_note" TEXT,
    "idempotency_key" VARCHAR(100),
    "applied_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "withdrawn_at" TIMESTAMPTZ(3),

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_events" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "from_status" "ApplicationStatus",
    "to_status" "ApplicationStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "outcome" "InterviewOutcome" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companies_industry_idx" ON "companies"("industry");

-- CreateIndex
CREATE INDEX "companies_verified_idx" ON "companies"("verified");

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_city_key" ON "companies"("name", "city");

-- CreateIndex
CREATE INDEX "jobs_company_id_idx" ON "jobs"("company_id");

-- CreateIndex
CREATE INDEX "jobs_type_city_idx" ON "jobs"("type", "city");

-- CreateIndex
CREATE INDEX "jobs_deadline_idx" ON "jobs"("deadline");

-- CreateIndex
CREATE INDEX "jobs_created_at_idx" ON "jobs"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "students_email_key" ON "students"("email");

-- CreateIndex
CREATE INDEX "students_status_graduation_year_idx" ON "students"("status", "graduation_year");

-- CreateIndex
CREATE INDEX "students_branch_idx" ON "students"("branch");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE INDEX "student_skills_skill_id_idx" ON "student_skills"("skill_id");

-- CreateIndex
CREATE INDEX "job_skills_skill_id_idx" ON "job_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_idempotency_key_key" ON "applications"("idempotency_key");

-- CreateIndex
CREATE INDEX "applications_job_id_status_idx" ON "applications"("job_id", "status");

-- CreateIndex
CREATE INDEX "applications_student_id_status_idx" ON "applications"("student_id", "status");

-- CreateIndex
CREATE INDEX "applications_applied_at_idx" ON "applications"("applied_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "applications_student_id_job_id_key" ON "applications"("student_id", "job_id");

-- CreateIndex
CREATE INDEX "application_events_application_id_created_at_idx" ON "application_events"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "interviews_application_id_idx" ON "interviews"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_application_id_round_key" ON "interviews"("application_id", "round");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================
-- Enable trigram extension (for GIN full-text search on titles)
-- =============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================
-- CHECK constraints — database-level guarantees
-- =============================================================

ALTER TABLE "students"
  ADD CONSTRAINT "chk_students_cgpa"
    CHECK (cgpa IS NULL OR (cgpa >= 0 AND cgpa <= 10));

ALTER TABLE "students"
  ADD CONSTRAINT "chk_students_grad_year"
    CHECK (graduation_year BETWEEN 2000 AND 2100);

ALTER TABLE "students"
  ADD CONSTRAINT "chk_students_email_format"
    CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

ALTER TABLE "jobs"
  ADD CONSTRAINT "chk_jobs_openings_positive"
    CHECK (openings > 0);

ALTER TABLE "jobs"
  ADD CONSTRAINT "chk_jobs_stipend_non_negative"
    CHECK (stipend_paise IS NULL OR stipend_paise >= 0);

ALTER TABLE "jobs"
  ADD CONSTRAINT "chk_jobs_deadline_after_creation"
    CHECK (deadline >= created_at::date);

ALTER TABLE "student_skills"
  ADD CONSTRAINT "chk_student_skills_level"
    CHECK (level BETWEEN 1 AND 5);

ALTER TABLE "companies"
  ADD CONSTRAINT "chk_companies_employee_count"
    CHECK (employee_count IS NULL OR employee_count > 0);

ALTER TABLE "interviews"
  ADD CONSTRAINT "chk_interviews_round_positive"
    CHECK (round > 0);

-- Cross-column: withdrawn status and the timestamp must agree.
-- No amount of field-level validation can express this.
ALTER TABLE "applications"
  ADD CONSTRAINT "chk_applications_withdrawn_consistency"
    CHECK (
      (status = 'WITHDRAWN' AND withdrawn_at IS NOT NULL)
      OR
      (status <> 'WITHDRAWN' AND withdrawn_at IS NULL)
    );

-- =============================================================
-- Partial indexes — smaller & faster than covering every row
-- =============================================================

-- Almost every query filters out soft-deleted rows. Index only live rows.
CREATE INDEX "idx_students_live"
  ON "students" (status, graduation_year)
  WHERE deleted_at IS NULL;

CREATE INDEX "idx_jobs_live_open"
  ON "jobs" (city, type, deadline)
  WHERE deleted_at IS NULL AND is_open = true;

-- Case-insensitive email uniqueness (plain UNIQUE would accept
-- Aarav@x.edu alongside aarav@x.edu).
CREATE UNIQUE INDEX "uq_students_email_lower"
  ON "students" (LOWER(email))
  WHERE deleted_at IS NULL;

-- =============================================================
-- Trigram GIN index for LIKE/ILIKE search on job titles
-- =============================================================

CREATE INDEX "idx_jobs_title_trgm"
  ON "jobs" USING gin (title gin_trgm_ops);
