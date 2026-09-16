-- Adicionar coluna foto_url na tabela administrador
ALTER TABLE administrador ADD COLUMN IF NOT EXISTS foto_url TEXT;
