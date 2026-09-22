CREATE TABLE `chat_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` int NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`assignedUserId` int,
	`assignedUsername` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`senderType` enum('visitor','agent') NOT NULL,
	`senderName` varchar(140) NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_visitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicToken` varchar(96) NOT NULL,
	`name` varchar(140) NOT NULL,
	`email` varchar(320),
	`phone` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_visitors_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_visitors_publicToken_unique` UNIQUE(`publicToken`)
);
