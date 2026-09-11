import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import * as faceapi from '@vladmandic/face-api';
import { ApiService, AdmPageResponse } from '../../services/api.service';
import { SpeechService } from '../../services/speech.service';

type EstadoEnquadramento = 'ok' | 'sem_rosto' | 'sorriso' | null;

@Component({
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterLink,
  ],
  selector: 'app-adm-page',
  styleUrl: './adm-page.scss',
  templateUrl: './adm-page.html',
})
export class AdmPage implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private speech = inject(SpeechService);

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;

  dados = signal<AdmPageResponse | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);
  webcamAtiva = signal(false);
  webcamErro = signal('');
  stream: MediaStream | null = null;
  scanning = signal(false);
  capturaPronta = signal(false);
  sucesso = signal(false);
  similaridade = signal(0);
  aprovado = signal(false);
  usuarioEncontrado = signal<string | null>(null);

  // Indicators para o Badge Visual
  statusValidacao = signal<string>('Centralize o rosto');
  tipoStatus = signal<'info' | 'warn' | 'success'>('info');

  private intervalValidacao: ReturnType<typeof setInterval> | null = null;
  private modelosCarregados = false;
  private ultimoEstadoEnquadramento: EstadoEnquadramento = null;
  private processandoDeteccao = false;

  async ngOnInit(): Promise<void> {
    this.api.getAdmPage().subscribe({
      next: (res) => {
        this.dados.set(res);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível conectar ao servidor.');
        this.carregando.set(false);
      },
    });

    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceExpressionNet.loadFromUri('/models');
      this.modelosCarregados = true;
    } catch (e) {
      console.warn('Não foi possível carregar os modelos locais do face-api:', e);
    }
  }

  ngOnDestroy(): void {
    this.pararWebcam();
  }

  async iniciarWebcam(): Promise<void> {
    this.webcamErro.set('');
    this.statusValidacao.set('Centralize o rosto');
    this.tipoStatus.set('info');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
      });
      this.webcamAtiva.set(true);
      this.speech.falar('Centralize o rosto e mantenha uma expressão séria.');

      setTimeout(() => {
        if (this.videoElement?.nativeElement) {
          this.videoElement.nativeElement.srcObject = this.stream;
          this.iniciarLoopValidacao();
        }
      }, 100);
    } catch (err) {
      this.webcamAtiva.set(false);
      this.webcamErro.set('Erro ao acessar a webcam. Verifique as permissões.');
      this.speech.falar('Erro ao acessar a câmera.');
    }
  }

  private iniciarLoopValidacao(): void {
    this.pararLoopValidacao();
    this.ultimoEstadoEnquadramento = null;

    this.intervalValidacao = setInterval(async () => {
      if (this.processandoDeteccao) return;
      if (!this.webcamAtiva() || !this.videoElement?.nativeElement || !this.modelosCarregados) {
        return;
      }

      const video = this.videoElement.nativeElement;
      if (video.paused || video.ended || !video.videoWidth) return;

      this.processandoDeteccao = true;
      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
          .withFaceExpressions();

        if (!detection) {
          this.capturaPronta.set(false);
          this.statusValidacao.set('Rosto não detectado');
          this.tipoStatus.set('warn');

          if (this.ultimoEstadoEnquadramento !== 'sem_rosto') {
            this.speech.falar('Rosto não detectado. Centralize-se na câmera.');
            this.ultimoEstadoEnquadramento = 'sem_rosto';
          }
          return;
        }

        const ehSorriso = detection.expressions.happy > 0.6;

        if (ehSorriso) {
          this.capturaPronta.set(false);
          this.statusValidacao.set('Sorriso detectado! Fique sério');
          this.tipoStatus.set('warn');

          if (this.ultimoEstadoEnquadramento !== 'sorriso') {
            this.speech.falar('Por favor, mantenha uma expressão neutra e fique sério.');
            this.ultimoEstadoEnquadramento = 'sorriso';
          }
        } else {
          this.capturaPronta.set(true);
          this.statusValidacao.set('Rosto enquadrado - Pronto!');
          this.tipoStatus.set('success');
          this.ultimoEstadoEnquadramento = 'ok';
        }
      } finally {
        this.processandoDeteccao = false;
      }
    }, 500);
  }

  private pararLoopValidacao(): void {
    if (this.intervalValidacao) {
      clearInterval(this.intervalValidacao);
      this.intervalValidacao = null;
    }
  }

  pararWebcam(): void {
    this.pararLoopValidacao();
    this.speech.parar();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.webcamAtiva.set(false);
    this.scanning.set(false);
    this.capturaPronta.set(false);
  }

  capturarFrameWebcam(): void {
    if (!this.videoElement?.nativeElement || !this.capturaPronta()) return;

    this.pararLoopValidacao();

    const video = this.videoElement.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const formData = new FormData();
        formData.append('file', blob, 'biometria_teste.jpg');

        this.scanning.set(true);

        this.api.testarBiometria(formData).subscribe({
          next: (res: {
            status: string;
            similaridade: number;
            aprovado: boolean;
            mensagem?: string;
            usuario?: { user_id: number; nome: string };
          }) => {
            this.scanning.set(false);

            if (res.status === 'COMPARADO') {
              this.similaridade.set(res.similaridade);
              this.aprovado.set(res.aprovado);
              this.usuarioEncontrado.set(res.usuario?.nome ?? null);
              this.sucesso.set(true);

              if (res.aprovado) {
                this.speech.falar(`Acesso liberado. Seja bem-vindo, ${res.usuario?.nome ?? 'usuário'}.`, true);
              } else {
                this.speech.falar('Acesso negado. Biometria não corresponde ao cadastro.', true);
              }

              setTimeout(() => this.pararWebcam(), 3500);
            } else if (res.status === 'SEM_REGISTROS') {
              this.speech.falar('Nenhum usuário cadastrado no banco de dados.');
            } else if (res.status === 'ERRO') {
              this.speech.falar(res.mensagem || 'Rosto não detectado. Tente novamente.');
            } else {
              this.speech.falar('Erro ao processar biometria.');
            }
          },
          error: (err: any) => {
            this.scanning.set(false);
            this.speech.falar(err.error?.detail || 'Erro ao processar biometria.');
          },
        });
      },
      'image/jpeg',
      0.95
    );
  }

  reset(): void {
    this.pararWebcam();
    this.similaridade.set(0);
    this.aprovado.set(false);
    this.usuarioEncontrado.set(null);
    this.sucesso.set(false);
  }
}