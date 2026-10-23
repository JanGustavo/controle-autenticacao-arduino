#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <secrets.h>

// ============================================================
// Diagnóstico de bancada: LED verde + LED vermelho + RC522 + API
// Servo e buzzer ficam propositalmente DESABILITADOS neste sketch.
// ============================================================

// LEDs
#define LED_VERDE 4
#define LED_VERMELHO 16

// RC522 / SPI
#define SS_PIN 14
#define RST_PIN 27
#define SPI_SCK 33
#define SPI_MISO 34
#define SPI_MOSI 32

const char *ssid = WIFI_SSID;
const char *password = WIFI_PASSWORD;
const char *identificadorDispositivo = DEVICE_ID;

const char *api_health = API_URL "/api/v1/health";
const char *api_verify_card = API_URL "/api/v1/arduino/verificar-cartao";
const char *api_resultado_acesso = API_URL "/api/v1/arduino/resultado-acesso";

MFRC522 rfid(SS_PIN, RST_PIN);

bool validarMapaPinos();
void imprimirMapaPinos();
void testarLed(int pin, const char *nome);
bool testarRC522();
bool conectarWiFi();
bool testarAPI();
bool lerRFID(String &uid);
String extrairCampoJson(const String &json, const String &campo);
bool iniciarTentativaAcesso(const String &uid, String &tentativaId);
String aguardarComandoFinal(const String &tentativaId);
void sinalizarAprovado();
void sinalizarNegado();
void sinalizarElegivel();

void setup()
{
    Serial.begin(115200);
    delay(1200);

    Serial.println();
    Serial.println("============================================================");
    Serial.println(" ArdLock - Diagnostico de Bancada (LEDs + RC522 + Backend)");
    Serial.println(" Servo: DESABILITADO");
    Serial.println(" Buzzer: DESABILITADO");
    Serial.println("============================================================");

    imprimirMapaPinos();

    if (!validarMapaPinos())
    {
        Serial.println("[FALHA] Existem pinos duplicados/conflitantes na configuracao.");
        Serial.println("Corrija o mapa antes de continuar.");
        while (true)
        {
            delay(1000);
        }
    }

    Serial.println("[OK] Mapa de pinos sem conflitos internos.");

    pinMode(LED_VERDE, OUTPUT);
    pinMode(LED_VERMELHO, OUTPUT);
    digitalWrite(LED_VERDE, LOW);
    digitalWrite(LED_VERMELHO, LOW);

    Serial.println();
    Serial.println("--- TESTE VISUAL DOS LEDs ---");
    testarLed(LED_VERDE, "VERDE");
    testarLed(LED_VERMELHO, "VERMELHO");
    Serial.println("Confirme visualmente se cada LED piscou 3 vezes.");

    Serial.println();
    Serial.println("--- TESTE DO RC522 ---");
    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SS_PIN);
    rfid.PCD_Init();
    delay(100);

    if (!testarRC522())
    {
        Serial.println("[FALHA] RC522 nao respondeu de forma valida.");
        Serial.println("Confira alimentacao 3V3, GND, SCK, MISO, MOSI, SS e RST.");
    }

    Serial.println();
    Serial.println("--- TESTE DE REDE / BACKEND ---");
    const bool wifiOk = conectarWiFi();
    if (wifiOk)
    {
        testarAPI();
    }
    else
    {
        Serial.println("[AVISO] Fluxo de backend indisponivel sem Wi-Fi.");
    }

    Serial.println();
    Serial.println("============================================================");
    Serial.println(" Diagnostico inicial concluido.");
    Serial.println(" Aproxime um cartao RFID para testar o fluxo real.");
    Serial.println("============================================================");
}

void loop()
{
    String uid;

    if (!lerRFID(uid))
    {
        delay(40);
        return;
    }

    Serial.println();
    Serial.print("[RFID] UID lido: ");
    Serial.println(uid);

    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("[ERRO] Wi-Fi desconectado. Testando somente leitura local.");
        sinalizarNegado();
        delay(1200);
        return;
    }

    String tentativaId;
    if (!iniciarTentativaAcesso(uid, tentativaId))
    {
        Serial.println("[NEGADO] Backend recusou a elegibilidade do RFID.");
        sinalizarNegado();
        delay(1200);
        return;
    }

    Serial.print("[OK] Tentativa criada: ");
    Serial.println(tentativaId);
    Serial.println("[INFO] RFID elegivel. O Totem deve abrir a camera.");
    sinalizarElegivel();

    String comando = aguardarComandoFinal(tentativaId);

    if (comando == "liberar")
    {
        Serial.println("[APROVADO] Backend retornou comando liberar.");
        sinalizarAprovado();
    }
    else
    {
        Serial.print("[NEGADO] Comando final: ");
        Serial.println(comando.length() ? comando : "timeout/erro");
        sinalizarNegado();
    }

    Serial.println();
    Serial.println("Aguardando novo cartao...");
    delay(900);
}

bool validarMapaPinos()
{
    const int pinos[] = {
        LED_VERDE,
        LED_VERMELHO,
        SS_PIN,
        RST_PIN,
        SPI_SCK,
        SPI_MISO,
        SPI_MOSI,
    };

    const size_t quantidade = sizeof(pinos) / sizeof(pinos[0]);

    for (size_t i = 0; i < quantidade; i++)
    {
        for (size_t j = i + 1; j < quantidade; j++)
        {
            if (pinos[i] == pinos[j])
            {
                return false;
            }
        }
    }

    return true;
}

void imprimirMapaPinos()
{
    Serial.println();
    Serial.println("--- MAPA DE PINOS CONFIGURADO ---");
    Serial.printf("LED verde    -> GPIO %d\n", LED_VERDE);
    Serial.printf("LED vermelho -> GPIO %d\n", LED_VERMELHO);
    Serial.printf("RC522 SCK    -> GPIO %d\n", SPI_SCK);
    Serial.printf("RC522 MISO   -> GPIO %d\n", SPI_MISO);
    Serial.printf("RC522 MOSI   -> GPIO %d\n", SPI_MOSI);
    Serial.printf("RC522 SS/SDA -> GPIO %d\n", SS_PIN);
    Serial.printf("RC522 RST    -> GPIO %d\n", RST_PIN);
    Serial.println("RC522 VCC    -> 3V3");
    Serial.println("RC522 GND    -> GND");
}

void testarLed(int pin, const char *nome)
{
    Serial.print("Testando LED ");
    Serial.println(nome);

    for (int i = 0; i < 3; i++)
    {
        digitalWrite(pin, HIGH);
        delay(250);
        digitalWrite(pin, LOW);
        delay(250);
    }
}

bool testarRC522()
{
    const byte versao = rfid.PCD_ReadRegister(MFRC522::VersionReg);

    Serial.print("RC522 VersionReg: 0x");
    if (versao < 0x10)
    {
        Serial.print("0");
    }
    Serial.println(versao, HEX);

    rfid.PCD_DumpVersionToSerial();

    // 0x00 e 0xFF normalmente indicam que nao houve comunicacao SPI valida.
    if (versao == 0x00 || versao == 0xFF)
    {
        return false;
    }

    rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);
    Serial.println("[OK] RC522 respondeu via SPI.");
    return true;
}

bool conectarWiFi()
{
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);

    Serial.print("Conectando ao Wi-Fi");

    for (int tentativa = 0; tentativa < 30; tentativa++)
    {
        if (WiFi.status() == WL_CONNECTED)
        {
            Serial.println();
            Serial.print("[OK] IP: ");
            Serial.println(WiFi.localIP());
            return true;
        }

        Serial.print(".");
        delay(500);
    }

    Serial.println();
    Serial.println("[FALHA] Nao foi possivel conectar ao Wi-Fi.");
    return false;
}

bool testarAPI()
{
    WiFiClient client;
    HTTPClient http;

    if (!http.begin(client, api_health))
    {
        Serial.println("[FALHA] Nao foi possivel iniciar HTTPClient para /health.");
        return false;
    }

    const int httpCode = http.GET();

    Serial.print("Health HTTP: ");
    Serial.println(httpCode);

    if (httpCode == 200)
    {
        Serial.println("[OK] Backend acessivel.");
        http.end();
        return true;
    }

    Serial.println("[FALHA] Backend nao respondeu com HTTP 200.");
    http.end();
    return false;
}

bool lerRFID(String &uid)
{
    if (!rfid.PICC_IsNewCardPresent())
    {
        return false;
    }

    if (!rfid.PICC_ReadCardSerial())
    {
        return false;
    }

    uid = "";
    for (byte i = 0; i < rfid.uid.size; i++)
    {
        char bloco[3];
        snprintf(bloco, sizeof(bloco), "%02X", rfid.uid.uidByte[i]);
        uid += bloco;
    }

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();

    return uid.length() > 0;
}

bool iniciarTentativaAcesso(const String &uid, String &tentativaId)
{
    WiFiClient client;
    HTTPClient http;

    if (!http.begin(client, api_verify_card))
    {
        Serial.println("[ERRO] Falha ao abrir endpoint verificar-cartao.");
        return false;
    }

    http.addHeader("Content-Type", "application/json");

    String payload =
        String("{\"uid_card\":\"") + uid +
        "\",\"identificador_dispositivo\":\"" +
        identificadorDispositivo + "\"}";

    Serial.print("POST ");
    Serial.println(api_verify_card);
    Serial.print("Payload: ");
    Serial.println(payload);

    const int httpCode = http.POST(payload);

    Serial.print("HTTP: ");
    Serial.println(httpCode);

    const String response = http.getString();

    if (httpCode != 200)
    {
        Serial.print("Resposta: ");
        Serial.println(response);
        http.end();
        return false;
    }

    tentativaId = extrairCampoJson(response, "tentativa_id");

    Serial.print("Resposta: ");
    Serial.println(response);

    http.end();
    return tentativaId.length() > 0;
}

String aguardarComandoFinal(const String &tentativaId)
{
    const unsigned long timeoutMs = 18000;
    const unsigned long inicio = millis();

    while (millis() - inicio < timeoutMs)
    {
        if (WiFi.status() != WL_CONNECTED)
        {
            return "erro_wifi";
        }

        WiFiClient client;
        HTTPClient http;

        const String url =
            String(api_resultado_acesso) +
            "?tentativa_id=" + tentativaId +
            "&identificador_dispositivo=" + identificadorDispositivo;

        if (!http.begin(client, url))
        {
            return "erro_http";
        }

        const int httpCode = http.GET();

        if (httpCode == 200)
        {
            const String response = http.getString();
            const String comando = extrairCampoJson(response, "comando");
            http.end();

            if (comando == "liberar" || comando == "negar")
            {
                return comando;
            }

            Serial.println("[POLL] aguardando biometria...");
            delay(350);
            continue;
        }

        Serial.print("[POLL] HTTP ");
        Serial.println(httpCode);
        http.end();
        delay(500);
    }

    return "timeout";
}

String extrairCampoJson(const String &json, const String &campo)
{
    const String chave = "\"" + campo + "\"";
    const int chavePos = json.indexOf(chave);

    if (chavePos < 0)
    {
        return "";
    }

    const int doisPontos = json.indexOf(':', chavePos + chave.length());
    if (doisPontos < 0)
    {
        return "";
    }

    int inicio = doisPontos + 1;
    while (
        inicio < json.length() &&
        (json[inicio] == ' ' || json[inicio] == '\t')
    )
    {
        inicio++;
    }

    if (inicio < json.length() && json[inicio] == '"')
    {
        inicio++;
        const int fim = json.indexOf('"', inicio);
        return fim >= 0 ? json.substring(inicio, fim) : "";
    }

    int fim = inicio;
    while (
        fim < json.length() &&
        json[fim] != ',' &&
        json[fim] != '}' &&
        json[fim] != '\n'
    )
    {
        fim++;
    }

    String valor = json.substring(inicio, fim);
    valor.trim();
    return valor;
}

void sinalizarElegivel()
{
    digitalWrite(LED_VERDE, HIGH);
    delay(180);
    digitalWrite(LED_VERDE, LOW);
}

void sinalizarAprovado()
{
    for (int i = 0; i < 3; i++)
    {
        digitalWrite(LED_VERDE, HIGH);
        delay(280);
        digitalWrite(LED_VERDE, LOW);
        delay(180);
    }
}

void sinalizarNegado()
{
    for (int i = 0; i < 3; i++)
    {
        digitalWrite(LED_VERMELHO, HIGH);
        delay(280);
        digitalWrite(LED_VERMELHO, LOW);
        delay(180);
    }
}
