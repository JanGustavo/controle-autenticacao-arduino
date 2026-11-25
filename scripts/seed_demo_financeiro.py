#!/usr/bin/env python3
"""Seed financeira de apresentação. Execute --apply ou --clean na raiz do repositório."""
import argparse
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PREAMBLE = """
BEGIN;
SELECT pg_advisory_xact_lock(739201);
CREATE TABLE IF NOT EXISTS seed_demo_financeiro (
 tabela text NOT NULL, registro_id bigint NOT NULL,
 PRIMARY KEY(tabela,registro_id)
);
"""
APPLY = """
DO $$
DECLARE inst record; contrato_id bigint; registro bigint; mes integer; dia integer;
BEGIN
 IF EXISTS(SELECT 1 FROM seed_demo_financeiro) THEN
  RAISE NOTICE 'Seed já aplicada; nenhum registro duplicado.';
  RETURN;
 END IF;
 FOR inst IN SELECT slug,hospedagem FROM instancia
 WHERE slug IN ('demo-open-house','demo-horizonte') LOOP
  INSERT INTO contrato(instancia_slug,plano,valor_mensal,inicio)
  VALUES(inst.slug,'Apresentação · ' || inst.hospedagem,
    CASE WHEN inst.hospedagem='gerenciada' THEN 1490 ELSE 690 END,
    current_date-89) RETURNING id INTO contrato_id;
  INSERT INTO seed_demo_financeiro VALUES('contrato',contrato_id);
  FOR mes IN 0..2 LOOP
   INSERT INTO fatura(contrato_id,emitida_em,vencimento,valor,paga_em)
   VALUES(contrato_id,current_date-(mes*30+2),current_date-(mes*30)+5,
    CASE WHEN inst.hospedagem='gerenciada' THEN 1490 ELSE 690 END,
    CASE WHEN mes=0 THEN NULL ELSE current_date-(mes*30)+1 END)
   RETURNING id INTO registro;
   INSERT INTO seed_demo_financeiro VALUES('fatura',registro);
  END LOOP;
  FOR dia IN 0..89 LOOP
   INSERT INTO verificacao_operacional(instancia_slug,verificada_em,disponivel,origem)
   VALUES(inst.slug,now()-make_interval(days=>dia),
      NOT (dia>0 AND dia % CASE WHEN inst.hospedagem='gerenciada' THEN 37 ELSE 19 END=0),
      'seed-apresentacao-financeiro-v1') RETURNING id INTO registro;
   INSERT INTO seed_demo_financeiro VALUES('verificacao_operacional',registro);
  END LOOP;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM seed_demo_financeiro) THEN
  RAISE EXCEPTION 'Instâncias demo existentes não encontradas.';
 END IF;
END $$;
"""
CLEAN = """
DELETE FROM verificacao_operacional WHERE id IN
 (SELECT registro_id FROM seed_demo_financeiro WHERE tabela='verificacao_operacional');
DELETE FROM fatura WHERE id IN
 (SELECT registro_id FROM seed_demo_financeiro WHERE tabela='fatura');
DELETE FROM contrato WHERE id IN
 (SELECT registro_id FROM seed_demo_financeiro WHERE tabela='contrato');
DELETE FROM seed_demo_financeiro;
"""
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--clean', action='store_true')
    args = parser.parse_args()
    sql = PREAMBLE + (APPLY if args.apply else CLEAN) + '\nCOMMIT;'
    subprocess.run(['docker','compose','-f',str(ROOT/'platform/compose.yaml'),
                    'exec','-T','db','psql','-X','-v','ON_ERROR_STOP=1',
                    '-U','plataforma','-d','plataforma'],
                   input=sql, text=True, check=True)
    print('Seed aplicada.' if args.apply else 'Registros da seed removidos; demais dados preservados.')

if __name__ == '__main__':
    main()
