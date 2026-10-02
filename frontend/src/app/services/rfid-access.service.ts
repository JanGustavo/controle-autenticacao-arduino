import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { WebSocketEventData, WebSocketLogsService } from './websocket-logs.service';

/** Preserva a tentativa recebida fora da tela de validação durante a navegação. */
@Injectable({ providedIn: 'root' })
export class RfidAccessService {
  private router = inject(Router);
  private auth = inject(AuthService);
  private pending: WebSocketEventData | null = null;

  constructor() {
    inject(WebSocketLogsService).obterLogsEmTempoReal()
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((event) => {
        if (event.type === 'RFID_NEGADO') {
          this.pending = null;
          return;
        }
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
