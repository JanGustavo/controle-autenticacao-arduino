# Guard Walk: preparação para vários clientes

## Decisão e alcance

Uma base de código, uma instalação isolada por contrato. Cada projeto Compose tem PostgreSQL, volume de IA/SQLite, rede, backend e frontend próprios. O administrador principal pertence à sua instalação, não à plataforma inteira. Office é o nome informado para o cliente atual; não foi encontrado como entidade no banco. Não há cliente mestre nem cópia dos dados atuais para novos contratos.

Esta entrega prepara o provisionamento por operador. Não implementa ainda portal de contratação, assistente no painel, pagamento, validação de licença, expiração de evento, identidade visual configurável ou autenticação de dispositivos. O frontend continua com a marca ArdLock. `instance.json` registra nome/tipo, mas a aplicação ainda não os consome. Empresa/evento são classificações operacionais, sem alteração das regras de acesso.

## Nova empresa ou evento

Na raiz do repositório, Python 3 e Docker Compose v2 são necessários. Use portas distintas e mantenha as pastas geradas na mesma máquina do checkout (os caminhos de build são absolutos).

```bash
python3 scripts/prepare_instance.py empresa-x --name 'Empresa X' --type empresa --port 8081
python3 scripts/prepare_instance.py show-novembro --name 'Show de novembro' --type evento --port 8082
cd instances/empresa-x
docker compose -f compose.json up -d --wait db
cd ../..
python3 scripts/migrate_instance.py instances/empresa-x
cd instances/empresa-x
docker compose -f compose.json up -d --build
docker compose -f compose.json exec backend python /app/bootstrap_instance.py
```

Abra `http://localhost:8081`. Cadastre locais, dispositivos, pessoas e permissões pelo painel atual. As senhas são geradas por cliente; o bootstrap pede os dados do responsável sem imprimir a senha e recusa banco que já tenha administradores. Novos bancos não recebem pessoas, cartões, locais ou login de demonstração. O inicializador limpo é derivado do DDL atual, com limites validados; as migrations 001–010 permanecem intactas e são aplicadas antes de iniciar a API. Execute um operador por vez; o runner não possui ledger nem coordenação concorrente.

Os serviços novos não publicam PostgreSQL ou API no host. A porta web atende apenas loopback: para uso por ESP32 e totens na rede, configure proxy/TLS ou túnel por cliente apontando para essa porta e ajuste `FRONTEND_URL` no `.env`. Todos os dispositivos daquele cliente devem usar seu domínio. O túnel legado não é reutilizado automaticamente. SMTP e Groq precisam ser configurados explicitamente no ambiente do backend; a configuração gerada não inclui essas integrações.

## Preservar a instalação atual

1. Mantenha o Compose, o `.env`, o nome do projeto e os volumes atuais. Não rode o provisionador sobre o volume existente. Registre a instalação atual como o contrato Office no inventário operacional; seu banco já representa somente esse cliente.
2. Antes de qualquer futura transferência: interrompa escritas em janela combinada, gere backup PostgreSQL com `pg_dump -Fc`, copie o volume `ia_data` com a aplicação parada e preserve configuração, fuso, domínio e segredos em local restrito. Registre contagens de administradores, usuários, locais, dispositivos, permissões, tentativas, histórico e auditoria.
3. Se quiser mover Office para outra instalação, faça ensaio de restauração em ambiente vazio, separado dos novos clientes. Não inicialize dados de demonstração nem rode bootstrap no banco restaurado. Valide contagens, IDs, relações, timestamps/fusos, login, IA, recuperação de senha, RFID → face → decisão e WebSocket. Só depois altere domínio/dispositivos.
4. Para retorno, volte o roteamento ao ambiente antigo preservado. Não opere os dois bancos recebendo acessos simultaneamente. Após novas escritas no destino, um retorno exige conciliação desses registros; backup sozinho não evita perda de escritas recentes.

Não foi executada migração de produção. Nenhuma migration anterior foi renumerada ou alterada. Evite `make up` para clientes novos: o Makefile legado usa nomes de banco fixos. Use os comandos acima. Nunca execute `down -v` para manutenção normal; ele apaga os volumes selecionados.

## Homologação e próximos incrementos

- Subir duas instâncias em portas diferentes; cadastrar o mesmo CPF/UID em ambas e conferir independência de usuários, histórico, IA e eventos WebSocket.
- Verificar que token JWT de A é rejeitado por B (segredos distintos), e testar o fluxo físico completo com cada domínio.
- Restaurar um backup de Office em homologação antes de qualquer mudança do cliente atual.
- Implementar catálogo de contratos/licenças, limites de leitores, vigência e estado comercial; decisões de acesso durante falhas e término de licença precisam de regra explícita.
- Criar assistente: nome e tipo → responsável → domínio → locais/leitores → teste de acesso. Para evento: datas, janela de entrada, reentrada e encerramento/exportação/retencão; não há controle de ingresso único atualmente.
- Autenticar rotas físicas e WebSocket antes da exposição comercial; a separação de instâncias não corrige essas lacunas já existentes. Medir RAM/CPU por instância (modelo facial carregado por backend) antes de precificar.

Validação nesta entrega: testes do provisionador (isolamento de configuração, segredos, ausência de seeds, permissões e rejeição de sobrescrita). Sem Docker/PostgreSQL neste ambiente: execução Compose, migrations SQL e fluxo de hardware ainda exigem homologação real.
