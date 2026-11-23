ALTER TABLE `project_invites` ADD `role` varchar(10) DEFAULT 'MEMBER' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_members` ADD `role` varchar(10) DEFAULT 'MEMBER' NOT NULL;