#include <SPI.h>
#include <MFRC522.h>

// Smoke test de bancada do ArdLock.
// Escopo intencional:
//   - LEDs
//   - barramento SPI
//   - leitor RC522
//   - leitura do UID
//
// Buzzer e servo NAO sao inicializados neste sketch.
// O objetivo e validar primeiro a parte de baixo consumo sem introduzir
// carga adicional ou risco eletrico durante o diagnostico.

#define LED_VERDE 4
#define LED_VERMELHO 16

#define SS_PIN 14
#define RST_PIN 27
#define SPI_SCK 33
#define SPI_MISO 34
#define SPI_MOSI 32

// Falha na compilacao se o mapa tiver colisao entre pinos usados neste teste.
static_assert(LED_VERDE != LED_VERMELHO, "LEDs nao podem compartilhar GPIO.");
static_assert(SS_PIN != RST_PIN, "SS e RST do RC522 nao podem compartilhar GPIO.");
static_assert(SPI_SCK != SPI_MISO && SPI_SCK != SPI_MOSI && SPI_MISO != SPI_MOSI,
              "SCK, MISO e MOSI precisam usar GPIOs distintos.");
static_assert(LED_VERDE != SS_PIN && LED_VERDE != RST_PIN &&
              LED_VERDE != SPI_SCK && LED_VERDE != SPI_MISO && LED_VERDE != SPI_MOSI,
              "LED verde conflita com um pino do RC522.");
static_assert(LED_VERMELHO != SS_PIN && LED_VERMELHO != RST_PIN &&
              LED_VERMELHO != SPI_SCK && LED_VERMELHO != SPI_MISO && LED_VERMELHO != SPI_MOSI,
              "LED vermelho conflita com um pino do RC522.");

MFRC522 rfid(SS_PIN, RST_PIN);

bool rfidDisponivel = false;
unsigned long leiturasOk = 0;

void piscarLed(int pino, int vezes, int ligadoMs = 180, int desligadoMs = 120)
{
    for (int i = 0; i < vezes; i++)
    {
        digitalWrite(pino, HIGH);
        delay(ligadoMs);
        digitalWrite(pino, LOW);
        delay(desligadoMs);
    }
}

void desligarLeds()
{
    digitalWrite(LED_VERDE, LOW);
    digitalWrite(LED_VERMELHO, LOW);
}

void imprimirMapaPinos()
{
    Serial.println();
    Serial.println("=== MAPA DE PINOS ESPERADO ===");
    Serial.printf("LED_VERDE    -> GPIO %d\n", LED_VERDE);
    Serial.printf("LED_VERMELHO -> GPIO %d\n", LED_VERMELHO);
    Serial.printf("RC522 SS/SDA -> GPIO %d\n", SS_PIN);
    Serial.printf("RC522 RST    -> GPIO %d\n", RST_PIN);
    Serial.printf("RC522 SCK    -> GPIO %d\n", SPI_SCK);
    Serial.printf("RC522 MISO   -> GPIO %d\n", SPI_MISO);
    Serial.printf("RC522 MOSI   -> GPIO %d\n", SPI_MOSI);
    Serial.println("==============================");
}

bool testarRc522()
{
    Serial.println();
    Serial.println("[RFID] Inicializando SPI + RC522...");

    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SS_PIN);
    rfid.PCD_Init();
    delay(120);

    byte versao = rfid.PCD_ReadRegister(MFRC522::VersionReg);

    Serial.print("[RFID] VersionReg = 0x");
    if (versao < 0x10)
    {
        Serial.print("0");
    }
    Serial.println(versao, HEX);

    // Valores tipicos documentados para chips MFRC522:
    // 0x91 = v1.0
    // 0x92 = v2.0
    // 0x88 = clone comum
    // 0x00 / 0xFF normalmente indicam falha de comunicacao/alimentacao.
    if (versao == 0x00 || versao == 0xFF)
    {
        Serial.println("[FALHA] RC522 nao respondeu corretamente.");
        Serial.println("Verifique 3.3V, GND, SS/SDA, RST, SCK, MISO e MOSI.");
        piscarLed(LED_VERMELHO, 5, 120, 120);
        return false;
    }

    Serial.println("[OK] RC522 respondeu no barramento SPI.");
    rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);
    piscarLed(LED_VERDE, 2);
    return true;
}

String uidParaString()
{
    String uid;
    uid.reserve(rfid.uid.size * 2);

    for (byte i = 0; i < rfid.uid.size; i++)
    {
        if (rfid.uid.uidByte[i] < 0x10)
        {
            uid += "0";
        }
        uid += String(rfid.uid.uidByte[i], HEX);
    }

    uid.toUpperCase();
    return uid;
}

void imprimirMenu()
{
    Serial.println();
    Serial.println("=== COMANDOS ===");
    Serial.println("g -> testar LED verde");
    Serial.println("r -> testar LED vermelho");
    Serial.println("l -> testar os dois LEDs");
    Serial.println("c -> testar comunicacao com RC522 novamente");
    Serial.println("p -> imprimir mapa de pinos");
    Serial.println("s -> mostrar status");
    Serial.println("================");
    Serial.println("Aproxime um cartao para testar leitura RFID.");
}

void processarComandoSerial(char comando)
{
    switch (comando)
    {
    case 'g':
    case 'G':
        Serial.println("[TESTE] LED verde");
        piscarLed(LED_VERDE, 3);
        break;

    case 'r':
    case 'R':
        Serial.println("[TESTE] LED vermelho");
        piscarLed(LED_VERMELHO, 3);
        break;

    case 'l':
    case 'L':
        Serial.println("[TESTE] LEDs");
        piscarLed(LED_VERDE, 2);
        piscarLed(LED_VERMELHO, 2);
        break;

    case 'c':
    case 'C':
        rfidDisponivel = testarRc522();
        break;

    case 'p':
    case 'P':
        imprimirMapaPinos();
        break;

    case 's':
    case 'S':
        Serial.println();
        Serial.println("=== STATUS ===");
        Serial.printf("RC522: %s\n", rfidDisponivel ? "OK" : "FALHA");
        Serial.printf("Cartoes lidos com sucesso: %lu\n", leiturasOk);
        Serial.println("Buzzer: NAO TESTADO / NAO ENERGIZADO");
        Serial.println("Servo: NAO TESTADO / NAO ENERGIZADO");
        Serial.println("==============");
        break;

    default:
        break;
    }
}

void setup()
{
    Serial.begin(115200);
    delay(800);

    pinMode(LED_VERDE, OUTPUT);
    pinMode(LED_VERMELHO, OUTPUT);
    desligarLeds();

    Serial.println();
    Serial.println("==========================================");
    Serial.println(" ArdLock - Smoke Test RFID + LEDs");
    Serial.println("==========================================");
    Serial.println("Buzzer e servo ficam FORA deste teste.");

    imprimirMapaPinos();

    Serial.println();
    Serial.println("[LED] Teste de inicializacao...");
    Serial.println("Esperado: verde pisca 2x; depois vermelho pisca 2x.");
    piscarLed(LED_VERDE, 2);
    piscarLed(LED_VERMELHO, 2);

    rfidDisponivel = testarRc522();

    imprimirMenu();
}

void loop()
{
    while (Serial.available() > 0)
    {
        processarComandoSerial((char)Serial.read());
    }

    if (!rfidDisponivel)
    {
        delay(100);
        return;
    }

    if (!rfid.PICC_IsNewCardPresent())
    {
        delay(30);
        return;
    }

    if (!rfid.PICC_ReadCardSerial())
    {
        Serial.println("[FALHA] Cartao detectado, mas UID nao pode ser lido.");
        piscarLed(LED_VERMELHO, 2);
        delay(250);
        return;
    }

    String uid = uidParaString();
    leiturasOk++;

    Serial.println();
    Serial.println("[OK] Cartao RFID lido.");
    Serial.print("UID: ");
    Serial.println(uid);
    Serial.print("Tamanho do UID: ");
    Serial.print(rfid.uid.size);
    Serial.println(" bytes");

    // Apenas confirma que a leitura fisica funcionou.
    // Nao consulta backend e nao representa autorizacao de acesso.
    piscarLed(LED_VERDE, 1, 350, 100);

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();

    delay(700);
}
