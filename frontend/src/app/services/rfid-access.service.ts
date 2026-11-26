import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CaptureStationService } from './capture-station.service';
import { WebcamService } from './webcam.service';
import { AuthService } from './auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OperacaoRfidService } from './operacao-rfid.service';
import { WebSocketEventData, WebSocketLogsService } from './websocket-logs.service';

/** Preserva a tentativa recebida fora da tela de validação durante a navegação. */
@Injectable({ providedIn: 'root' })
export class RfidAccessService {
  private router = inject(Router);
  private captura = inject(CaptureStationService);
  private auth = inject(AuthService);
  private operacoes = inject(OperacaoRfidService);
  private snackBar = inject(MatSnackBar);
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
        // Um cadastro aberto é a operação ativa deste aparelho: abrir a
        // validação por baixo do diálogo ligaria duas câmeras ao mesmo tempo.
        if (this.operacoes.sessaoAberta) {
          const quem = event.data.nome_usuario || 'um cartão';
          const leitor = event.data.identificador_dispositivo;
          this.snackBar.open(
            `Leitura de ${quem}${leitor ? ` no leitor ${leitor}` : ''} não abriu a validação facial: ` +
              'há um cadastro aberto neste aparelho.',
            'Fechar',
            { duration: 6000 },
          );
          return;
        }

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
