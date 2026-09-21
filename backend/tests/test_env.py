import os
from dotenv import load_dotenv

# Carrega as variáveis do ficheiro .env
load_dotenv()

print("\n" + "="*50)
print("🔍 VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE (.env)")
print("="*50)

# Lista das chaves que queremos testar
chaves = [
    "ORT_INTRA_OP_THREADS",
    "ORT_INTER_OP_THREADS",
    "FACE_DET_SIZE",
    "FACE_SIMILARITY_THRESHOLD"
]

for chave in chaves:
    valor = os.getenv(chave)
    if valor is not None:
        print(f"✅ {chave}: {valor}")
    else:
        print(f"❌ {chave}: NÃO ENCONTRADA (Verifique o ficheiro .env)")

print("="*50 + "\n")