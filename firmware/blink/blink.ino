#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "NOME_DA_REDE"; // talvez usar .env, n sei dizer
const char* password = "SENHA_DA_REDE";

const char* api = "http://192.168.1.X:5000/access"; // mudar x pro ip real do pc

void setup() {
    delay(4000);
    Serial.begin(115200);

    //pinMode(4, OUTPUT);
    //digitalWrite(4, LOW);

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

    HTTPClient http;

    Serial.println("Criando requisicao...");

    if (!http.begin(api)) {
        Serial.println("ERRO: nao foi possivel iniciar HTTPClient");
        return;
    }

    http.addHeader("Content-Type", "application/json");

    String body = "{\"rfid\":\"123456789\"}";

    Serial.print("Enviando: ");
    Serial.println(body);

    int httpCode = http.POST(body);

    Serial.print("HTTP status: ");
    Serial.println(httpCode);

    if (httpCode > 0) {

        String response = http.getString();

        Serial.print("Resposta da API: ");
        Serial.println(response);

        if (response.indexOf("\"veredito\":1") >= 0) {

            Serial.println("ACESSO LIBERADO!");

            digitalWrite(4, HIGH);
            delay(500);
            digitalWrite(4, LOW);

        } else {
            Serial.println("ACESSO NEGADO!");

        }

    } else {

        Serial.print("Erro HTTP: ");
        Serial.println(http.errorToString(httpCode));

    }

    http.end();

    Serial.println();
    Serial.println("Teste finalizado");
}

void loop() {
}
