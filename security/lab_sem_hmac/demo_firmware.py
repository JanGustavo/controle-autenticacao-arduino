"""Executa funções reais do firmware com Arduino/rede substituídos por stubs.

Resposta forjada somente em memória. Nenhuma rede ou hardware é acessado.
Requer Python 3 e g++; funciona no Pop!_OS ou Kali.
"""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
source = (root / "firmware/blink/blink.ino").read_text()
parser = source.split("String extrairCampoJson(const String &json, const String &campo)\n{", 1)[1].split("bool iniciarTentativaAcesso(", 1)[0]
parser = "String extrairCampoJson(const String &json, const String &campo)\n{" + parser
poll = source.split("bool aguardarDecisaoAcesso(const String &tentativaId)\n{", 1)[1].split("// Teste da API", 1)[0]
poll = "bool aguardarDecisaoAcesso(const String &tentativaId)\n{" + poll

stubs = r'''
#include <string>
#include <iostream>
#include <cstdlib>
class String : public std::string {
public:
  using std::string::string;
  String(const std::string& value): std::string(value) {}
  int indexOf(const std::string& value, int start=0) const { auto pos=find(value,start); return pos==npos?-1:static_cast<int>(pos); }
  int indexOf(char value, int start=0) const { auto pos=find(value,start); return pos==npos?-1:static_cast<int>(pos); }
  String substring(int start, int end) const { return substr(start,end-start); }
  void trim() { auto first=find_first_not_of(" \t\r\n"); auto last=find_last_not_of(" \t\r\n"); *this=first==npos?String(""):String(substr(first,last-first+1)); }
};
struct SerialStub {
  template<class T> void print(T) {}
  template<class T> void println(T) {}
} Serial;
constexpr int WL_CONNECTED=3;
struct WiFiStub { int status() { return WL_CONNECTED; } } WiFi;
struct WiFiClient {};
String resposta;
struct HTTPClient {
  bool begin(WiFiClient&, const String&) { return true; }
  int GET() { return 200; }
  String getString() { return resposta; }
  void end() {}
};
unsigned long relogio=0;
unsigned long millis() { return relogio++; }
void delay(unsigned long value) { relogio+=value; }
const char* api_resultado_acesso="http://servidor-ficticio/resultado";
const char* identificadorDispositivo="ESP32-LAB-FICTICIO";
'''
main = r'''
int main() {
  resposta="{\"comando\":\"negar\"}";
  if (aguardarDecisaoAcesso("tentativa-ficticia")) return 1;
  std::cout << "Resposta negar: porta virtual permanece fechada.\n";
  resposta="{\"comando\":\"liberar\"}";
  if (!aguardarDecisaoAcesso("tentativa-ficticia")) return 2;
  std::cout << "Resposta forjada liberar, sem assinatura: firmware retorna TRUE (abertura virtual).\n";
  std::cout << "Nenhum servo, ESP32, rede ou banco real foi acessado.\n";
}
'''
with tempfile.TemporaryDirectory(prefix="ardlock-lab-") as directory:
    path = Path(directory)
    (path / "demo.cpp").write_text(stubs + parser + poll + main)
    subprocess.run(["g++", "-std=c++17", str(path / "demo.cpp"), "-o", str(path / "demo")], check=True)
    subprocess.run([str(path / "demo")], check=True)
