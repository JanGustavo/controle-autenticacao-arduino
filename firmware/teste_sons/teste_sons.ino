#include <Arduino.h>

// Mesmos pinos da aplicacao; teste independente sem RFID, Wi-Fi ou servo.
constexpr uint8_t LED_VERDE = 4;
constexpr uint8_t LED_VERMELHO = 16;
constexpr uint8_t BUZZER_PIN = 2;
constexpr unsigned long BIP_MS = 1500;
constexpr unsigned long PAUSA_MS = 150;

void emitirPadrao(uint8_t led, int quantidade) {
  for (int i = 0; i < quantidade; ++i) {
    digitalWrite(led, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(BIP_MS);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(led, LOW);
    delay(PAUSA_MS);
  }
}

void setup() {
  Serial.begin(115200);
  digitalWrite(BUZZER_PIN, LOW);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_VERMELHO, OUTPUT);
  digitalWrite(LED_VERDE, LOW);
  digitalWrite(LED_VERMELHO, LOW);
  Serial.println("Teste de padroes: buzzer ativo no GPIO 2.");
  delay(1000);
}

void loop() {
  Serial.println("APROVADO: dois bipes de 500 ms / LED verde.");
  digitalWrite(LED_VERDE, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(500);
  digitalWrite(BUZZER_PIN, LOW);
  delay(250);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(500);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_VERDE, LOW);
  delay(2500);

  Serial.println("RECUSADO: tres bipes / LED vermelho.");
  emitirPadrao(LED_VERMELHO, 3);
  Serial.println("AGUARDANDO: silencio por quatro segundos.");
  delay(4000);
}
