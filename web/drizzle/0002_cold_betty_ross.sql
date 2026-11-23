ALTER TABLE `comments` ADD `customer_email_verified_at` datetime(3);
--> statement-breakpoint
-- A már meglévő, címmel rendelkező kommentek megbízhatónak számítanak: az értesítések nem szakadnak meg
UPDATE `comments` SET `customer_email_verified_at` = `created_at` WHERE `customer_email` IS NOT NULL;
