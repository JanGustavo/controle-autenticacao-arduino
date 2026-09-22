CREATE UNIQUE INDEX uq_tentativa_pendente_dispositivo_cartao
    ON tentativa_acesso (
        identificador_dispositivo,
        uid_card_lido
    )
    WHERE status = 'PENDENTE';