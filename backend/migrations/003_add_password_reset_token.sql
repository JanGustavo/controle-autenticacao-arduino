-- Tabela de tokens de recuperação de senha para administradores.
-- O token original trafega apenas no e-mail; apenas seu hash SHA-256 é armazenado.
CREATE TABLE IF NOT EXISTS password_reset_token (
    id         SERIAL PRIMARY KEY,
    admin_id   INT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expira_em  TIMESTAMP NOT NULL,
    usado      BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reset_token_admin
        FOREIGN KEY (admin_id) REFERENCES administrador(admin_id) ON DELETE CASCADE
);

-- Acelera a busca pelo hash durante a validação do token.
CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_token (token_hash);
-- Acelera a invalidação de tokens anteriores de um administrador.
CREATE INDEX IF NOT EXISTS idx_reset_token_admin_id ON password_reset_token (admin_id);
