# Laboratório isolado: confiança nas requisições e respostas do ESP32

## API com banco fictício em containers

Em 05/10/2026 foi acrescentado um laboratório de rede com a imagem do backend
em execução, um PostgreSQL exclusivo e migrations reais. Não usa mocks para as
regras de acesso. A prova original em memória está descrita nas seções seguintes.

```bash
LAB_BIND_IP=192.168.0.20 bash security/lab_sem_hmac/lab.sh up
python3 security/lab_sem_hmac/verify_lab.py http://192.168.0.20:8002
```

O endereço deve pertencer ao computador publicador. Sem `LAB_BIND_IP`, a API fica
restrita a `127.0.0.1:8002`. A porta 8001 continua sendo a aplicação original.
O laboratório não tem Cloudflare, ESP32 conectado, administrador, fotos nem
embeddings. Usa o dispositivo `ESP32-DEMO-01` e cartão `CAFE2026`, ambos fictícios.
Esses valores são fixtures fornecidas pelo organizador; sua descoberta por
interceptação não foi comprovada.

O banco não publica porta no host, tem volume próprio e rede interna. A API
participa também de uma bridge exclusiva para acesso pelo celular; essa bridge
não é um bloqueio geral de saída à Internet. Nenhum serviço participa das redes
Docker da aplicação original. As chaves do laboratório são geradas separadamente.

Teste executado: declaração da identidade cadastrada e UID fictício, sem token,
iniciou uma tentativa `BIOMETRIA`; consulta sem token retornou `PENDENTE` e
`aguardar`. Duplicata retornou 409, dispositivo divergente 404, face sem token
401. Não houve liberação nem bypass biométrico. Evidência local em
`evidence/verification.json`, excluída do Git.

O timeout foi ampliado apenas no laboratório para 60 segundos. Tentativas sem
face expiram. Aguarde esse tempo antes de repetir o mesmo cartão. Para desligar:

```bash
bash security/lab_sem_hmac/lab.sh down
```

O comando preserva o volume fictício; não altera os containers da aplicação.
O launcher reutiliza a imagem do container `controle-acesso-backend`. Portanto,
ele deve existir na máquina; não é necessária uma nova compilação para esse lab.

Prova realizada em 04/10/2026 para o projeto de extensão. Não instala Kali,
não altera firmware gravado, não acessa a aplicação pública, não captura tráfego
real e não aciona servo ou câmera. Dados de negócio são fictícios.

## Evidência obtida

1. `demo_api.py` usa as rotas reais com FastAPI TestClient, substituindo serviços
   e broadcasts por mocks. Sem JWT/HMAC, o identificador declarado pelo cliente
   chega ao serviço da leitura do cartão; a rota de consulta também aceita a
   requisição. A validade real do cartão/permissão não é testada aqui.
2. A validação facial sem JWT retorna 401, antes de chamar o serviço facial.
   Não foi demonstrado bypass de JWT ou do reconhecimento facial.
3. `demo_firmware.py` extrai do `blink.ino` as funções reais `extrairCampoJson`
   e `aguardarDecisaoAcesso`. Compila essas funções com g++, substituindo as APIs
   Arduino e o HTTP por stubs. Uma resposta `negar` retorna false; uma resposta
   forjada `liberar`, sem assinatura, retorna true. Isso representa a decisão
   que o loop principal usaria para abrir a porta, mas não executa o atuador.

Saída da prova do firmware:

```text
Resposta negar: porta virtual permanece fechada.
Resposta forjada liberar, sem assinatura: firmware retorna TRUE (abertura virtual).
Nenhum servo, ESP32, rede ou banco real foi acessado.
```

Saída das rotas:

```text
1. Identidade de ESP32 declarada pelo cliente, sem assinatura/JWT: HTTP 200.
2. Consulta de decisão sem assinatura/JWT: HTTP 200.
3. Validação facial sem JWT: HTTP 401. Não houve bypass dessa autenticação.
```

## Reprodução

No Pop!_OS ou Kali, Python 3 e g++ bastam para a prova do firmware:

```bash
python3 security/lab_sem_hmac/demo_firmware.py
```

Para as rotas, use um ambiente com as dependências do backend:

```bash
PYTHONPATH=backend python3 security/lab_sem_hmac/demo_api.py
```

Também é possível usar o ambiente do container existente; a execução do
TestClient é isolada do processo Uvicorn e seus serviços de negócio são mocks:

```bash
docker cp security/lab_sem_hmac/demo_api.py controle-acesso-backend:/tmp/ardlock-demo-api.py
docker exec controle-acesso-backend python /tmp/ardlock-demo-api.py
```

## Tráfego e limites da demonstração

O exemplo de configuração do ESP32 usa HTTP e o firmware usa WiFiClient.
O HTTPS no domínio público termina na Cloudflare; não transforma automaticamente
a conexão HTTP local do ESP32 em HTTPS. Confirmar a configuração efetiva antes
de planejar captura de pacotes. Não publicar secrets.h nem capturas com segredos.

Capturar pacotes de HTTPS não revela por si só o JSON. Um cliente com TLS e
validação correta de certificado não deve aceitar um servidor falso. O ataque
de alteração de resposta exige controle do caminho HTTP ou outra falha que
permita substituir a resposta. Esse controle não foi exercido nesta prova.

Para uma próxima demonstração de interceptação, usar uma cópia independente
da aplicação, banco fictício, dispositivo/simulador de laboratório e uma rede
interna de VM, sem conexão ao túnel de produção. Não desligar o Wi-Fi da máquina
publicadora durante o uso normal: isso interrompe túnel e comunicação do ESP32.

## Correções a demonstrar depois

- TLS com validação de certificado no ESP32, para proteger transporte e autenticar
  o servidor. Nunca usar modo inseguro que ignore o certificado.
- Autenticação do dispositivo: chave individual e HMAC-SHA256 incluindo método,
  caminho/query e corpo exatos, timestamp e nonce; impedir repetição no backend.
- Se houver assinatura de comandos na camada da aplicação, o ESP32 precisa
  verificá-la e vinculá-la ao dispositivo, tentativa e validade. HMAC somente
  nas requisições não autentica as respostas que acionam a porta.
- Garantir que reapresentar a mesma decisão não provoque múltiplas aberturas.
- Manter JWT e autorização nas funções administrativas/faciais; identidade do
  dispositivo e identidade do administrador têm mecanismos distintos.

Essas correções são propostas, não implementadas por este laboratório. A prova
antes/depois deve manter os mesmos casos, esperando rejeição da assinatura ausente,
alterada, expirada e repetida, além de sucesso da requisição legítima.

Referências:
- https://www.kali.org/docs/virtualization/install-virtualbox-guest-vm/
- https://www.kali.org/docs/wsl/
- https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html
