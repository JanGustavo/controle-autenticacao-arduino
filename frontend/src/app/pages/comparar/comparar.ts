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

  scanning = signal(false);
  similaridade = signal(0);
  minSimilaridade = signal(80);
  aprovado = signal(false);
  usuarioEncontrado = signal<string | null>(null);
  mensagemStatus = signal<string | null>(null);
  fotoPreviewUrl: string | null = null;

  // Modo Totem / Kiosk
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

    // Inscrição no evento WebSocket de tempo real
    this.wsSubscription = this.wsLogs.obterLogsEmTempoReal().subscribe({
      next: (evento) => {
        if (evento.type === 'NOVO_ACESSO') {
          const novoItem: HistoricoAcessoResponse = {
            id: evento.data.id || Date.now(),
            usuario_id: evento.data.usuario_id,
            local_id: null,
            uid_card_lido: null,
            data_hora: evento.data.data_hora,
            autorizado: evento.data.autorizado,
            percentual_similaridade: evento.data.percentual_similaridade,
            motivo_recusa: evento.data.motivo_recusa,
            nome_usuario: evento.data.nome_usuario || null,
          };
          this.historicoRecente.update((lista) => [novoItem, ...lista.slice(0, 4)]);
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

  async capturarEComparar(): Promise<void> {
    if (this.webcam.emCooldown()) return;
    if (!this.webcam.capturaPronta() && !this.modoTotem()) return;

    const resCapture = await this.webcam.capturarFrameComPreview();
    if (!resCapture) return;

    this.fotoPreviewUrl = resCapture.previewUrl;
    const formData = new FormData();
    formData.append('file', resCapture.blob, 'comparacao.jpg');

// Limpa mensagens anteriores antes de iniciar a nova validação
this.mensagemStatus.set(null);
this.scanning.set(true);

this.api.testarBiometria(formData).subscribe({
  next: (res: any) => {
    this.scanning.set(false);

    if (res.min_similarity) {
      this.minSimilaridade.set(res.min_similarity);
    }

    if (res.status === 'COMPARADO') {
      this.similaridade.set(res.similaridade);
      this.aprovado.set(res.aprovado);
      this.usuarioEncontrado.set(res.usuario?.nome || res.usuario || 'Usuário Desconhecido');
      // Define a mensagem apenas para o evento atual
      this.mensagemStatus.set(res.aprovado ? 'Acesso Liberado' : 'Acesso Negado');

      if (res.aprovado) {
        this.speech.falar(`Acesso liberado. Seja bem-vindo, ${this.usuarioEncontrado()}.`, true);
      } else {
        this.speech.falar('Acesso negado. Biometria não corresponde ao cadastro.', true);
      }
    } else if (res.status === 'SEM_REGISTROS') {
      this.aprovado.set(false);
      this.similaridade.set(0);
      this.usuarioEncontrado.set(null);
      this.mensagemStatus.set('Nenhum usuário cadastrado no banco de dados.');
      this.speech.falar('Nenhum usuário cadastrado.');
    } else {
      this.aprovado.set(false);
      this.similaridade.set(0);
      this.usuarioEncontrado.set(null);
      this.mensagemStatus.set(res.mensagem || 'Rosto não identificado');
      this.speech.falar(res.mensagem || 'Erro ao processar biometria.');
    }

    if (this.modoTotem()) {
      this.exibirOverlayTotem.set(true);
      this.timeoutOverlay = setTimeout(() => {
        this.exibirOverlayTotem.set(false);
        this.fotoPreviewUrl = null;
        this.webcam.ativarCooldownPosAcesso(this.aprovado() ? 5000 : 1500);
      }, 3000);
    }
  },
  error: (err) => {
    this.scanning.set(false);
    this.aprovado.set(false);
    this.similaridade.set(0); // Reseta a similaridade em caso de erro HTTP
    this.mensagemStatus.set(err.error?.detail || 'Rosto não identificado na imagem.');
    this.speech.falar('Posicione o rosto corretamente.');

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