DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tentativa_acesso'
          AND column_name = 'identificador_dispositivo'
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_tentativa_pendente_dispositivo_cartao
            ON tentativa_acesso (
                identificador_dispositivo,
                uid_card_lido
            )
            WHERE status = 'PENDENTE';
    END IF;
END $$;
