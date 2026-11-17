BEGIN;
CREATE TABLE IF NOT EXISTS contrato (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 instancia_slug text NOT NULL REFERENCES instancia(slug),
 plano text NOT NULL CHECK(trim(plano)<>''),
 valor_mensal numeric(14,2) NOT NULL CHECK(valor_mensal>=0),
 inicio date NOT NULL,
 fim date,
 CHECK(fim IS NULL OR fim>=inicio)
);
CREATE TABLE IF NOT EXISTS fatura (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 contrato_id bigint NOT NULL REFERENCES contrato(id),
 emitida_em date NOT NULL,
 vencimento date NOT NULL,
 valor numeric(14,2) NOT NULL CHECK(valor>=0),
 paga_em date,
 cancelada_em timestamptz
);
CREATE TABLE IF NOT EXISTS verificacao_operacional (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 instancia_slug text NOT NULL REFERENCES instancia(slug),
 verificada_em timestamptz NOT NULL DEFAULT now(),
 disponivel boolean NOT NULL,
 origem text NOT NULL CHECK(trim(origem)<>'')
);
CREATE INDEX IF NOT EXISTS verificacao_instancia_data ON verificacao_operacional(instancia_slug,verificada_em DESC);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='portal_leitura') THEN
  GRANT SELECT ON contrato,fatura,verificacao_operacional,licenca TO portal_leitura;
 END IF;
END $$;
COMMIT;
