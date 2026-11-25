BEGIN;
ALTER TABLE licenca ADD COLUMN IF NOT EXISTS plano_json jsonb;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='portal_leitura') THEN
  GRANT UPDATE (plano_json,limite_usuarios,limite_dispositivos,limite_gestores) ON licenca TO portal_leitura;
 END IF;
END $$;
COMMIT;
