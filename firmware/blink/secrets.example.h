#pragma once

// Copie este arquivo para secrets.h e ajuste para o ambiente local.
// Não versione o secrets.h real.

#define WIFI_SSID "SUA_REDE"
#define WIFI_PASSWORD "SUA_SENHA"

// O firmware usa HTTPS para acessar o backend pelo dominio publico.
#define API_URL "https://ardlock.jangustavo.me"

// Deve corresponder exatamente a dispositivo.identificador no banco.
#define DEVICE_ID "ESP32-ENTRADA-01"

// Futuro: segredo HMAC exclusivo por dispositivo.
// #define DEVICE_SECRET "gere-um-segredo-aleatorio-longo"
