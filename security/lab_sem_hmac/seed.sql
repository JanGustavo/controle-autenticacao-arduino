-- Dados do exercício, sem fotos, embeddings ou contas administrativas.
INSERT INTO local (nome) VALUES ('Porta virtual do laboratorio');
INSERT INTO dispositivo (local_id, nome, identificador)
SELECT local_id, 'Simulador sem atuador', 'ESP32-DEMO-01'
FROM local WHERE nome = 'Porta virtual do laboratorio';
INSERT INTO usuario (nome, tipo_usuario, uid_card)
VALUES ('Participante ficticio do laboratorio', 'INTERNO', 'CAFE2026');
INSERT INTO permissao (usuario_id, local_id, horario_inicio, horario_fim, dias_semana)
SELECT u.user_id, l.local_id, '00:00:00', '23:59:59.999999', ARRAY[1,2,3,4,5,6,7]
FROM usuario u CROSS JOIN local l
WHERE u.uid_card = 'CAFE2026' AND l.nome = 'Porta virtual do laboratorio';
