#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
#include <secrets.h>

// Configuração dos pinos
#define LED_VERDE 4
#define LED_VERMELHO 16
#define BUZZER_PIN 2
#define SERVO_PIN 13

#define SS_PIN 14
#define RST_PIN 27

#define SPI_SCK 33
#define SPI_MISO 34
#define SPI_MOSI 32

// Objetos e configurações
const char *ssid = WIFI_SSID;
const char *password = WIFI_PASSWORD;
const char *identificadorDispositivo = "ESP32-ENTRADA-01";

// Endpoints
const char *api_health = API_URL "/api/v1/health";
const char *api_verify_card = API_URL "/api/v1/arduino/verificar-cartao";
const char *api_resultado_acesso = API_URL "/api/v1/arduino/resultado-acesso";

MFRC522 rfid(SS_PIN, RST_PIN);
Servo servo;

// Declaração das funções (Protótipos)
void testLed(int led);
void testarWiFi();
void testarAPI();
void inicializarRFID();
bool lerRFID(char *buffer);
char *obterRFIDString(char *buffer);
bool iniciarTentativaAcesso(const char *uuid, String &tentativaId);
bool aguardarDecisaoAcesso(const String &tentativaId);
String extrairCampoJson(const String &json, const String &campo);
void acenderLedVerde();
void acenderLedVermelho();
void animacaoAprovado();
void animacaoNegado();
void acionarServoPorta(bool abrir);
void emitirBuzzer(int frequencia, int duracaoMs);

// Setup
void setup()
{
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.println("Inicializando sistema...");

    // Inicialização dos LEDs, Buzzer e Servo
    pinMode(LED_VERDE, OUTPUT);
    pinMode(LED_VERMELHO, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);

    servo.attach(SERVO_PIN);
    servo.write(0); // Garante tranca fechada

    // Teste dos LEDs e Buzzer
    Serial.println("\nTestando LED verde...");
    testLed(LED_VERDE);

    Serial.println("Testando LED vermelho...");
    testLed(LED_VERMELHO);

    emitirBuzzer(2000, 100);

    // Teste do Wi-Fi
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);

    Serial.print("Conectando ao Wi-Fi");
    int tentativas = 0;

    while (WiFi.status() != WL_CONNECTED && tentativas < 30)
    {
        delay(500);
        Serial.print(".");
        tentativas++;
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("Wi-Fi conectado!");
        Serial.print("IP do ESP32: ");
        Serial.println(WiFi.localIP());
    }
    else
    {
        Serial.println("Falha ao conectar ao Wi-Fi.");
        Serial.printf("Status: %d\n", WiFi.status());
    }

    // Teste da API
    if (WiFi.status() == WL_CONNECTED)
    {
        testarAPI();
    }
    else
    {
        Serial.println("API nao testada: Wi-Fi indisponivel.");
    }

    // Inicialização do RFID
    inicializarRFID();

    Serial.println("\nSistema pronto!");
    Serial.println("Aproxime um cartao RFID...");
}

// Loop principal
void loop()
{
    char uidBuffer[30] = {0};

    // Se lerRFID retornar true, o uidBuffer estará preenchido
    if (lerRFID(uidBuffer))
    {
        Serial.println();
        Serial.print("LIDO: ");
        Serial.println(uidBuffer);

        String tentativaId;

        // Fase 1: o backend valida RFID + dispositivo + local + usuário +
        // permissão + dia/horário ANTES de qualquer processamento facial.
        if (iniciarTentativaAcesso(uidBuffer, tentativaId))
        {
            Serial.println("Elegibilidade aprovada. Aguardando biometria 1:1...");

            digitalWrite(LED_VERDE, HIGH);
            delay(250);
            digitalWrite(LED_VERDE, LOW);

            // Fase 2/3: o frontend/totem envia a face ao backend.
            // O ESP32 apenas consulta a decisão calculada pelo servidor.
            if (aguardarDecisaoAcesso(tentativaId))
            {
                Serial.println("Acesso APROVADO pelo backend! Abrindo porta...");
                animacaoAprovado();
            }
            else
            {
                Serial.println("Acesso NEGADO pelo backend.");
                animacaoNegado();
            }
        }
        else
        {
            Serial.println("Elegibilidade RFID recusada pelo backend.");
            animacaoNegado();
        }

        Serial.println("\nAguardando novo cartão...");
    }
}

// Teste dos LEDs
void testLed(int led)
{
    digitalWrite(led, HIGH);
    delay(300);
    digitalWrite(led, LOW);
    delay(300);
    digitalWrite(led, HIGH);
    delay(300);
    digitalWrite(led, LOW);
    delay(300);
}

// Acionamento do Servo da Catraca/Porta
void acionarServoPorta(bool abrir)
{
    if (abrir)
    {
        servo.write(90); // Abre a trava / catraca
    }
    else
    {
        servo.write(0); // Tranca novamente
    }
}

// Emissão de som pelo Buzzer
void emitirBuzzer(int frequencia, int duracaoMs)
{
    tone(BUZZER_PIN, frequencia, duracaoMs);
    delay(duracaoMs);
    noTone(BUZZER_PIN);
}

// Animação Acesso Aprovado: LED Verde, Buzzer duplo e abertura de Servo
void animacaoAprovado()
{
    acionarServoPorta(true);
    emitirBuzzer(2500, 150);
    delay(50);
    emitirBuzzer(3000, 200);

    for (int i = 0; i < 3; i++)
    {
        digitalWrite(LED_VERDE, HIGH);
        delay(300);
        digitalWrite(LED_VERDE, LOW);
        delay(300);
    }

    delay(2000);              // Tempo para o usuário atravessar
    acionarServoPorta(false); // Fecha novamente
}

// Animação Acesso Negado: LED Vermelho e Buzzer grave de erro
void animacaoNegado()
{
    acionarServoPorta(false);
    emitirBuzzer(400, 400);

    for (int i = 0; i < 3; i++)
    {
        digitalWrite(LED_VERMELHO, HIGH);
        delay(300);
        digitalWrite(LED_VERMELHO, LOW);
        delay(300);
    }
}

String extrairCampoJson(const String &json, const String &campo)
{
    String chave = "\"" + campo + "\"";
    int chavePos = json.indexOf(chave);

    if (chavePos < 0)
    {
        return "";
    }

    int doisPontos = json.indexOf(':', chavePos + chave.length());
    if (doisPontos < 0)
    {
        return "";
    }

    int inicio = doisPontos + 1;
    while (inicio < json.length() && (json[inicio] == ' ' || json[inicio] == '\t'))
    {
        inicio++;
    }

    if (inicio < json.length() && json[inicio] == '"')
    {
        inicio++;
        int fim = json.indexOf('"', inicio);
        return fim >= 0 ? json.substring(inicio, fim) : "";
    }

    int fim = inicio;
    while (
        fim < json.length() &&
        json[fim] != ',' &&
        json[fim] != '}' &&
        json[fim] != '\n')
    {
        fim++;
    }

    String valor = json.substring(inicio, fim);
    valor.trim();
    return valor;
}

bool iniciarTentativaAcesso(const char *uuid, String &tentativaId)
{
    WiFiClient client;
    HTTPClient http;

    if (!http.begin(client, api_verify_card))
    {
        Serial.println("ERRO: nao foi possivel iniciar HTTPClient");
        return false;
    }

    http.addHeader("Content-Type", "application/json");

    char payload[220];
    snprintf(
        payload,
        sizeof(payload),
        "{\"uid_card\":\"%s\",\"identificador_dispositivo\":\"%s\"}",
        uuid,
        identificadorDispositivo);

    int httpCode = http.POST((uint8_t *)payload, strlen(payload));

    Serial.print("HTTP status elegibilidade: ");
    Serial.println(httpCode);

    if (httpCode != 200)
    {
        Serial.print("RFID/eligibilidade recusado. HTTP: ");
        Serial.println(httpCode);
        http.end();
        return false;
    }

    String response = http.getString();
    tentativaId = extrairCampoJson(response, "tentativa_id");

    Serial.print("Tentativa criada: ");
    Serial.println(tentativaId);

    http.end();
    return tentativaId.length() > 0;
}

bool aguardarDecisaoAcesso(const String &tentativaId)
{
    const unsigned long timeoutMs = 18000;
    const unsigned long inicio = millis();

    while (millis() - inicio < timeoutMs)
    {
        if (WiFi.status() != WL_CONNECTED)
        {
            Serial.println("Wi-Fi indisponivel durante consulta da decisao.");
            return false;
        }

        WiFiClient client;
        HTTPClient http;

        String url =
            String(api_resultado_acesso) +
            "?tentativa_id=" + tentativaId +
            "&identificador_dispositivo=" + identificadorDispositivo;

        if (!http.begin(client, url))
        {
            Serial.println("ERRO: nao foi possivel consultar resultado.");
            return false;
        }

        int httpCode = http.GET();

        if (httpCode == 200)
        {
            String response = http.getString();
            String comando = extrairCampoJson(response, "comando");

            http.end();

            if (comando == "liberar")
            {
                return true;
            }

            if (comando == "negar")
            {
                return false;
            }

            // "aguardar": biometria ainda não concluiu.
            delay(300);
            continue;
        }

        Serial.print("Falha ao consultar resultado. HTTP: ");
        Serial.println(httpCode);
        http.end();
        delay(500);
    }

    Serial.println("Timeout aguardando decisao facial do backend.");
    return false;
}

// Teste da API (Health)
void testarAPI()
{
    Serial.println("\nTeste da API\nCriando requisicao...");

    WiFiClient client;
    HTTPClient http;

    if (!http.begin(client, api_health))
    {
        Serial.println("ERRO: nao foi possivel iniciar HTTPClient");
        return;
    }

    int httpCode = http.GET();
    Serial.print("HTTP status: ");
    Serial.println(httpCode);

    if (httpCode == 200)
    {
        String response = http.getString();
        Serial.println("API viva.");
        Serial.print("Resposta da API: ");
        Serial.println(response);
    }
    else
    {
        Serial.println("API inacessivel.");
        Serial.print("Erro HTTP: ");
        Serial.println(http.errorToString(httpCode));
    }
    http.end();
}

// Inicialização do RC522
void inicializarRFID()
{
    Serial.println("\nIniciando RC522...");
    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SS_PIN);
    rfid.PCD_Init();
    delay(100);
    rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);
    rfid.PCD_DumpVersionToSerial();
    Serial.println("RC522 pronto.");
}

// Leitura do RFID
bool lerRFID(char *buffer)
{
    if (!rfid.PICC_IsNewCardPresent())
    {
        delay(50);
        return false;
    }

    if (!rfid.PICC_ReadCardSerial())
    {
        delay(50);
        return false;
    }

    Serial.println("\nCartao detectado!");

    obterRFIDString(buffer);

    Serial.print("UID Convertido: ");
    Serial.println(buffer);

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();

    return true;
}

// Converte os bytes do RFID
char *obterRFIDString(char *buffer)
{
    int pos = 0;
    for (byte i = 0; i < rfid.uid.size; i++)
    {
        pos += sprintf(&buffer[pos], "%02X", rfid.uid.uidByte[i]);
    }
    return buffer;
}