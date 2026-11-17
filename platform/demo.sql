BEGIN;
INSERT INTO cliente(codigo,nome) VALUES ('demo-open-house','Open House'),('demo-horizonte','Laboratório Horizonte') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO instancia(slug,cliente_id,operacao,tipo,hospedagem)
SELECT v.slug,c.id,v.operacao,v.tipo,v.hospedagem FROM (VALUES
('demo-open-house','Bastidores do festival','evento','gerenciada'),
('demo-horizonte','Acesso ao setor restrito','empresa','propria')
) v(slug,operacao,tipo,hospedagem) JOIN cliente c ON c.codigo=v.slug
ON CONFLICT (slug) DO NOTHING;
COMMIT;
