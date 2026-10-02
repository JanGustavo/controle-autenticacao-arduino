-- Keep legacy timestamp values intact and retain their original session timezone.
-- Imported rows from another timezone must be reconciled against their source backup.
ALTER TABLE historico_acesso
    ADD COLUMN IF NOT EXISTS data_hora_timezone TEXT NOT NULL
    DEFAULT current_setting('TimeZone');
ALTER TABLE tentativa_acesso
    ADD COLUMN IF NOT EXISTS data_timezone TEXT NOT NULL
    DEFAULT current_setting('TimeZone');
