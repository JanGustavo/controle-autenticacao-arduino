-- Criar a tabela USUARIO
CREATE TABLE usuario (
    user_id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    uid_card VARCHAR(100) UNIQUE,
    -- JSONB atende ao MVP, que compara um vetor facial por vez (1:1).
    -- Evolução possível: migrar para pgvector para buscas por similaridade em lote.
    vetor_facial JSONB,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Usuário tem permissão  1:N Permissão
-- Usuaerio tem histórico de acesso 1:N Histórico de Acesso
-- Criar a tabela PERMISSAO
CREATE TABLE permissao (
    permissao_id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL,
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    dias_semana INT [] NOT NULL,
    -- Exemplo: ARRAY[1,2,3,4,5] para Seg-Sex (1=Dom, 7=Sáb ou 1=Seg, 7=Dom)
    CONSTRAINT fk_permissao_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(user_id) ON DELETE CASCADE
);
-- Criar a tabela HISTORICO_ACESSO
CREATE TABLE historico_acesso (
    id SERIAL PRIMARY KEY,
    usuario_id INT,
    uid_card_lido VARCHAR(100),
    data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    autorizado BOOLEAN NOT NULL,
    percentual_similaridade FLOAT,
    motivo_recusa VARCHAR(255),
    CONSTRAINT fk_historico_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(user_id) ON DELETE
    SET NULL
);
-- Acelera a consulta do histórico de um usuário em ordem cronológica.
CREATE INDEX idx_historico_acesso_usuario_data_hora ON historico_acesso (usuario_id, data_hora DESC);