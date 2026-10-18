-- Perfil cadastral do usuário: CPF opcional e categoria obrigatória.
-- Usuários existentes são classificados como INTERNO para preservar compatibilidade.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'tipo_usuario_enum'
    ) THEN
        CREATE TYPE tipo_usuario_enum AS ENUM ('INTERNO', 'VISITANTE');
    END IF;
END $$;

ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS cpf VARCHAR(11),
    ADD COLUMN IF NOT EXISTS tipo_usuario tipo_usuario_enum NOT NULL DEFAULT 'INTERNO';

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_cpf
    ON usuario (cpf)
    WHERE cpf IS NOT NULL;

COMMENT ON COLUMN usuario.cpf IS 'CPF normalizado com 11 dígitos; opcional.';
COMMENT ON COLUMN usuario.tipo_usuario IS 'Categoria obrigatória: INTERNO ou VISITANTE.';
