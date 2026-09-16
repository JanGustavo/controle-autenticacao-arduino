-- Adicionar coluna 'principal' na tabela ADMINISTRADOR se não existir
ALTER TABLE administrador ADD COLUMN IF NOT EXISTS principal BOOLEAN NOT NULL DEFAULT FALSE;

-- Garantir que a conta inicial admin@ardlock.local seja a conta principal
UPDATE administrador SET principal = TRUE WHERE email = 'admin@ardlock.local';

-- Criar índice UNIQUE parcial para garantir que exista no máximo uma conta principal no banco
CREATE UNIQUE INDEX IF NOT EXISTS uq_administrador_principal ON administrador (principal) WHERE principal = TRUE;
