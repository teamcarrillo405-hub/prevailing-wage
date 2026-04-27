CREATE TABLE IF NOT EXISTS `roi_leads` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `project_count` integer NOT NULL,
  `worker_count` integer NOT NULL,
  `estimated_savings` real NOT NULL,
  `captured_at` text NOT NULL
);
