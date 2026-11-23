CREATE TABLE `webhook_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`event` varchar(40) NOT NULL,
	`ok` boolean NOT NULL,
	`attempts` int NOT NULL,
	`last_status` int NOT NULL,
	`last_error` varchar(300),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `webhook_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `webhook_deliveries` ADD CONSTRAINT `webhook_deliveries_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_webhook_deliveries_project` ON `webhook_deliveries` (`project_id`,`id`);