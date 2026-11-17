BEGIN;
CREATE TABLE IF NOT EXISTS cliente (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome text NOT NULL CHECK (trim(nome) <> ''),
    codigo text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS instancia (
    slug text PRIMARY KEY,
    cliente_id bigint NOT NULL REFERENCES cliente(id),
    operacao text NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('empresa','evento')),
    hospedagem text NOT NULL CHECK (hospedagem IN ('propria','gerenciada')),
    dominio text UNIQUE
);
CREATE TABLE IF NOT EXISTS licenca (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instancia_slug text NOT NULL REFERENCES instancia(slug),
    inicio date NOT NULL,
    fim date,
    revogada_em timestamptz,
    CHECK (fim IS NULL OR fim >= inicio)
);
COMMIT;
