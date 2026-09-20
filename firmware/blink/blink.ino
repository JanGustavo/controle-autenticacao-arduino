#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
#include <secrets.h>

// Configuração dos pinos

#define LED_VERDE 4
#define LED_VERMELHO 16

#define SERVO_PIN 13

#define SS_PIN 14
#define RST_PIN 27

#define SPI_SCK 33
#define SPI_MISO 34
#define SPI_MOSI 32

// Objetos e configurações

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char* api_health = API_URL "/api/v1/health";

MFRC522 rfid(SS_PIN, RST_PIN);
Servo servo;

// Declaração das funções

void testLed(int led);
void testarWiFi();
void testarAPI();
void inicializarRFID();
int lerRFID();
void abrirAcesso();

// Setup

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.println("Inicializando sistema...");

    // Inicialização dos LEDs
    pinMode(LED_VERDE, OUTPUT);
    pinMode(LED_VERMELHO, OUTPUT);

    // Teste dos LEDs
    Serial.println();
    Serial.println("Testando LED verde...");
    testLed(LED_VERDE);

    Serial.println("Testando LED vermelho...");
    testLed(LED_VERMELHO);

    // Inicialização do servo
    Serial.println();
    Serial.println("Inicializando servo...");

    servo.setPeriodHertz(50);

    if (servo.attach(SERVO_PIN, 500, 2400)) {
        servo.write(0);
        Serial.println("Servo inicializado.");
    } else {
        Serial.println("ERRO: nao foi possivel inicializar o servo.");
    }

    delay(500);

    // Teste do Wi-Fi
    testarWiFi();

    // Teste da API
    if (WiFi.status() == WL_CONNECTED) {
        testarAPI();
    } else {
        Serial.println("API nao testada: Wi-Fi indisponivel.");
    }

    // Inicialização do RFID
    inicializarRFID();

    Serial.println();
    Serial.println("Sistema pronto!");
    Serial.println("Aproxime um cartao RFID...");
}

// Loop principal

void loop() {
    int leu = lerRFID();

    if (leu) {
        abrirAcesso();
    }
}

// Teste dos LEDs

void testLed(int led) {
    digitalWrite(led, HIGH);
    delay(300);

    digitalWrite(led, LOW);
    delay(300);

    digitalWrite(led, HIGH);
    delay(300);

    digitalWrite(led, LOW);
    delay(300);
}

// Conexão Wi-Fi

void testarWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);

    Serial.print("Conectando ao Wi-Fi");

    int tentativas = 0;

    while (WiFi.status() != WL_CONNECTED && tentativas < 30) {
        delay(500);
        Serial.print(".");
        tentativas++;
    }

    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("Wi-Fi conectado!");

        Serial.print("IP do ESP32: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("Falha ao conectar ao Wi-Fi.");
        Serial.printf("Status: %d\n", WiFi.status());
    }
}

// Teste da API

void testarAPI() {
    Serial.println();
    Serial.println("Teste da API");
    Serial.println("Criando requisicao...");

    WiFiClient client;
    HTTPClient http;

    if (!http.begin(client, api_health)) {
        Serial.println("ERRO: nao foi possivel iniciar HTTPClient");
        return;
    }

    int httpCode = http.GET();

    Serial.print("HTTP status: ");
    Serial.println(httpCode);

    if (httpCode == 200) {
        String response = http.getString();

        Serial.println("API viva.");
        Serial.print("Resposta da API: ");
        Serial.println(response);
    } else {
        Serial.println("API inacessivel.");
        Serial.print("Erro HTTP: ");
        Serial.println(http.errorToString(httpCode));
    }

    http.end();
}

// Inicialização do RC522

void inicializarRFID() {
    Serial.println();
    Serial.println("Iniciando RC522...");

    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SS_PIN);

    rfid.PCD_Init();

    delay(100);

    rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);

    rfid.PCD_DumpVersionToSerial();

    Serial.println("RC522 pronto.");
}

// Leitura do RFID

int lerRFID() {
    if (!rfid.PICC_IsNewCardPresent()) {
        delay(100);
        return 0;
    }

    if (!rfid.PICC_ReadCardSerial()) {
        delay(100);
        return 0;
    }

    Serial.println();
    Serial.println("Cartao detectado!");

    Serial.print("UID: ");

    for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) {
            Serial.print("0");
        }

        Serial.print(rfid.uid.uidByte[i], HEX);

        if (i < rfid.uid.size - 1) {
            Serial.print(":");
        }
    }

    Serial.println();

    MFRC522::PICC_Type tipo =
        rfid.PICC_GetType(rfid.uid.sak);

    Serial.print("Tipo: ");
    Serial.println(rfid.PICC_GetTypeName(tipo));

    Serial.println("-------------------------");

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();

    delay(1000);

    return 1;
}

// Abertura do acesso

void abrirAcesso() {
    Serial.println();
    Serial.println("Acesso autorizado!");
    Serial.println("Abrindo porta...");

    digitalWrite(LED_VERDE, HIGH);
    digitalWrite(LED_VERMELHO, LOW);

    // Abre o servo
    servo.write(90);

    delay(3000);

    Serial.println("Fechando porta...");

    // Fecha o servo
    servo.write(0);

    digitalWrite(LED_VERDE, LOW);

    delay(1000);

    Serial.println("Acesso finalizado.");
}