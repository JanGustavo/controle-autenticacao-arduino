#include <Arduino.h>

// Mesmos pinos do firmware principal.
constexpr uint8_t LED_VERDE = 4;
constexpr uint8_t LED_VERMELHO = 16;
constexpr uint8_t BUZZER_PIN = 2;

// Buzzer ativo: HIGH liga, LOW desliga. Nao usa tone().
// GPIO 2 deve chegar a I8, compartilhando o grupo com o positivo em J8.
// B2 e endereco da protoboard: confirme que esta ligado ao D2 do ESP32.
constexpr unsigned long INTERVALO_MS = 1000;

void setup() {
  Serial.begin(115200);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_VERMELHO, OUTPUT);
  digitalWrite(LED_VERDE, LOW);
  digitalWrite(LED_VERMELHO, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.println("Teste separado: sem Wi-Fi, RFID ou servo.");
  Serial.println("GPIO 2: 1 segundo ligado, 1 segundo desligado, continuamente.");
}

void loop() {
  Serial.println("Verde aceso / buzzer ligado.");
  digitalWrite(LED_VERMELHO, LOW);
  digitalWrite(LED_VERDE, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(INTERVALO_MS);

  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_VERDE, LOW);
  digitalWrite(LED_VERMELHO, HIGH);
  Serial.println("Vermelho aceso / buzzer desligado.");
  delay(INTERVALO_MS);
}
