#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
// isso aqui e tipo o .env do python
#include <secrets.h>

#define LED_VERDE 26
#define LED_VERMELHO 27

Servo servo;

// essas vars estao dentro do .h acima
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char* api_health = API_URL "/api/v1/health/health";

void setup() {    
    // configs iniciais
    pinMode(27, OUTPUT);
    pinMode(26, OUTPUT);

    Serial.begin(115200);
    servo.attach(13);
    servo.write(0);

    // Testes (Somente durante dev, sera removido na versao release)

    // teste dos leds
    testLed(LED_VERDE);
    testLed(LED_VERMELHO);

    delay(500);

    // teste do servo
    testServo(servo);
    delay(500);

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
    
    Serial.println("Criando requisicao...");
    HTTPClient http;

    if (!http.begin(api_health)) {
        Serial.println("ERRO: nao foi possivel iniciar HTTPClient");
        return;
    }
        
    int httpCode = http.GET();
    Serial.print("HTTP status: ");
    Serial.println(httpCode);
    
    if (httpCode == 200) {
        String response = http.getString();
        
        Serial.print("API viva.");        
        Serial.print("Resposta da API: ");        
        Serial.println(response);

    } else {
        Serial.print("API morta.");        
        Serial.print("Erro HTTP: ");
        Serial.println(http.errorToString(httpCode));
    }
    
    http.end();
}

void loop() {
}

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

void testServo(Servo servo) {
    delay(300);
    servo.write(90);
    delay(300);
    servo.write(0);

}

// // void justOn(TipoLed led) {
// //     if (led == L_AMARELO) {
// //         digitalWrite(LED_VERDE, LOW);
// //         digitalWrite(LED_VERMELHO, LOW);

// //         digitalWrite(LED_AMARELO, HIGH);
// //     } else if (led == L_VERDE) {
// //         digitalWrite(LED_AMARELO, LOW);
// //         digitalWrite(LED_VERMELHO, LOW);
        
// //         digitalWrite(LED_VERDE, HIGH);
// //     } else {
// //         digitalWrite(LED_VERDE, LOW);
// //         digitalWrite(LED_AMARELO, LOW);
        
// //         digitalWrite(LED_VERMELHO, HIGH);
// //     }
// // }

// void downAll() {
//     digitalWrite(LED_VERDE, LOW);
//     digitalWrite(LED_VERMELHO, LOW);
//     digitalWrite(LED_AMARELO, LOW);
