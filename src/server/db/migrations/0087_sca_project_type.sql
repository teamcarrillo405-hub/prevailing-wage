ALTER TABLE projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'davis-bacon' CHECK(project_type IN ('davis-bacon','sca','both'));
