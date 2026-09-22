import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface WebSocketEventData {
  id?: number | null;
  usuario_id?: number | null;
  nome_usuario?: string | null;
  local_id?: number | null;
  data_hora?: string | null;
  autorizado?: boolean | null;
  percentual_similaridade?: number | null;
  motivo_recusa?: string | null;
  uid_card?: string | null;
  identificador_dispositivo?: string | null;
  tentativa_id?: string | null;
  motivo?: string | null;
}

export interface WebSocketLogEvent {
  type: string;
  data: WebSocketEventData;
}

/**
 * Serviço responsável por manter uma conexão permanente bidirecional
 * em tempo real via WebSocket com o servidor FastAPI.
 */
@Injectable({ providedIn: 'root' })
export class WebSocketLogsService {
  private socket: WebSocket | null = null;
  private logSubject = new Subject<WebSocketLogEvent>();

  public conectado = signal(false);

  constructor() {
    this.conectar();
  }

  conectar(): void {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//localhost:8001/ws/logs`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('⚡ [WebSocket] Conectado ao servidor de logs em tempo real.');
        this.conectado.set(true);
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed: WebSocketLogEvent = JSON.parse(event.data);
          this.logSubject.next(parsed);
        } catch (e) {
          console.warn('[WebSocket] Erro ao parsear mensagem recebida:', e);
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[WebSocket] Erro na conexão:', err);
        this.conectado.set(false);
      };

      this.socket.onclose = () => {
        console.log('⚡ [WebSocket] Conexão encerrada. Tentando reconectar em 5s...');
        this.conectado.set(false);
        setTimeout(() => this.conectar(), 5000);
      };
    } catch (e) {
      console.warn('[WebSocket] Falha ao instanciar WebSocket:', e);
      setTimeout(() => this.conectar(), 5000);
    }
  }

  obterLogsEmTempoReal(): Observable<WebSocketLogEvent> {
    return this.logSubject.asObservable();
  }
}
