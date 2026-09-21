import { Injectable, inject, signal, ElementRef } from '@angular/core';
import * as faceapi from '@vladmandic/face-api';
import { SpeechService } from './speech.service';

export type EstadoEnquadramento = 'ok' | 'sem_rosto' | 'sorriso' | 'olhos' | 'escuro' | null;

export interface FaceBoxPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class WebcamService {
  private speech = inject(SpeechService);

  // ── Signals públicos ──────────────────────────────────────────────
  webcamAtiva = signal(false);
  webcamErro = signal('');
  carregandoHardware = signal(false);
  statusValidacao = signal<string>('Centralize o rosto');
  tipoStatus = signal<'info' | 'warn' | 'success'>('info');
  capturaPronta = signal(false);

  // Círculo Dinâmico (Bounding Box Suavizado)
  faceBox = signal<FaceBoxPosition | null>(null);

  // Totem: Progresso de Auto-captura, Cooldown e Flash
  progressoAutoCaptura = signal(0);
  dispararFlash = signal(false);
  nivelIluminacao = signal<'boa' | 'baixa'>('boa');
  emCooldown = signal(false);

  // Modos e Diagnósticos
  modoDebug = signal(true);
  valorLuma = signal(0);
  earAtual = signal(0);
  proporcaoAtual = signal(0);

  // Modo auto-captura
  autoCapturaHabilitada = signal(false);
  onAutoCapturaCallback: (() => void) | null = null;

  // ── Estado público ────────────────────────────────────────────────
  stream: MediaStream | null = null;

  // ── Estado privado e Otimização de Performance ────────────────────
  private intervalValidacao: ReturnType<typeof setInterval> | null = null;
  private modelosCarregados = false;
  private ultimoEstadoEnquadramento: EstadoEnquadramento = null;
  private processandoDeteccao = false;
  private videoElementRef: ElementRef<HTMLVideoElement> | null = null;

  // Buffer Canvas Reutilizável (Evita Garbage Collection contínuo)
  private lumaCanvas: HTMLCanvasElement = document.createElement('canvas');
  private lumaCtx: CanvasRenderingContext2D | null = null;

  // Cerca / Suavização da Bounding Box (Alpha Smoothing)
  private currentBox: FaceBoxPosition | null = null;
  private readonly SMOOTH_ALPHA = 0.35;

  // Timer de auto-captura
  private tempoAcumuladoValido = 0;
  private readonly TEMPO_AUTO_CAPTURA = 1500;
  private ultimoTickTimestamp = 0;

  // Cooldown pós-acesso
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.lumaCanvas.width = 64;
    this.lumaCanvas.height = 48;
    this.lumaCtx = this.lumaCanvas.getContext('2d', { willReadFrequently: true });
  }

async carregarModelos(): Promise<void> {
    if (this.modelosCarregados) return;
    this.carregandoHardware.set(true);
    try {
      // Define explicitamente o backend de aceleração de hardware via faceapi.tf
      if (faceapi.tf && 'setBackend' in faceapi.tf) {
        await (faceapi.tf as any).setBackend('webgl').catch(() => (faceapi.tf as any).setBackend('cpu'));
      }
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceExpressionNet.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      this.modelosCarregados = true;
    } catch (e) {
      console.warn('Não foi possível carregar os modelos locais do face-api:', e);
    } finally {
      this.carregandoHardware.set(false);
    }
  }

  async iniciarWebcam(
    getVideoElement: () => ElementRef<HTMLVideoElement> | undefined,
    enableAutoCaptura: boolean = false,
    onAutoCaptura?: () => void
  ): Promise<void> {
    this.webcamErro.set('');
    this.carregandoHardware.set(true);
    this.statusValidacao.set('Iniciando câmera e sensores...');
    this.tipoStatus.set('info');
    this.autoCapturaHabilitada.set(enableAutoCaptura);
    this.onAutoCapturaCallback = onAutoCaptura || null;
    this.resetAutoCaptura();

    try {
      await this.carregarModelos();

      let streamInicial = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');

      const palavrasExterna = ['cubeternet', 'usb', 'webcam', 'logitech', 'external'];
      const palavrasInterna = ['positivo', 'theia', 'integrated', 'built-in', 'interno'];

      let cameraExterna = cameras.find((c) => {
        const label = c.label.toLowerCase();
        return palavrasExterna.some((kw) => label.includes(kw))
          && !palavrasInterna.some((kw) => label.includes(kw));
      });

      if (!cameraExterna && cameras.length > 1) {
        cameraExterna = cameras.find((c) => {
          const label = c.label.toLowerCase();
          return !palavrasInterna.some((kw) => label.includes(kw));
        });
      }

      const trackAtual = streamInicial.getVideoTracks()[0];
      const deviceIdAtual = trackAtual?.getSettings()?.deviceId;

      if (cameraExterna && cameraExterna.deviceId !== deviceIdAtual) {
        streamInicial.getTracks().forEach((t) => t.stop());
        streamInicial = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameraExterna.deviceId }, width: 1280, height: 720 },
        });
      }

      this.stream = streamInicial;
      this.webcamAtiva.set(true);
      this.carregandoHardware.set(false);

      if (!this.emCooldown()) {
        this.speech.falar('Centralize o rosto e mantenha uma expressão séria.');
      }

      setTimeout(() => {
        const el = getVideoElement();
        if (el?.nativeElement) {
          this.videoElementRef = el;
          el.nativeElement.srcObject = this.stream;
          this.iniciarLoopValidacao();
        }
      }, 100);
    } catch {
      this.webcamAtiva.set(false);
      this.carregandoHardware.set(false);
      this.webcamErro.set('Erro ao acessar a webcam. Verifique as permissões.');
      this.speech.falar('Erro ao acessar a câmera.');
    }
  }

  ativarCooldownPosAcesso(duracaoMs = 5000): void {
    this.emCooldown.set(true);
    this.resetAutoCaptura();
    this.statusValidacao.set('Catraca liberada — Aguardando passagem');
    this.tipoStatus.set('info');
    this.faceBox.set(null);
    this.currentBox = null;

    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
    this.cooldownTimer = setTimeout(() => {
      this.emCooldown.set(false);
      this.statusValidacao.set('Centralize o rosto');
      this.tipoStatus.set('info');
      this.ultimoEstadoEnquadramento = null;
      this.iniciarLoopValidacao();
    }, duracaoMs);
  }

  iniciarLoopValidacao(): void {
    this.pararLoopValidacao();
    this.ultimoEstadoEnquadramento = null;

    this.intervalValidacao = setInterval(async () => {
      if (this.processandoDeteccao) return;
      if (!this.webcamAtiva() || !this.videoElementRef?.nativeElement || !this.modelosCarregados) {
        return;
      }

      const video = this.videoElementRef.nativeElement;
      if (video.paused || video.ended || !video.videoWidth) return;

      this.processandoDeteccao = true;
      try {
        if (this.emCooldown()) {
          this.resetAutoCaptura();
          return;
        }

        // Checagem de Iluminação Reutilizando Buffer Canvas
        const brilhoMedio = this.calcularLuminanciaOtimizada(video);
        this.valorLuma.set(Math.round(brilhoMedio));
        if (brilhoMedio < 30) {
          this.capturaPronta.set(false);
          this.statusValidacao.set(`Ambiente escuro (${Math.round(brilhoMedio)} Luma) — Aumente a iluminação`);
          this.tipoStatus.set('warn');
          this.nivelIluminacao.set('baixa');
          this.resetAutoCaptura();
          this.suavizarRostoPerdido();
          return;
        } else {
          this.nivelIluminacao.set('boa');
        }

        // Detecção com TinyFaceDetector em Resolução Otimizada (224px)
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceLandmarks()
          .withFaceExpressions();

        if (!detection) {
          this.capturaPronta.set(false);
          this.statusValidacao.set('Rosto não detectado');
          this.tipoStatus.set('warn');
          this.resetAutoCaptura();
          this.suavizarRostoPerdido();

          if (this.ultimoEstadoEnquadramento !== 'sem_rosto') {
            this.speech.falar('Rosto não detectado. Centralize-se na câmera.');
            this.ultimoEstadoEnquadramento = 'sem_rosto';
          }
          return;
        }

        // Atualização e Suavização da Bounding Box (Círculo Dinâmico)
        const rawBox = detection.detection.box;
        this.atualizarFaceBoxSuavizada({
          x: rawBox.x,
          y: rawBox.y,
          width: rawBox.width,
          height: rawBox.height,
        });

        const proporcaoRosto = rawBox.width / video.videoWidth;
        this.proporcaoAtual.set(Math.round(proporcaoRosto * 100));

        if (proporcaoRosto < 0.18) {
          this.capturaPronta.set(false);
          this.statusValidacao.set('Aproxime-se da câmera');
          this.tipoStatus.set('warn');
          this.resetAutoCaptura();
          return;
        }

        if (proporcaoRosto > 0.70) {
          this.capturaPronta.set(false);
          this.statusValidacao.set('Afaste-se um pouco');
          this.tipoStatus.set('warn');
          this.resetAutoCaptura();
          return;
        }

        // Validação Olhos Fechados
        const olhoEsq = detection.landmarks.getLeftEye();
        const olhoDir = detection.landmarks.getRightEye();
        const earMedio = (calcularEAR(olhoEsq) + calcularEAR(olhoDir)) / 2;
        this.earAtual.set(Number(earMedio.toFixed(2)));

        if (earMedio < 0.23) {
          this.capturaPronta.set(false);
          this.statusValidacao.set('Olhos fechados!');
          this.tipoStatus.set('warn');
          this.resetAutoCaptura();

          if (this.ultimoEstadoEnquadramento !== 'olhos') {
            this.speech.falar('Mantenha os olhos abertos.');
            this.ultimoEstadoEnquadramento = 'olhos';
          }
          return;
        }

        // Validação Sorriso
        const ehSorriso = detection.expressions.happy > 0.6;

        if (ehSorriso) {
          this.capturaPronta.set(false);
          this.statusValidacao.set('Sorriso detectado! Fique sério');
          this.tipoStatus.set('warn');
          this.resetAutoCaptura();

          if (this.ultimoEstadoEnquadramento !== 'sorriso') {
            this.speech.falar('Por favor, mantenha uma expressão neutra e fique sério.');
            this.ultimoEstadoEnquadramento = 'sorriso';
          }
        } else {
          this.capturaPronta.set(true);
          this.statusValidacao.set('Rosto enquadrado - Pronto!');
          this.tipoStatus.set('success');
          this.ultimoEstadoEnquadramento = 'ok';

          if (this.autoCapturaHabilitada()) {
            this.incrementarAutoCaptura();
          }
        }
      } finally {
        this.processandoDeteccao = false;
      }
    }, 200);
  }

  private atualizarFaceBoxSuavizada(target: FaceBoxPosition): void {
    if (!this.currentBox) {
      this.currentBox = { ...target };
    } else {
      // Média Móvel Suavizada (Alpha Smoothing Filter)
      this.currentBox.x += this.SMOOTH_ALPHA * (target.x - this.currentBox.x);
      this.currentBox.y += this.SMOOTH_ALPHA * (target.y - this.currentBox.y);
      this.currentBox.width += this.SMOOTH_ALPHA * (target.width - this.currentBox.width);
      this.currentBox.height += this.SMOOTH_ALPHA * (target.height - this.currentBox.height);
    }
    this.faceBox.set({ ...this.currentBox });
  }

  private suavizarRostoPerdido(): void {
    this.currentBox = null;
    this.faceBox.set(null);
  }

  private incrementarAutoCaptura(): void {
    this.tempoAcumuladoValido += 200;
    const pct = Math.min(100, Math.round((this.tempoAcumuladoValido / this.TEMPO_AUTO_CAPTURA) * 100));
    this.progressoAutoCaptura.set(pct);

    const agora = Date.now();
    if (agora - this.ultimoTickTimestamp >= 450 && pct < 100) {
      this.speech.tocarBipTick();
      this.ultimoTickTimestamp = agora;
    }

    if (this.tempoAcumuladoValido >= this.TEMPO_AUTO_CAPTURA) {
      this.speech.tocarBipDisparo();
      this.resetAutoCaptura();
      if (this.onAutoCapturaCallback) {
        this.onAutoCapturaCallback();
      }
    }
  }

  private resetAutoCaptura(): void {
    this.tempoAcumuladoValido = 0;
    this.progressoAutoCaptura.set(0);
  }

  private calcularLuminanciaOtimizada(video: HTMLVideoElement): number {
    if (!this.lumaCtx) return 100;
    this.lumaCtx.drawImage(video, 0, 0, 64, 48);
    const imgData = this.lumaCtx.getImageData(0, 0, 64, 48);
    const data = imgData.data;
    let somaLuma = 0;

    for (let i = 0; i < data.length; i += 4) {
      somaLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return somaLuma / (data.length / 4);
  }

  pararLoopValidacao(): void {
    if (this.intervalValidacao) {
      clearInterval(this.intervalValidacao);
      this.intervalValidacao = null;
    }
    this.resetAutoCaptura();
    this.suavizarRostoPerdido();
  }

  pararWebcam(): void {
    this.pararLoopValidacao();
    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
    this.speech.parar();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.webcamAtiva.set(false);
    this.capturaPronta.set(false);
    this.videoElementRef = null;
    this.emCooldown.set(false);
  }

  executarEfeitoFlash(): void {
    this.dispararFlash.set(true);
    setTimeout(() => this.dispararFlash.set(false), 150);
  }

  async capturarFrameComPreview(): Promise<{ blob: Blob; previewUrl: string } | null> {
    const video = this.videoElementRef?.nativeElement;
    if (!video) return Promise.resolve(null);

    this.executarEfeitoFlash();
    this.pararLoopValidacao();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const previewUrl = canvas.toDataURL('image/jpeg', 0.85);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob ? { blob, previewUrl } : null),
        'image/jpeg',
        0.85,
      );
    });
  }
}

function calcularEAR(olho: faceapi.Point[]): number {
  const d1 = Math.hypot(olho[1].x - olho[5].x, olho[1].y - olho[5].y);
  const d2 = Math.hypot(olho[2].x - olho[4].x, olho[2].y - olho[4].y);
  const d3 = Math.hypot(olho[0].x - olho[3].x, olho[0].y - olho[3].y);
  return (d1 + d2) / (2.0 * d3);
}