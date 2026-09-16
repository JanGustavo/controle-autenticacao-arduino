-- Criar a tabela LOCAL
CREATE TABLE local (
    local_id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    -- UID que cada ESP32/RC522 manda pra se identificar nas requisições.
    identificador_dispositivo VARCHAR(100) UNIQUE NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Criar a tabela USUARIO
CREATE TABLE usuario (
    user_id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    uid_card VARCHAR(100) UNIQUE,
    -- JSONB atende ao MVP, que compara um vetor facial por vez (1:1).
    vetor_facial JSONB,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Usuário tem acesso a N Locais, via Permissão (tabela de junção com atributos: horário, dias)
-- Usuário tem histórico de acesso 1:N Histórico de Acesso
-- Criar a tabela PERMISSAO
CREATE TABLE permissao (
    permissao_id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    local_id INT NOT NULL,
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    dias_semana INT [] NOT NULL,
    -- Exemplo: ARRAY[1,2,3,4,5] para Seg-Sex (1=Dom, 7=Sáb ou 1=Seg, 7=Dom)
    CONSTRAINT fk_permissao_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_permissao_local FOREIGN KEY (local_id) REFERENCES local(local_id) ON DELETE CASCADE,
    -- Um usuário tem no máximo uma regra de horário por local.
    CONSTRAINT uq_permissao_usuario_local UNIQUE (usuario_id, local_id)
);
-- Criar a tabela HISTORICO_ACESSO
CREATE TABLE historico_acesso (
    id SERIAL PRIMARY KEY,
    usuario_id INT,
    local_id INT,
    uid_card_lido VARCHAR(100),
    data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    autorizado BOOLEAN NOT NULL,
    percentual_similaridade FLOAT,
    motivo_recusa VARCHAR(255),
    CONSTRAINT fk_historico_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(user_id) ON DELETE
    SET NULL,
        CONSTRAINT fk_historico_local FOREIGN KEY (local_id) REFERENCES local(local_id) ON DELETE
    SET NULL
);
-- Criar a tabela ADMINISTRADOR
CREATE TABLE administrador (
    admin_id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    principal BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Garante no máximo 1 administrador principal no sistema
CREATE UNIQUE INDEX uq_administrador_principal ON administrador (principal) WHERE principal = TRUE;

-- Administrador inicial para desenvolvimento: admin@ardlock.local / admin.
-- ATENÇÃO: Esta credencial é destinada EXCLUSIVAMENTE para ambiente local/desenvolvimento.
-- NUNCA utilize esta credencial ou este hash em ambiente de produção.
INSERT INTO administrador (nome, email, senha_hash, principal)
VALUES (
        'Administrador',
        'admin@ardlock.local',
        '$2b$12$aINBb4hKDDfrK3FBd1CpIul9Q3LrB9aT5vceZUbsVBQF8I/aKKlA6',
        TRUE
    ) ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, principal = EXCLUDED.principal;


-- Dados iniciais para desenvolvimento local.
INSERT INTO local (nome, identificador_dispositivo)
VALUES ('Entrada principal', 'ESP32-ENTRADA-01'),
    ('Laboratório de redes', 'ESP32-LAB-01'),
    ('Sala administrativa', 'ESP32-ADM-01') ON CONFLICT (identificador_dispositivo) DO NOTHING;
INSERT INTO usuario (nome, uid_card, vetor_facial, ativo)
VALUES (
        'João Silva',
        'A1B2C3D4',
        '[0.12, -0.34, 0.56, -0.78]',
        TRUE
    ),
    (
        'Maria Souza',
        'E5F6G7H8',
        '[0.21, 0.43, -0.65, 0.87]',
        TRUE
    ),
    (
        'Carlos Lima',
        '12345678',
        '[0.11, 0.22, 0.33, 0.44]',
        TRUE
    ) ON CONFLICT (uid_card) DO NOTHING;
INSERT INTO permissao (
        usuario_id,
        local_id,
        horario_inicio,
        horario_fim,
        dias_semana
    )
SELECT usuario.user_id,
    local.local_id,
    '08:00',
    '18:00',
    ARRAY [2, 3, 4, 5, 6]
FROM usuario
    JOIN local ON local.identificador_dispositivo = 'ESP32-ENTRADA-01'
WHERE usuario.uid_card = 'A1B2C3D4' ON CONFLICT (usuario_id, local_id) DO NOTHING;
INSERT INTO permissao (
        usuario_id,
        local_id,
        horario_inicio,
        horario_fim,
        dias_semana
    )
SELECT usuario.user_id,
    local.local_id,
    '07:00',
    '22:00',
    ARRAY [2, 3, 4, 5, 6, 7]
FROM usuario
    JOIN local ON local.identificador_dispositivo IN ('ESP32-ENTRADA-01', 'ESP32-LAB-01')
WHERE usuario.uid_card = 'E5F6G7H8' ON CONFLICT (usuario_id, local_id) DO NOTHING;
INSERT INTO permissao (
        usuario_id,
        local_id,
        horario_inicio,
        horario_fim,
        dias_semana
    )
SELECT usuario.user_id,
    local.local_id,
    '08:00',
    '17:00',
    ARRAY [2, 3, 4, 5, 6]
FROM usuario
    JOIN local ON local.identificador_dispositivo = 'ESP32-ADM-01'
WHERE usuario.uid_card = '12345678' ON CONFLICT (usuario_id, local_id) DO NOTHING;
INSERT INTO historico_acesso (
        usuario_id,
        local_id,
        uid_card_lido,
        autorizado,
        percentual_similaridade,
        motivo_recusa
    )
SELECT usuario.user_id,
    local.local_id,
    usuario.uid_card,
    TRUE,
    97.5,
    NULL
FROM usuario
    JOIN local ON local.identificador_dispositivo = 'ESP32-ENTRADA-01'
WHERE usuario.uid_card = 'A1B2C3D4';
INSERT INTO historico_acesso (
        usuario_id,
        local_id,
        uid_card_lido,
        autorizado,
        percentual_similaridade,
        motivo_recusa
    )
SELECT usuario.user_id,
    local.local_id,
    usuario.uid_card,
    FALSE,
    48.2,
    'Vetor facial incompatível'
FROM usuario
    JOIN local ON local.identificador_dispositivo = 'ESP32-LAB-01'
WHERE usuario.uid_card = 'E5F6G7H8';
INSERT INTO historico_acesso (
        usuario_id,
        local_id,
        uid_card_lido,
        autorizado,
        percentual_similaridade,
        motivo_recusa
    )
SELECT NULL,
    local.local_id,
    'FFFFFFFF',
    FALSE,
    NULL,
    'Cartão não cadastrado'
FROM local
WHERE local.identificador_dispositivo = 'ESP32-ENTRADA-01';
-- Acelera a consulta do histórico de um usuário específico em ordem cronológica.
CREATE INDEX idx_historico_acesso_usuario_data_hora ON historico_acesso (usuario_id, data_hora DESC);
-- Acelera a consulta do histórico de um local específico em ordem cronológica.
CREATE INDEX idx_historico_acesso_local_data_hora ON historico_acesso (local_id, data_hora DESC);