CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`username` varchar(80) NOT NULL,
	`action` varchar(80) NOT NULL,
	`entity` varchar(80) NOT NULL,
	`details` text,
	`ipAddress` varchar(80),
	`userAgent` text,
	`location` varchar(160),
	`vpnStatus` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `panel_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(80) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`displayName` varchar(120) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastLoginAt` timestamp,
	CONSTRAINT `panel_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `panel_accounts_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `panelRole` enum('owner','editor') DEFAULT 'owner' NOT NULL;