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
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Administrador inicial para desenvolvimento: admin@ardlock.local / admin.
INSERT INTO administrador (nome, email, senha_hash)
VALUES (
        'Administrador',
        'admin@ardlock.local',
        'pbkdf2_sha256$600000$koFOu6NXaKwtDolxq2RFQw$1e08a4d346ea95108daeda3442b71565fc6bda843563ce6d64ec3b9af54c26d8'
    ) ON CONFLICT (email) DO NOTHING;
-- Acelera a consulta do histórico de um usuário específico em ordem cronológica.
CREATE INDEX idx_historico_acesso_usuario_data_hora ON historico_acesso (usuario_id, data_hora DESC);
-- Acelera a consulta do histórico de um local específico em ordem cronológica.
CREATE INDEX idx_historico_acesso_local_data_hora ON historico_acesso (local_id, data_hora DESC);