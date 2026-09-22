import { Component, inject, OnDestroy, ViewChild, ElementRef, signal, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, HistoricoAcessoResponse, LocalResponse, UsuarioResponse } from '../../services/api.service';
import { SpeechService } from '../../services/speech.service';
import { WebcamService } from '../../services/webcam.service';
import { WebSocketLogsService } from '../../services/websocket-logs.service';

@Component({
  selector: 'app-comparar-page',
  standalone: true,
  imports: [
    CommonModule,
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
  similaridade = signal(0);
  minSimilaridade = signal(0.8);
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

  private timeoutOverlay: ReturnType<typeof setTimeout> | null = null;
  private wsSubscription: Subscription | null = null;

  async ngOnInit(): Promise<void> {
    await this.webcam.carregarModelos();
    this.carregarHistorico();
    this.carregarAuxiliares();

    this.wsSubscription = this.wsLogs.obterLogsEmTempoReal().subscribe({
      next: (evento) => {
        if (evento.type === 'RFID_APROVADO' && evento.data.tentativa_id) {
          this.tentativaId.set(evento.data.tentativa_id);
          this.aprovado.set(false);
          this.similaridade.set(0);
          this.usuarioEncontrado.set(evento.data.nome_usuario || null);
          this.mensagemStatus.set(
            'Cartão reconhecido. Aguardando validação facial...'
          );

          if (this.modoTotem() && !this.webcam.webcamAtiva()) {
            void this.iniciarWebcam();
          }

          this.speech.falar('Cartão reconhecido. Agora olhe para a câmera.', true);
          return;
        }

        if (evento.type === 'RFID_NEGADO') {
          this.tentativaId.set(null);
          this.pararWebcam();
          this.aprovado.set(false);
          this.similaridade.set(0);
          this.usuarioEncontrado.set(null);
          this.mensagemStatus.set(evento.data.motivo || 'Cartão recusado.');
          return;
        }

        if (evento.type === 'NOVO_ACESSO') {
          this.carregarHistorico();
        }
        }
      },
    });
  }

  carregarAuxiliares(): void {
    this.api.getUsuarios().subscribe({ next: (u) => (this.usuarios = u) });
    this.api.getLocais().subscribe({ next: (l) => (this.locais = l) });
  }

  obterNomeUsuario(log: HistoricoAcessoResponse): string {
    if (log.nome_usuario) return log.nome_usuario;
    if (log.usuario_id) {
      const u = this.usuarios.find((item) => item.user_id === log.usuario_id);
      if (u) return u.nome;
    }
    return 'Não identificado';
  }

  obterNomeLocal(log: HistoricoAcessoResponse): string {
    if (log.nome_local) return log.nome_local;
    if (log.local_id) {
      const l = this.locais.find((item) => item.local_id === log.local_id);
      if (l) return l.nome;
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
    this.resetar();
    await this.webcam.iniciarWebcam(
      () => this.videoElement,
      this.modoTotem(),
      () => this.capturarEComparar()
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

    // Fator ajustado para 0.85 (circunda o rosto sem cobrir a tela inteira)
    const scaleFactor = 0.85;
    const size = Math.max(box.width * scaleX, box.height * scaleY) * scaleFactor;

    // Centralização com leve ajuste de elevação (-10px) para enquadrar a cabeça
    const left = (box.x + box.width / 2) * scaleX - size / 2;
    const top = (box.y + box.height / 2) * scaleY - size / 2 - 10;

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${size}px`,
      height: `${size}px`,
      transform: 'none',
    };
  }

  async capturarEComparar(): Promise<void> {
    if (this.webcam.emCooldown()) return;

    const tentativaAtual = this.tentativaId();

    if (this.modoTotem() && !tentativaAtual) {
      this.mensagemStatus.set('Aguardando leitura de cartão RFID...');
      return;
    }

    if (!this.webcam.capturaPronta() && !this.modoTotem()) return;

    const resCapture = await this.webcam.capturarFrameComPreview();
    if (!resCapture) return;

    this.fotoPreviewUrl = resCapture.previewUrl;
    this.mensagemStatus.set(
      tentativaAtual
        ? 'Validando biometria...'
        : 'Comparando biometria...'
    );
    this.scanning.set(true);

    let request$;
    if (tentativaAtual) {
      request$ = this.api.verificarFace(tentativaAtual, resCapture.blob);
    } else {
      const formData = new FormData();
      formData.append('file', resCapture.blob, 'comparacao.jpg');
      request$ = this.api.testarBiometria(formData);
    }

    request$.subscribe({
      next: (res: any) => {
        this.scanning.set(false);

        if (res.min_similarity) {
          this.minSimilaridade.set(res.min_similarity);
        }

        this.similaridade.set(Number(res.similaridade ?? 0));
        this.aprovado.set(!!res.aprovado);
        this.usuarioEncontrado.set(
          res.nome ||
          res.usuario?.nome ||
          res.usuario ||
          null
        );

        this.mensagemStatus.set(
          res.aprovado
            ? 'Acesso Liberado'
            : (res.mensagem || 'Acesso Negado')
        );

        if (res.aprovado) {
          this.speech.falar(
            'Acesso liberado. Seja bem-vindo, ' +
            (this.usuarioEncontrado() || 'usuário') +
            '.',
            true
          );
        } else {
          this.speech.falar(
            res.mensagem || 'Acesso negado.',
            true
          );
        }

        if (tentativaAtual) {
          this.tentativaId.set(null);
        }

        if (this.modoTotem()) {
          this.exibirOverlayTotem.set(true);
          this.timeoutOverlay = setTimeout(() => {
            this.exibirOverlayTotem.set(false);
            this.fotoPreviewUrl = null;
            this.webcam.ativarCooldownPosAcesso(
              this.aprovado() ? 5000 : 1500
            );
          }, 3000);
        }
      },
      error: (err) => {
        this.scanning.set(false);
        this.tentativaId.set(null);
        this.aprovado.set(false);
        this.similaridade.set(0);
        this.mensagemStatus.set(
          err.error?.detail ||
          'Não foi possível concluir a validação facial.'
        );
        this.speech.falar(
          'Não foi possível concluir a validação facial.',
          true
        );

        if (this.modoTotem()) {
          this.exibirOverlayTotem.set(true);
          this.timeoutOverlay = setTimeout(() => {
            this.exibirOverlayTotem.set(false);
            this.fotoPreviewUrl = null;
            this.webcam.ativarCooldownPosAcesso(1500);
          }, 3000);
        }
      },
    });
  }

  toggleModoTotem(): void {
    this.modoTotem.set(!this.modoTotem());
    if (this.webcam.webcamAtiva()) {
      this.iniciarWebcam();
    }
  }

  toggleKioskFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        this.modoKioskFullscreen.set(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        this.modoKioskFullscreen.set(false);
      }).catch(() => {});
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (event.key === 'F11') {
      event.preventDefault();
      this.toggleKioskFullscreen();
    } else if (event.code === 'Space' && !this.exibirOverlayTotem()) {
      if (!this.webcam.webcamAtiva()) {
        this.iniciarWebcam();
      }
    }
  }

  resetar(): void {
    if (this.timeoutOverlay) {
      clearTimeout(this.timeoutOverlay);
      this.timeoutOverlay = null;
    }
    this.exibirOverlayTotem.set(false);
    this.pararWebcam();
    this.fotoPreviewUrl = null;
    this.similaridade.set(0);
    this.aprovado.set(false);
    this.usuarioEncontrado.set(null);
    this.mensagemStatus.set(null);
  }

  ngOnDestroy(): void {
    this.pararWebcam();
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
  }
}