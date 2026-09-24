-- Normaliza Local -> Dispositivo (1:N) preservando os dados existentes.

CREATE TABLE IF NOT EXISTS dispositivo (
    dispositivo_id SERIAL PRIMARY KEY,
    local_id INT NOT NULL,
    nome VARCHAR(255) NOT NULL,
    identificador VARCHAR(100) UNIQUE NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dispositivo_local
        FOREIGN KEY (local_id) REFERENCES local(local_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dispositivo_local_id
    ON dispositivo(local_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'local'
          AND column_name = 'identificador_dispositivo'
    ) THEN
        INSERT INTO dispositivo (local_id, nome, identificador, ativo, criado_em)
        SELECT
            local_id,
            'Dispositivo principal',
            identificador_dispositivo,
            ativo,
            criado_em
        FROM local
        WHERE identificador_dispositivo IS NOT NULL
        ON CONFLICT (identificador) DO NOTHING;
    END IF;
END $$;

ALTER TABLE tentativa_acesso
    ADD COLUMN IF NOT EXISTS dispositivo_id INT;

ALTER TABLE historico_acesso
    ADD COLUMN IF NOT EXISTS dispositivo_id INT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tentativa_acesso'
          AND column_name = 'identificador_dispositivo'
    ) THEN
        UPDATE tentativa_acesso t
        SET dispositivo_id = d.dispositivo_id
        FROM dispositivo d
        WHERE t.dispositivo_id IS NULL
          AND d.identificador = t.identificador_dispositivo;
    END IF;
END $$;

-- O histórico legado só conhecia o local. Antes desta migração havia
-- exatamente um identificador físico por local, então usamos o dispositivo
-- migrado daquele local para preservar a rastreabilidade possível.
UPDATE historico_acesso h
SET dispositivo_id = (
    SELECT d.dispositivo_id
    FROM dispositivo d
    WHERE d.local_id = h.local_id
    ORDER BY d.dispositivo_id
    LIMIT 1
)
WHERE h.dispositivo_id IS NULL
  AND h.local_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_tentativa_dispositivo'
    ) THEN
        ALTER TABLE tentativa_acesso
            ADD CONSTRAINT fk_tentativa_dispositivo
            FOREIGN KEY (dispositivo_id)
            REFERENCES dispositivo(dispositivo_id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_historico_dispositivo'
    ) THEN
        ALTER TABLE historico_acesso
            ADD CONSTRAINT fk_historico_dispositivo
            FOREIGN KEY (dispositivo_id)
            REFERENCES dispositivo(dispositivo_id)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM tentativa_acesso WHERE dispositivo_id IS NULL
    ) THEN
        ALTER TABLE tentativa_acesso
            ALTER COLUMN dispositivo_id SET NOT NULL;
    END IF;
END $$;

DROP INDEX IF EXISTS uq_tentativa_pendente_dispositivo_cartao;
DROP INDEX IF EXISTS idx_tentativa_acesso_dispositivo_uid;

CREATE INDEX IF NOT EXISTS idx_tentativa_acesso_dispositivo_uid
    ON tentativa_acesso (dispositivo_id, uid_card_lido, criado_em DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tentativa_pendente_dispositivo_cartao
    ON tentativa_acesso (dispositivo_id, uid_card_lido)
    WHERE status = 'PENDENTE';

ALTER TABLE tentativa_acesso
    DROP COLUMN IF EXISTS identificador_dispositivo;

ALTER TABLE local
    DROP COLUMN IF EXISTS identificador_dispositivo;
