import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CaptureStationService } from './capture-station.service';
import { WebcamService } from './webcam.service';
import { AuthService } from './auth.service';
import { WebSocketEventData, WebSocketLogsService } from './websocket-logs.service';

/** Preserva a tentativa recebida fora da tela de validação durante a navegação. */
@Injectable({ providedIn: 'root' })
export class RfidAccessService {
  private router = inject(Router);
  private captura = inject(CaptureStationService);
  private auth = inject(AuthService);
  private pending: WebSocketEventData | null = null;

  constructor() {
    // Prepara a IA sem solicitar câmera nem consumir o prazo de um cartão.
    void inject(WebcamService).carregarModelos().catch((erro) =>
      console.warn("Falha ao preparar os modelos faciais:", erro));
    inject(WebSocketLogsService).obterLogsEmTempoReal()
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((event) => {
        if (event.type === 'RFID_NEGADO') {
          this.pending = null;
          return;
        }
        if (event.data.cliente_id !== this.captura.clienteId) return;
        if (event.type !== 'RFID_APROVADO' || !event.data.tentativa_id || !this.auth.isLoggedIn()) return;
        if (this.router.url.split('?')[0] === '/validar-acesso') return;

        this.pending = event.data;
        void this.router.navigateByUrl('/validar-acesso');
      });
  }

  consumirTentativa(): WebSocketEventData | null {
    const pending = this.pending;
    this.pending = null;
    return pending;
  }
}
