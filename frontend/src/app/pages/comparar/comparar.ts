import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  ApiService,
  DispositivoResponse,
  HistoricoAcessoResponse,
  LocalResponse,
  UsuarioResponse,
} from '../../services/api.service';
import { SpeechService } from '../../services/speech.service';
import { WebcamService } from '../../services/webcam.service';
import { WebSocketLogsService } from '../../services/websocket-logs.service';

@Component({
  selector: 'app-comparar-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterLink,
  ],
  templateUrl: './comparar.html',
  styleUrl: './comparar.scss',
})
export class CompararPage implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private speech = inject(SpeechService);
  public webcam = inject(WebcamService);
  public wsLogs = inject(WebSocketLogsService);

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('webcamContainer') webcamContainer?: ElementRef<HTMLDivElement>;

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
  modoKioskFullscreen = signal(false);
  exibirOverlayTotem = signal(false);
  historicoRecente = signal<HistoricoAcessoResponse[]>([]);

  usuarios: UsuarioResponse[] = [];
  locais: LocalResponse[] = [];
  dispositivos: DispositivoResponse[] = [];

  usuarioSimuladoId: number | null = null;
  dispositivoSimuladoId: number | null = null;
  uidManual = '';

  private timeoutOverlay: ReturnType<typeof setTimeout> | null = null;
  private wsSubscription: Subscription | null = null;

  async ngOnInit(): Promise<void> {
    await this.webcam.carregarModelos();
    this.carregarHistorico();
    this.carregarAuxiliares();

    this.wsSubscription = this.wsLogs.obterLogsEmTempoReal().subscribe({
      next: (evento) => {
        if (evento.type === 'RFID_APROVADO' && evento.data.tentativa_id) {
          // A simulação usa este mesmo endpoint e também gera o broadcast.
          // Nesse caso, a resposta HTTP é a fonte da tentativa para evitar
          // abrir/reiniciar a webcam duas vezes.
          if (this.iniciandoTentativa()) return;

          this.prepararTentativa(
            evento.data.tentativa_id,
            evento.data.nome_usuario || null,
          );

          if (this.modoTotem() && !this.webcam.webcamAtiva()) {
            void this.iniciarWebcam();
          }

          this.speech.falar(
            'Cartão reconhecido. Agora olhe para a câmera.',
            true,
          );
          return;
        }

        if (evento.type === 'RFID_NEGADO') {
          if (this.iniciandoTentativa()) return;

          this.tentativaId.set(null);
          this.pararWebcam();
          this.aprovado.set(false);
          this.similaridade.set(0);
          this.tempoRespostaMs.set(null);
          this.usuarioEncontrado.set(null);
          this.mensagemStatus.set(
            evento.data.motivo || 'Cartão recusado.',
          );
          return;
        }

        if (evento.type === 'NOVO_ACESSO') {
          this.carregarHistorico();
        }
      },
    });
  }

  carregarAuxiliares(): void {
    this.api.getUsuarios({ ativo: true }).subscribe({
      next: (usuarios) => {
        this.usuarios = usuarios;

        const primeiroComCartao = usuarios.find((usuario) => usuario.uid_card);
        if (primeiroComCartao && this.usuarioSimuladoId === null) {
          this.usuarioSimuladoId = primeiroComCartao.user_id;
          this.uidManual = primeiroComCartao.uid_card || '';
        }
      },
    });

    this.api.getLocais().subscribe({
      next: (locais) => (this.locais = locais),
    });

    this.api.getDispositivos({ ativo: true }).subscribe({
      next: (dispositivos) => {
        this.dispositivos = dispositivos;
        if (dispositivos.length && this.dispositivoSimuladoId === null) {
          this.dispositivoSimuladoId = dispositivos[0].dispositivo_id;
        }
      },
    });
  }

  get usuarioSimulado(): UsuarioResponse | null {
    if (this.usuarioSimuladoId === null) return null;
    return (
      this.usuarios.find(
        (usuario) => usuario.user_id === this.usuarioSimuladoId,
      ) || null
    );
  }

  get dispositivoSimulado(): DispositivoResponse | null {
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

  simularLeituraRfid(): void {
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

    this.api.verificarCartao(uid, dispositivo.identificador).subscribe({
      next: (resultado) => {
        this.iniciandoTentativa.set(false);

        if (!resultado.tentativa_id) {
          this.mensagemStatus.set(
            resultado.mensagem || 'O backend não criou uma tentativa.',
          );
          return;
        }

        this.prepararTentativa(
          resultado.tentativa_id,
          resultado.nome || this.usuarioSimulado?.nome || null,
        );

        this.snackBar.open(
          'RFID simulado. Tentativa 1:1 criada pelo backend.',
          'OK',
          { duration: 3500 },
        );

        void this.iniciarWebcam();
      },
      error: (error) => {
        this.iniciandoTentativa.set(false);
        this.tentativaId.set(null);
        this.aprovado.set(false);
        this.usuarioEncontrado.set(null);

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
  ): void {
    this.tentativaId.set(tentativaId);
    this.aprovado.set(false);
    this.similaridade.set(0);
    this.tempoRespostaMs.set(null);
    this.usuarioEncontrado.set(nomeUsuario);
    this.mensagemStatus.set(
      'Cartão reconhecido. Aguardando validação facial 1:1...',
    );
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
    this.api.getHistoricoAcesso().subscribe({
      next: (data) => {
        this.historicoRecente.set(data.slice(-5).reverse());
      },
      error: () => {},
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
      () => this.videoElement,
      this.modoTotem(),
      () => this.capturarEValidar(),
    );
  }

  pararWebcam(): void {
    this.webcam.pararWebcam();
    this.scanning.set(false);
  }

  /**
   * Mapeia as coordenadas da Bounding Box para o círculo dinâmico
   * ajustado de forma proporcional ao rosto.
   */
  obterEstiloOvalDinamico(): { [key: string]: string } {
    const box = this.webcam.faceBox();
    const video = this.videoElement?.nativeElement;
    const container = this.webcamContainer?.nativeElement;

    if (!box || !video || !container || !video.videoWidth) {
      return {};
    }

    const scaleX = container.clientWidth / video.videoWidth;
    const scaleY = container.clientHeight / video.videoHeight;
    const scaleFactor = 0.85;
    const size =
      Math.max(box.width * scaleX, box.height * scaleY) * scaleFactor;

    const left =
      (box.x + box.width / 2) * scaleX - size / 2;
    const top =
      (box.y + box.height / 2) * scaleY - size / 2 - 10;

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${size}px`,
      height: `${size}px`,
      transform: 'none',
    };
  }

  async capturarEValidar(): Promise<void> {
    if (this.webcam.emCooldown()) return;

    const tentativaAtual = this.tentativaId();

    if (!tentativaAtual) {
      this.mensagemStatus.set(
        'Nenhuma tentativa ativa. Leia ou simule um cartão primeiro.',
      );
      return;
    }

    if (!this.webcam.capturaPronta() && !this.modoTotem()) return;

    const resCapture = await this.webcam.capturarFrameComPreview();
    if (!resCapture) return;

    this.fotoPreviewUrl = resCapture.previewUrl;
    this.mensagemStatus.set('Validando titular do cartão em 1:1...');
    this.scanning.set(true);

    this.api.verificarFace(tentativaAtual, resCapture.blob).subscribe({
      next: (res) => {
        this.scanning.set(false);
        this.similaridade.set(Number(res.similaridade ?? 0));
        this.tempoRespostaMs.set(res.tempo_resposta_ms ?? null);
        this.aprovado.set(!!res.aprovado);
        this.usuarioEncontrado.set(res.nome || null);
        this.mensagemStatus.set(
          res.aprovado
            ? 'Acesso Liberado'
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
          this.speech.falar(res.mensagem || 'Acesso negado.', true);
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

  private encerrarCicloAcesso(): void {
    if (this.timeoutOverlay) {
      clearTimeout(this.timeoutOverlay);
      this.timeoutOverlay = null;
    }

    this.exibirOverlayTotem.set(false);
    this.fotoPreviewUrl = null;

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
    this.limparResultadoPreservandoTentativa();
    this.usuarioEncontrado.set(null);
    this.tentativaId.set(null);
  }

  ngOnDestroy(): void {
    this.pararWebcam();
    this.wsSubscription?.unsubscribe();
  }
}
