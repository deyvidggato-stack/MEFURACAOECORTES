ALTER TABLE `chat_visitors` ADD `username` varchar(80) NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_visitors` ADD `passwordHash` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_visitors` ADD CONSTRAINT `chat_visitors_username_unique` UNIQUE(`username`);