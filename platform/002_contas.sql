BEGIN;
CREATE TABLE IF NOT EXISTS conta_plataforma (
 login text PRIMARY KEY, senha_hash text NOT NULL,
 papel text NOT NULL CHECK (papel IN ('root','gestor')),
 cliente_id bigint REFERENCES cliente(id),
 CHECK ((papel='root') = (cliente_id IS NULL))
);
COMMIT;
