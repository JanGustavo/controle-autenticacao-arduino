#include <WiFi.h>
#include <HTTPClient.h>

// isso aqui e tipo o .env do python
#include <secrets.h>

#define LED_VERDE 4
#define LED_VERMELHO 16
#define LED_AMARELO 2

enum TipoLed {
    L_AMARELO, 
    L_VERDE, 
    L_VERMELHO
};

// essas vars estao dentro do .h acima
const char* ssid = WIFI_SSID; // talvez usar .env, n sei dizer
const char* password = WIFI_PASSWORD;

const char* api = API_URL;

void setup() {
    //delay(5000); // pra dar tempo abrir o monitor do esp

    // led de debug
    pinMode(LED_VERDE, OUTPUT);
    pinMode(LED_AMARELO, OUTPUT);
    pinMode(LED_VERMELHO, OUTPUT);
    
    Serial.begin(115200);

    // Conecta ao Wi-Fi
    WiFi.begin(ssid, password);

    Serial.print("Conectando ao Wi-Fi");

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println();
    Serial.println("Wi-Fi conectado!");

    Serial.print("IP do ESP32: ");
    Serial.println(WiFi.localIP());

    // Teste da API
    Serial.println();
    Serial.println("Teste da API");

    while (1) {
        HTTPClient http;

        Serial.println("Criando requisicao...");

        if (!http.begin(api)) {
            Serial.println("ERRO: nao foi possivel iniciar HTTPClient");
            return;
        }
        
        downAll();
        justOn(L_AMARELO);
        int httpCode = http.GET();
        downAll();

        Serial.print("HTTP status: ");
        Serial.println(httpCode);
        
        if (httpCode > 0) {
            String response = http.getString();
            
            downAll();
            justOn(L_VERDE);
            Serial.print("Resposta da API: ");
            
            Serial.println(response);
            
        } else {
            downAll();
            justOn(L_VERMELHO);
            Serial.print("Erro HTTP: ");
            
            Serial.println(http.errorToString(httpCode));
        }
        
        http.end();
        delay(2000);
    }
}

void loop() {
}

void justOn(TipoLed led) {
    if (led == L_AMARELO) {
        digitalWrite(LED_VERDE, LOW);
        digitalWrite(LED_VERMELHO, LOW);

        digitalWrite(LED_AMARELO, HIGH);
    } else if (led == L_VERDE) {
        digitalWrite(LED_AMARELO, LOW);
        digitalWrite(LED_VERMELHO, LOW);
        
        digitalWrite(LED_VERDE, HIGH);
    } else {
        digitalWrite(LED_VERDE, LOW);
        digitalWrite(LED_AMARELO, LOW);
        
        digitalWrite(LED_VERMELHO, HIGH);
    }
}

void downAll() {
    digitalWrite(LED_VERDE, LOW);
    digitalWrite(LED_VERMELHO, LOW);
    digitalWrite(LED_AMARELO, LOW);
}