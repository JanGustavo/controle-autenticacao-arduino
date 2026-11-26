import {
  Component,
  effect,
  untracked,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  ApiService,
  DispositivoSimplesResponse,
  HistoricoAcessoResponse,
  LocalResponse,
  UsuarioSimplesResponse,
} from '../../services/api.service';
import { SpeechService } from '../../services/speech.service';
import { VisorFacial } from '../../components/visor-facial/visor-facial';
import { WebcamService } from '../../services/webcam.service';
import { WebSocketLogsService } from '../../services/websocket-logs.service';
import { CaptureStationService } from '../../services/capture-station.service';
import { RfidAccessService } from '../../services/rfid-access.service';

@Component({
  selector: 'app-comparar-page',
  standalone: true,
  imports: [
    CommonModule,
    VisorFacial,
    FormsModule,
    MatIconModule,
    CdkTrapFocus,
    MatSnackBarModule,
    RouterLink,
  ],
  templateUrl: './comparar.html',
  styleUrl: './comparar.scss',
})
export class CompararPage implements OnInit, OnDestroy {
  private api = inject(ApiService);
  public captura = inject(CaptureStationService);

  constructor() {
    effect(() => {
      if (!this.captura.ativa()) untracked(() => {
        this.pararWebcam();
        this.tentativaId.set(null);
        this.scanning.set(false);
      });
    });
  }

  async selecionarAparelho(): Promise<void> {
    try { await this.captura.ativar(); }
    catch { this.snackBar.open('Não foi possível selecionar a câmera deste aparelho.', 'Fechar', { duration: 4000 }); }
  }
  private snackBar = inject(MatSnackBar);
  private speech = inject(SpeechService);
  public webcam = inject(WebcamService);
  public wsLogs = inject(WebSocketLogsService);
  private rfidAccess = inject(RfidAccessService);

  @ViewChild(VisorFacial) visorFacial?: VisorFacial;

  scanning = signal(false);
  iniciandoTentativa = signal(false);
  similaridade = signal(0);
  minSimilaridade = signal(0.8);
  tempoRespostaMs = signal<number | null>(null);
  aprovado = signal(false);
  usuarioEncontrado = signal<string | null>(null);
  mensagemStatus = signal<string | null>(null);
  tentativaId = signal<string | null>(null);
  fotoPreviewUrl: string | null = null;

  modoTotem = signal(true);
  /** A última tentativa parou no cartão (recusado antes da face). Só apresentação. */
  recusaCartao = signal(false);
  modoKioskFullscreen = signal(false);
  exibirOverlayTotem = signal(false);
  historicoRecente = signal<HistoricoAcessoResponse[]>([]);
  historicoEstado = signal<'carregando' | 'ok' | 'erro'>('carregando');
  /** Pessoas ou leitores do simulador não carregaram. */
  erroAuxiliares = signal(false);

  usuarios: UsuarioSimplesResponse[] = [];
  locais: LocalResponse[] = [];
  dispositivos: DispositivoSimplesResponse[] = [];

  usuarioSimuladoId: number | null = null;
  dispositivoSimuladoId: number | null = null;
  uidManual = '';

  private timeoutOverlay: ReturnType<typeof setTimeout> | null = null;
  private timerTentativaExpiracao: ReturnType<typeof setTimeout> | null = null;
  private readonly TIMEOUT_PADRAO_MS = 15000;
  private wsSubscription: Subscription | null = null;

  ngOnInit(): void {
    void this.selecionarAparelho();
    void this.webcam.carregarModelos().catch((erro) =>
      console.warn("Falha ao preparar os modelos faciais:", erro));
    this.carregarHistorico();
    this.carregarAuxiliares();

    this.wsSubscription = this.wsLogs.obterLogsEmTempoReal().subscribe({
      next: (evento) => {
        if (evento.type === 'RFID_APROVADO' && evento.data.tentativa_id) {
          if (evento.data.cliente_id !== this.captura.clienteId) return;
          // A simulação usa este mesmo endpoint e também gera o broadcast.
          // Nesse caso, a resposta HTTP é a fonte da tentativa para evitar
          // abrir/reiniciar a webcam duas vezes.
          if (this.iniciandoTentativa()) return;

          this.receberRfid(
            evento.data.tentativa_id,
            evento.data.nome_usuario || null,
            evento.data.timeout_segundos ? evento.data.timeout_segundos * 1000 : undefined,
          );
          return;
        }

        if (evento.type === 'TENTATIVA_EXPIRADA') {
          if (this.tentativaId() && evento.data?.tentativa_id === this.tentativaId()) {
            this.expirarTentativaPorTimeout(evento.data?.motivo || undefined);
          }
          return;
        }

        if (evento.type === 'RFID_NEGADO') {
          if (!this.captura.ativa()) return;
          if (this.iniciandoTentativa()) return;

          this.cancelarTimerExpiracao();
          this.tentativaId.set(null);
          this.pararWebcam();
          this.aprovado.set(false);
          this.similaridade.set(0);
          this.tempoRespostaMs.set(null);
          this.usuarioEncontrado.set(null);
          this.recusaCartao.set(true);
          this.mensagemStatus.set(
            evento.data.motivo || 'Cartão recusado.',
          );
          return;
        }

        if (evento.type === 'NOVO_ACESSO') {
          this.carregarHistorico();
          if (
            this.tentativaId() &&
            evento.data?.tentativa_id === this.tentativaId() &&
            !evento.data?.autorizado
          ) {
            this.expirarTentativaPorTimeout(evento.data?.motivo_recusa || undefined);
          }
        }
      },
    });

    const pending = this.rfidAccess.consumirTentativa();
    if (pending?.tentativa_id) {
      this.receberRfid(pending.tentativa_id, pending.nome_usuario || null);
    }
  }

  private receberRfid(tentativaId: string, nomeUsuario: string | null, timeoutMs?: number): void {
    if (this.tentativaId() === tentativaId) return;
    this.prepararTentativa(tentativaId, nomeUsuario, timeoutMs);
    void this.iniciarWebcam();
    this.speech.falar('Cartão reconhecido. Agora olhe para a câmera.', true);
  }

  carregarAuxiliares(): void {
    this.erroAuxiliares.set(false);
    const falhou = () => this.erroAuxiliares.set(true);

    this.api.getUsuariosSimples({ ativo: true }).subscribe({
      next: (usuarios) => {
        this.usuarios = usuarios;

        const primeiroComCartao = usuarios.find((usuario) => usuario.uid_card);
        if (primeiroComCartao && this.usuarioSimuladoId === null) {
          this.usuarioSimuladoId = primeiroComCartao.user_id;
          this.uidManual = primeiroComCartao.uid_card || '';
        }
      },
      error: falhou,
    });

    // Só completa nomes de local que o próprio registro não trouxe; sem a lista, vale o nome do registro.
    this.api.getLocais().subscribe({
      next: (locais) => (this.locais = locais),
      error: () => {},
    });

    this.api.getDispositivosSimples({ ativo: true }).subscribe({
      next: (dispositivos) => {
        this.dispositivos = dispositivos;
        if (dispositivos.length && this.dispositivoSimuladoId === null) {
          this.dispositivoSimuladoId = dispositivos[0].dispositivo_id;
        }
      },
      error: falhou,
    });
  }

  get usuarioSimulado(): UsuarioSimplesResponse | null {
    if (this.usuarioSimuladoId === null) return null;
    return (
      this.usuarios.find(
        (usuario) => usuario.user_id === this.usuarioSimuladoId,
      ) || null
    );
  }

  get dispositivoSimulado(): DispositivoSimplesResponse | null {
    if (this.dispositivoSimuladoId === null) return null;
    return (
      this.dispositivos.find(
        (dispositivo) =>
          dispositivo.dispositivo_id === this.dispositivoSimuladoId,
      ) || null
    );
  }

  onUsuarioSimuladoChange(): void {
    this.uidManual = this.usuarioSimulado?.uid_card || '';
  }

  async simularLeituraRfid(): Promise<void> {
    if (this.iniciandoTentativa()) return;

    const dispositivo = this.dispositivoSimulado;
    const uid = this.normalizarUid(this.uidManual);

    if (!dispositivo) {
      this.snackBar.open(
        'Selecione um dispositivo ativo para simular a leitura.',
        'Fechar',
        { duration: 4500 },
      );
      return;
    }

    if (!uid) {
      this.snackBar.open(
        'Selecione um usuário com cartão ou informe um UID válido.',
        'Fechar',
        { duration: 4500 },
      );
      return;
    }

    this.iniciandoTentativa.set(true);
    this.mensagemStatus.set('Simulando leitura RFID no fluxo real...');
    try { await this.captura.ativar(); }
    catch { this.iniciandoTentativa.set(false); return; }

    this.api.verificarCartao(uid, dispositivo.identificador).subscribe({
      next: (resultado) => {
        this.iniciandoTentativa.set(false);

        if (!resultado.tentativa_id) {
          this.recusaCartao.set(true);
          this.mensagemStatus.set(
            resultado.mensagem || 'O backend não criou uma tentativa.',
          );
          return;
        }

        this.prepararTentativa(
          resultado.tentativa_id,
          resultado.nome || this.usuarioSimulado?.nome || null,
          resultado.timeout_segundos ? resultado.timeout_segundos * 1000 : undefined,
        );

        this.snackBar.open(
          'RFID simulado. Tentativa 1:1 criada pelo backend.',
          'Fechar',
          { duration: 3500 },
        );

        void this.iniciarWebcam();
      },
      error: (error) => {
        this.iniciandoTentativa.set(false);
        this.tentativaId.set(null);
        this.aprovado.set(false);
        this.usuarioEncontrado.set(null);
        this.recusaCartao.set(true);
        let mensagemErro = 'A leitura simulada foi recusada pelo backend.';

        if (error.error?.detail) {
          // FastAPI validation errors (422) return detail as array of objects
          if (Array.isArray(error.error.detail)) {
            const msgs = error.error.detail
              .map((e: any) => e?.msg || e?.message || JSON.stringify(e))
              .filter(Boolean)
              .join('; ');
            if (msgs) mensagemErro = msgs;
          } else if (typeof error.error.detail === 'string') {
            mensagemErro = error.error.detail;
          }
        } else if (error.error?.message) {
          mensagemErro = error.error.message;
        } else if (error.message) {
          mensagemErro = error.message;
        }

        this.mensagemStatus.set(mensagemErro);
      },
    });
  }

  private prepararTentativa(
    tentativaId: string,
    nomeUsuario: string | null,
    timeoutMs?: number,
  ): void {
    this.cancelarTimerExpiracao();

    this.tentativaId.set(tentativaId);
    this.recusaCartao.set(false);
    this.aprovado.set(false);
    this.similaridade.set(0);
    this.tempoRespostaMs.set(null);
    this.usuarioEncontrado.set(nomeUsuario);
    this.mensagemStatus.set(
      'Cartão reconhecido. Aguardando validação facial 1:1...',
    );

    const duracao = timeoutMs && timeoutMs > 0 ? timeoutMs : this.TIMEOUT_PADRAO_MS;
    this.timerTentativaExpiracao = setTimeout(() => {
      this.expirarTentativaPorTimeout();
    }, duracao);
  }

  private cancelarTimerExpiracao(): void {
    if (this.timerTentativaExpiracao) {
      clearTimeout(this.timerTentativaExpiracao);
      this.timerTentativaExpiracao = null;
    }
  }

  expirarTentativaPorTimeout(motivo?: string): void {
    this.cancelarTimerExpiracao();
    if (!this.tentativaId()) return;

    const mensagem = motivo || 'Tempo máximo para validação facial excedido.';
    this.scanning.set(false);
    this.aprovado.set(false);
    this.similaridade.set(0);
    this.tempoRespostaMs.set(null);
    this.mensagemStatus.set(mensagem);
    this.speech.falar(mensagem, true);

    this.tentativaId.set(null);
    this.carregarHistorico();

    if (this.modoTotem()) {
      this.exibirOverlayTotem.set(true);
      if (this.timeoutOverlay) {
        clearTimeout(this.timeoutOverlay);
      }
      this.timeoutOverlay = setTimeout(() => {
        this.encerrarCicloAcesso();
      }, 4000);
    } else {
      this.pararWebcam();
    }
  }

  private normalizarUid(uid: string): string {
    return uid.replace(/[\s:-]/g, '').toUpperCase();
  }

  obterNomeUsuario(log: HistoricoAcessoResponse): string {
    if (log.nome_usuario) return log.nome_usuario;
    if (log.usuario_id) {
      const usuario = this.usuarios.find(
        (item) => item.user_id === log.usuario_id,
      );
      if (usuario) return usuario.nome;
    }
    return 'Não identificado';
  }

  obterNomeLocal(log: HistoricoAcessoResponse): string {
    if (log.nome_local) return log.nome_local;
    if (log.local_id) {
      const local = this.locais.find(
        (item) => item.local_id === log.local_id,
      );
      if (local) return local.nome;
    }
    return 'Arduino ESP32 (Leitor)';
  }

  carregarHistorico(): void {
    if (this.historicoEstado() === 'erro') this.historicoEstado.set('carregando');
    this.api.getHistoricoAcesso().subscribe({
      next: (data) => {
        this.historicoRecente.set(data.slice(0, 5));
        this.historicoEstado.set('ok');
      },
      // Se a lista já apareceu antes, ela continua na tela; o erro só aparece no lugar de uma lista vazia.
      error: () => this.historicoEstado.set('erro'),
    });
  }

  async iniciarWebcam(): Promise<void> {
    const tentativaPendente = this.tentativaId();

    if (!tentativaPendente) {
      this.mensagemStatus.set(
        'Inicie uma tentativa com RFID físico ou pelo simulador.',
      );
      return;
    }

    this.limparResultadoPreservandoTentativa();
    this.tentativaId.set(tentativaPendente);

    await this.webcam.iniciarWebcam(
      () => this.visorFacial?.videoElement(),
      this.modoTotem(),
      () => this.capturarEValidar(),
    );
  }

  pararWebcam(): void {
    this.webcam.pararWebcam();
    this.scanning.set(false);
  }

  async capturarEValidar(): Promise<void> {
    if (this.webcam.emCooldown() || this.scanning() || !this.captura.ativa()) return;

    const tentativaAtual = this.tentativaId();

    if (!tentativaAtual) {
      this.mensagemStatus.set(
        'Nenhuma tentativa ativa. Leia ou simule um cartão primeiro.',
      );
      return;
    }

    if (!this.webcam.capturaPronta() && !this.modoTotem()) return;

    this.scanning.set(true);
    const resCapture = await this.webcam.capturarFrameComPreview();
    if (!resCapture || this.tentativaId() !== tentativaAtual || !this.captura.ativa()) {
      this.scanning.set(false);
      return;
    }

    this.fotoPreviewUrl = resCapture.previewUrl;
    this.mensagemStatus.set('Validando titular do cartão em 1:1...');
    this.scanning.set(true);

    this.api.verificarFace(tentativaAtual, resCapture.blob, this.captura.clienteId).subscribe({
      next: (res) => {
        if (this.tentativaId() !== tentativaAtual) return;
        this.cancelarTimerExpiracao();
        this.scanning.set(false);
        this.similaridade.set(Number(res.similaridade ?? 0));
        this.tempoRespostaMs.set(res.tempo_resposta_ms ?? null);
        this.aprovado.set(!!res.aprovado);
        this.usuarioEncontrado.set(res.nome || null);
        this.mensagemStatus.set(
          res.aprovado
            ? 'Acesso Liberado'
            : res.mensagem === 'FACE_MULTIPLE'
              ? 'Mais de um rosto detectado. Mantenha apenas o titular na imagem e leia o cartão novamente.'
              : res.mensagem || 'Acesso Negado',
        );

        if (res.aprovado) {
          this.speech.falar(
            'Acesso liberado. Seja bem-vindo, ' +
              (this.usuarioEncontrado() || 'usuário') +
              '.',
            true,
          );
        } else {
          this.speech.falar(this.mensagemStatus() || 'Acesso negado.', true);
        }

        this.tentativaId.set(null);
        this.carregarHistorico();

        if (this.modoTotem()) {
          this.exibirOverlayTotem.set(true);
          this.timeoutOverlay = setTimeout(() => {
            this.encerrarCicloAcesso();
          }, 3000);
        } else {
          this.pararWebcam();
        }
      },
      error: (error) => {
        if (this.tentativaId() !== tentativaAtual) return;
        this.cancelarTimerExpiracao();
        this.scanning.set(false);
        this.tentativaId.set(null);
        this.aprovado.set(false);
        this.similaridade.set(0);
        this.tempoRespostaMs.set(null);

        let mensagemErro = 'Não foi possível concluir a validação facial 1:1.';

        if (error.error?.detail) {
          if (Array.isArray(error.error.detail)) {
            const msgs = error.error.detail
              .map((e: any) => e?.msg || e?.message || JSON.stringify(e))
              .filter(Boolean)
              .join('; ');
            if (msgs) mensagemErro = msgs;
          } else if (typeof error.error.detail === 'string') {
            mensagemErro = error.error.detail;
          }
        } else if (error.error?.message) {
          mensagemErro = error.error.message;
        } else if (error.message) {
          mensagemErro = error.message;
        }

        this.mensagemStatus.set(mensagemErro);
        this.speech.falar(
          'Não foi possível concluir a validação facial.',
          true,
        );

        if (this.modoTotem()) {
          this.exibirOverlayTotem.set(true);
          this.timeoutOverlay = setTimeout(() => {
            this.encerrarCicloAcesso();
          }, 3000);
        } else {
          this.pararWebcam();
        }
      },
    });
  }

  /**
   * Em que ponto do fluxo a tela está, derivado dos sinais acima.
   * Serve só para a apresentação (trilha e tom da mensagem); não altera a captura.
   */
  get situacao(): 'aguardando' | 'recusado' | 'camera' | 'verificando' | 'liberado' | 'negado' {
    const temResultado =
      this.exibirOverlayTotem() ||
      (!!this.fotoPreviewUrl && !this.webcam.webcamAtiva() && !this.tentativaId() && !this.scanning());
    if (temResultado) return this.aprovado() ? 'liberado' : 'negado';
    if (this.scanning()) return 'verificando';
    if (this.tentativaId()) return 'camera';
    return this.recusaCartao() ? 'recusado' : 'aguardando';
  }

  /** Escolhe o modo de captura sem alternar quando já está nele. */
  definirModoTotem(automatico: boolean): void {
    if (this.modoTotem() !== automatico) this.toggleModoTotem();
  }

  toggleModoTotem(): void {
    this.modoTotem.set(!this.modoTotem());
    if (this.webcam.webcamAtiva() && this.tentativaId()) {
      void this.iniciarWebcam();
    }
  }

  toggleKioskFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          this.modoKioskFullscreen.set(true);
        })
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => {
          this.modoKioskFullscreen.set(false);
        })
        .catch(() => {});
    }
  }

  /** Sair da tela cheia pelo navegador (Esc) também encerra o layout de quiosque. */
  @HostListener('document:fullscreenchange')
  sincronizarQuiosque(): void {
    this.modoKioskFullscreen.set(!!document.fullscreenElement);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (event.key === 'F11') {
      event.preventDefault();
      this.toggleKioskFullscreen();
    } else if (
      event.code === 'Space' &&
      !this.exibirOverlayTotem() &&
      this.tentativaId()
    ) {
      if (!this.webcam.webcamAtiva()) {
        void this.iniciarWebcam();
      }
    }
  }

  encerrarCicloAcesso(): void {
    this.cancelarTimerExpiracao();
    if (this.timeoutOverlay) {
      clearTimeout(this.timeoutOverlay);
      this.timeoutOverlay = null;
    }

    this.exibirOverlayTotem.set(false);
    this.fotoPreviewUrl = null;
    this.recusaCartao.set(false);
    // A tentativa já foi concluída. A câmera deve voltar ao estado ocioso
    // e só será aberta novamente após um novo RFID_APROVADO/tentativa_id.
    this.pararWebcam();
    this.tentativaId.set(null);
    this.mensagemStatus.set(
      this.aprovado()
        ? 'Acesso concluído. Aguardando novo cartão RFID.'
        : 'Tentativa encerrada. Aguardando novo cartão RFID.',
    );
  }

  private limparResultadoPreservandoTentativa(): void {
    if (this.timeoutOverlay) {
      clearTimeout(this.timeoutOverlay);
      this.timeoutOverlay = null;
    }
    this.exibirOverlayTotem.set(false);
    this.pararWebcam();
    this.fotoPreviewUrl = null;
    this.similaridade.set(0);
    this.tempoRespostaMs.set(null);
    this.aprovado.set(false);
    this.mensagemStatus.set(null);
  }

  resetar(): void {
    this.cancelarTimerExpiracao();
    this.recusaCartao.set(false);
    this.limparResultadoPreservandoTentativa();
    this.usuarioEncontrado.set(null);
    this.tentativaId.set(null);
  }

  ngOnDestroy(): void {
    this.cancelarTimerExpiracao();
    this.pararWebcam();
    this.wsSubscription?.unsubscribe();
  }
}
