-- Merge case study fields into projects table
-- and drop the now-redundant case_studies table

ALTER TABLE "projects"
  ADD COLUMN "liveUrl"             TEXT,
  ADD COLUMN "githubUrl"           TEXT,
  ADD COLUMN "videoUrl"            TEXT,
  ADD COLUMN "caseStudyPublished"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "context"             TEXT,
  ADD COLUMN "problem"             TEXT,
  ADD COLUMN "architectureDiagram" TEXT,
  ADD COLUMN "keyDecisions"        JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "hardParts"           TEXT,
  ADD COLUMN "outcome"             TEXT;

DROP TABLE "case_studies";
