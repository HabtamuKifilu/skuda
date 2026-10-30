CREATE UNIQUE INDEX "AcademicYear_one_current_per_school_idx"
ON "AcademicYear" ("schoolId")
WHERE "isCurrent" = true;
