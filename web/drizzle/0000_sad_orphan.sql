CREATE TABLE `activity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`actor_type` varchar(10) NOT NULL,
	`actor_name` varchar(120) NOT NULL,
	`event` varchar(40) NOT NULL,
	`comment_id` int,
	`summary` varchar(500) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`prefix` varchar(12) NOT NULL,
	`key_hash` varchar(64) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`last_used_at` datetime(3),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_key_hash_unique` UNIQUE(`key_hash`)
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`comment_id` int NOT NULL,
	`path` varchar(500) NOT NULL,
	`content_type` varchar(50) NOT NULL,
	`size_bytes` int NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`round_id` int NOT NULL,
	`author_name` varchar(120) NOT NULL,
	`body` text NOT NULL,
	`page_url` varchar(1000) NOT NULL,
	`css_selector` varchar(1000),
	`pos_x` double,
	`pos_y` double,
	`area_width` double,
	`area_height` double,
	`viewport_width` int,
	`viewport_height` int,
	`user_agent` varchar(500),
	`screenshot_path` varchar(500),
	`status` varchar(20) NOT NULL DEFAULT 'OPEN',
	`created_at` datetime(3) NOT NULL,
	`customer_email` varchar(254),
	`notify_token` varchar(32),
	`customer_approved_at` datetime(3),
	`assignee_id` int,
	`edit_token_hash` varchar(64),
	`edited_at` datetime(3),
	`priority` varchar(10) NOT NULL DEFAULT 'NORMAL',
	`labels` varchar(255) NOT NULL DEFAULT '',
	CONSTRAINT `comments_id` PRIMARY KEY(`id`),
	CONSTRAINT `comments_notify_token_unique` UNIQUE(`notify_token`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`used_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `project_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`email` varchar(255) NOT NULL,
	`invited_by` int,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `project_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_project_invites` UNIQUE(`project_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`user_id` int NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `project_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_project_members` UNIQUE(`project_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`site_url` varchar(500) NOT NULL,
	`share_token` varchar(64) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`webhook_url` varchar(500),
	`webhook_secret` varchar(32),
	`widget_color` varchar(7),
	`widget_position` varchar(5) NOT NULL DEFAULT 'RIGHT',
	`widget_lang` varchar(2) NOT NULL DEFAULT 'hu',
	`archived_at` datetime(3),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_share_token_unique` UNIQUE(`share_token`)
);
--> statement-breakpoint
CREATE TABLE `replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`comment_id` int NOT NULL,
	`author_name` varchar(120) NOT NULL,
	`author_type` varchar(20) NOT NULL,
	`user_id` int,
	`body` text NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `replies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`number` int NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'OPEN',
	`created_at` datetime(3) NOT NULL,
	`closed_at` datetime(3),
	`approved_at` datetime(3),
	`approved_by` varchar(120),
	`due_date` date,
	CONSTRAINT `rounds_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_rounds_project_number` UNIQUE(`project_id`,`number`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`password_changed_at` datetime(3),
	`notify_email` boolean NOT NULL DEFAULT true,
	`email_verified_at` datetime(3),
	`email_verify_hash` varchar(64),
	`email_verify_expires_at` datetime(3),
	`email_verify_sent_at` datetime(3),
	`digest_frequency` varchar(10) NOT NULL DEFAULT 'OFF',
	`digest_last_sent_at` datetime(3),
	`totp_secret` varchar(64),
	`totp_enabled_at` datetime(3),
	`totp_last_step` bigint,
	`totp_recovery_hashes` varchar(700),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_email_verify_hash_unique` UNIQUE(`email_verify_hash`)
);
--> statement-breakpoint
ALTER TABLE `activity` ADD CONSTRAINT `activity_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity` ADD CONSTRAINT `activity_comment_id_comments_id_fk` FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_comment_id_comments_id_fk` FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_round_id_rounds_id_fk` FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_assignee_id_users_id_fk` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_invites` ADD CONSTRAINT `project_invites_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_invites` ADD CONSTRAINT `project_invites_invited_by_users_id_fk` FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `replies` ADD CONSTRAINT `replies_comment_id_comments_id_fk` FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `replies` ADD CONSTRAINT `replies_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rounds` ADD CONSTRAINT `rounds_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_activity_project` ON `activity` (`project_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_api_keys_user` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_attachments_comment` ON `attachments` (`comment_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_round` ON `comments` (`round_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_assignee` ON `comments` (`assignee_id`);--> statement-breakpoint
CREATE INDEX `idx_password_reset_user` ON `password_reset_tokens` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_project_invites_email` ON `project_invites` (`email`);--> statement-breakpoint
CREATE INDEX `idx_replies_comment` ON `replies` (`comment_id`);