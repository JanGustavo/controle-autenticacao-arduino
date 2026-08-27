# Backend — Controle de Acesso com IA

Monólito modular em Python (FastAPI). Sem microserviços, sem broker de eventos —
comunicação síncrona via HTTP/REST.

## Como rodar (Etapa 1)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload
```

Acesse: http://localhost:8000/api/health → deve responder `{"status": "ok"}`.

Documentação automática (Swagger): http://localhost:8000/docs

## Rodar os testes

```bash
pytest
```

## Roteiro de etapas (não pular fases)

1. **FastAPI funcionando** — `/api/health` respondendo (você está aqui).
2. Estrutura modular consolidada (api / services / models / schemas / database / core).
3. PostgreSQL + SQLAlchemy conectados.
4. CRUD de usuários (com dados reais no banco).
5. Endpoint `/api/verificar-cartao` (RFID → usuário).
6. Captura da webcam (`camera_service.py`).
7. InsightFace → geração de embedding (`face_service.py`).
8. Comparação 1:1 do embedding com o cadastrado.
9. Regra de autorização (horário + status) em `access_service.py`.
10. Integração real com o ESP32.
11. Integração com o painel Angular.

Cada etapa só começa depois da anterior estar testada e funcionando.
