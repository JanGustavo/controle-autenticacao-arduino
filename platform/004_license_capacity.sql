BEGIN;
ALTER TABLE licenca ADD COLUMN IF NOT EXISTS limite_usuarios integer CHECK(limite_usuarios > 0);
ALTER TABLE licenca ADD COLUMN IF NOT EXISTS limite_dispositivos integer CHECK(limite_dispositivos > 0);
ALTER TABLE licenca ADD COLUMN IF NOT EXISTS limite_gestores integer CHECK(limite_gestores > 0);
ALTER TABLE licenca ADD COLUMN IF NOT EXISTS observacoes text;
COMMIT;
