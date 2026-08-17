ALTER TABLE `gj_mt5_connections` MODIFY COLUMN `apiKey` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `gj_mt5_connections` ADD `apiKeyHash` varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX `gj_mt5_connection_key_hash_unique` ON `gj_mt5_connections` (`apiKeyHash`);--> statement-breakpoint
CREATE INDEX `gj_cash_owner_account_date_idx` ON `gj_cash_movements` (`userId`,`accountId`,`movementDate`);--> statement-breakpoint
CREATE INDEX `gj_skipped_owner_account_date_idx` ON `gj_skipped_trades` (`userId`,`accountId`,`tradeDate`);--> statement-breakpoint
CREATE INDEX `gj_notification_owner_account_type_idx` ON `gj_notification_history` (`userId`,`accountId`,`type`);
