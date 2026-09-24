CREATE TABLE IF NOT EXISTS tentativa_acesso (
    tentativa_id UUID PRIMARY KEY,
    usuario_id INT NOT NULL,
    local_id INT NOT NULL,
    uid_card_lido VARCHAR(100) NOT NULL,
    identificador_dispositivo VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_em TIMESTAMP NOT NULL,
    concluido_em TIMESTAMP,
    percentual_similaridade FLOAT,
    motivo_recusa VARCHAR(255),
    CONSTRAINT fk_tentativa_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuario(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_tentativa_local
        FOREIGN KEY (local_id) REFERENCES local(local_id) ON DELETE CASCADE,
    CONSTRAINT ck_tentativa_status
        CHECK (status IN ('PENDENTE', 'AUTORIZADO', 'NEGADO', 'EXPIRADO'))
);

CREATE INDEX IF NOT EXISTS idx_tentativa_acesso_status_expira
    ON tentativa_acesso (status, expira_em);

CREATE INDEX IF NOT EXISTS idx_tentativa_acesso_dispositivo_uid
    ON tentativa_acesso (
        identificador_dispositivo,
        uid_card_lido,
        criado_em DESC
    );