#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "SEU_WIFI";
const char* password = "SUA_SENHA";

const char* api = "http://192.168.1.X:5000/access";

void setup() {
    Serial.begin(115200);

    pinMode(4, OUTPUT);
    digitalWrite(4, LOW);

    WiFi.begin(ssid, password);

    Serial.print("Conectando ao Wi-Fi...");

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println();
    Serial.println("Wi-Fi conectado!");
    Serial.print("IP do ESP32: ");
    Serial.println(WiFi.localIP());

    // Teste da API
    HTTPClient http;

    Serial.println("Enviando requisicao para API...");

    http.begin(api);
    http.addHeader("Content-Type", "application/json");

    String body = "{\"rfid\":\"123456789\"}";

    int httpCode = http.POST(body);

    Serial.print("HTTP status: ");
    Serial.println(httpCode);

    if (httpCode > 0) {
        String response = http.getString();

        Serial.print("Resposta: ");
        Serial.println(response);

        if (response.indexOf("\"veredito\":1") >= 0) {
            Serial.println("ACESSO LIBERADO!");

            digitalWrite(4, HIGH);
            delay(500);
            digitalWrite(4, LOW);
        }
        else {
            Serial.println("ACESSO NEGADO!");
        }
    }
    else {
        Serial.print("Erro HTTP: ");
        Serial.println(http.errorToString(httpCode));
    }

    http.end();
}

void loop() {
}
