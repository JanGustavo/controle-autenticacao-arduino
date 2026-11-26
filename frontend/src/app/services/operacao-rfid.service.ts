import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { WebSocketLogsService } from './websocket-logs.service';

interface CapturaCartao {
  id: string;
  identificador: string;
  aoLer: (uid: string) => void;
  aoExpirar: () => void;
}

const normalizar = (valor: string | null | undefined) => (valor ?? '').trim().toUpperCase();

/**
 * Ponto único que decide o que uma leitura RFID significa neste aparelho.
 *
 * O cartão só informa qual UID foi aproximado. A finalidade vem da operação
 * ativa: sem operação, nada é preenchido; com CAPTURA_CARTAO, o UID vai
 * apenas para a tela que pediu (mesmo operacao_id), uma única vez.
 *
 * Enquanto um cadastro ou edição de usuário estiver aberto (sessão), este
 * aparelho não é levado para a validação facial por leituras do leitor.
 */
@Injectable({ providedIn: 'root' })
export class OperacaoRfidService {
  private api = inject(ApiService);
  private captura: CapturaCartao | null = null;
  private contagem: ReturnType<typeof setInterval> | null = null;
  private expiraEm = 0;
  private sessoes = 0;

  readonly capturando = signal(false);
  readonly segundosRestantes = signal(0);

  constructor() {
    inject(WebSocketLogsService)
      .obterLogsEmTempoReal()
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((evento) => {
        const captura = this.captura;
        if (evento.type !== 'RFID_LIDO' || !captura || !evento.data.uid_card) return;
        // Leituras sem operacao_id são tentativas de acesso, nunca preenchimento.
        if (evento.data.operacao_id !== captura.id) return;
        const leitor = normalizar(evento.data.identificador_dispositivo);
        if (leitor && leitor !== normalizar(captura.identificador)) return;
        this.encerrar();
        captura.aoLer(evento.data.uid_card);
      });
  }

  /** Há um cadastro ou edição de usuário aberto neste aparelho. */
  get sessaoAberta(): boolean {
    return this.sessoes > 0;
  }

  /** Marca uma tela de cadastro aberta. Chame a função devolvida ao fechar. */
  abrirSessao(): () => void {
    this.sessoes++;
    let aberta = true;
    return () => {
      if (!aberta) return;
      aberta = false;
      this.sessoes = Math.max(0, this.sessoes - 1);
    };
  }

  /**
   * Reserva o leitor para capturar um UID. Rejeita se o servidor não confirmar;
   * nesse caso nada fica aguardando e a leitura seguiria como acesso comum.
   */
  async capturarCartao(
    identificador: string,
    aoLer: (uid: string) => void,
    aoExpirar: () => void,
  ): Promise<void> {
    this.cancelarCaptura();
    const captura: CapturaCartao = { id: crypto.randomUUID(), identificador, aoLer, aoExpirar };
    this.captura = captura;
    this.capturando.set(true);
    this.segundosRestantes.set(0);
    try {
      const reserva = await firstValueFrom(this.api.reservarCapturaCartao(identificador, captura.id));
      if (this.captura !== captura) return;
      this.iniciarContagem(reserva.expira_em_segundos);
    } catch (erro) {
      if (this.captura === captura) this.encerrar();
      throw erro;
    }
  }

  /** Cancela a captura em andamento e devolve o leitor ao modo de acesso. */
  cancelarCaptura(): void {
    const captura = this.captura;
    if (!captura) return;
    this.encerrar();
    this.api.cancelarCapturaCartao(captura.identificador, captura.id).subscribe({ error: () => undefined });
  }

  private iniciarContagem(segundos: number): void {
    this.expiraEm = Date.now() + segundos * 1000;
    this.segundosRestantes.set(segundos);
    this.contagem = setInterval(() => {
      const restante = Math.max(0, Math.ceil((this.expiraEm - Date.now()) / 1000));
      this.segundosRestantes.set(restante);
      if (restante > 0) return;
      const captura = this.captura;
      this.encerrar();
      captura?.aoExpirar();
    }, 1000);
  }

  private encerrar(): void {
    if (this.contagem) clearInterval(this.contagem);
    this.contagem = null;
    this.captura = null;
    this.capturando.set(false);
    this.segundosRestantes.set(0);
  }
}
