CREATE UNIQUE INDEX "Term_one_current_per_academic_year_idx"
ON "Term" ("academicYearId")
WHERE "isCurrent" = true;
