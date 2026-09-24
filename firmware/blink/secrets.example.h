#pragma once

// Copie este arquivo para secrets.h e ajuste para o ambiente local.
// Não versione o secrets.h real.

#define WIFI_SSID "SUA_REDE"
#define WIFI_PASSWORD "SUA_SENHA"

// Exemplo: http://192.168.0.10:8001
#define API_URL "http://IP_DO_BACKEND:8001"

// Deve corresponder exatamente a dispositivo.identificador no banco.
#define DEVICE_ID "ESP32-ENTRADA-01"

// Futuro: segredo HMAC exclusivo por dispositivo.
// #define DEVICE_SECRET "gere-um-segredo-aleatorio-longo"
