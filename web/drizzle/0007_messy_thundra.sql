CREATE TABLE `page_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`round_id` int NOT NULL,
	`page_url` varchar(1000) NOT NULL,
	`page_hash` varchar(64) NOT NULL,
	`approved_by` varchar(120) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `page_approvals_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_page_approvals` UNIQUE(`round_id`,`page_hash`)
);
--> statement-breakpoint
ALTER TABLE `page_approvals` ADD CONSTRAINT `page_approvals_round_id_rounds_id_fk` FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON DELETE cascade ON UPDATE no action;