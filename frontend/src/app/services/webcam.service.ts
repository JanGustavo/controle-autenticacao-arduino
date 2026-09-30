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
  cameraAtivaLabel = signal<string>('');
  droidCamRetrato = signal(false);
  larguraFrameProcessado = signal(0);
  alturaFrameProcessado = signal(0);

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
  private frameProcessamentoCanvas: HTMLCanvasElement = document.createElement('canvas');
  private frameProcessamentoCtx: CanvasRenderingContext2D | null =
    this.frameProcessamentoCanvas.getContext('2d', { willReadFrequently: true });

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

      // Primeiro abre qualquer câmera para liberar os labels/deviceIds no navegador.
      // Sem uma permissão inicial, enumerateDevices() pode retornar labels vazios.
      let streamInicial = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');

      console.log(
        '[Webcam] Câmeras disponíveis:',
        cameras.map((camera) => `${camera.label || 'sem label'} (${camera.deviceId.slice(0, 8)}...)`),
      );

      const normalizarLabel = (label: string) => label.trim().toLowerCase();

      // Para a demonstração, DroidCam tem prioridade absoluta quando estiver disponível.
      const cameraDroidCam = cameras.find((camera) =>
        normalizarLabel(camera.label).includes('droidcam'),
      );

      const palavrasExterna = [
        'usb',
        'webcam',
        'logitech',
        'external',
        'virtual',
        'obs',
        'ndi',
        'epoccam',
        'ivcam',
        'snap',
      ];
      const palavrasInterna = [
        'positivo',
        'theia',
        'integrated',
        'built-in',
        'interno',
        'facetime',
      ];

      const cameraExterna = cameras.find((camera) => {
        const label = normalizarLabel(camera.label);
        return palavrasExterna.some((kw) => label.includes(kw))
          && !palavrasInterna.some((kw) => label.includes(kw));
      });

      const cameraNaoInterna = cameras.length > 1
        ? cameras.find((camera) => {
            const label = normalizarLabel(camera.label);
            return !palavrasInterna.some((kw) => label.includes(kw));
          })
        : undefined;

      const cameraPreferida = cameraDroidCam ?? cameraExterna ?? cameraNaoInterna;

      const trackAtual = streamInicial.getVideoTracks()[0];
      const deviceIdAtual = trackAtual?.getSettings()?.deviceId;

      console.log('[Webcam] Câmera selecionada pelo sistema:', trackAtual?.label || 'desconhecida');
      console.log('[Webcam] Câmera preferida encontrada:', cameraPreferida?.label ?? 'nenhuma');

      if (cameraPreferida && cameraPreferida.deviceId !== deviceIdAtual) {
        streamInicial.getTracks().forEach((track) => track.stop());

        try {
          streamInicial = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: cameraPreferida.deviceId },
            },
          });
        } catch (erroCameraPreferida) {
          console.warn(
            '[Webcam] Não foi possível abrir a câmera preferida com exact; tentando ideal.',
            erroCameraPreferida,
          );

          streamInicial = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { ideal: cameraPreferida.deviceId },
            },
          });
        }
      }

      this.stream = streamInicial;
      const trackAtivo = streamInicial.getVideoTracks()[0];
      const settingsAtivos = trackAtivo?.getSettings();

      this.cameraAtivaLabel.set(trackAtivo?.label || cameraPreferida?.label || 'Câmera padrão');

      console.log(
        '[Webcam] Stream ativo:',
        this.cameraAtivaLabel(),
        '| Settings:',
        settingsAtivos,
      );

      this.webcamAtiva.set(true);
      this.carregandoHardware.set(false);

      if (!this.emCooldown()) {
        this.speech.falar('Centralize o rosto e mantenha uma expressão séria.');
      }

      // O elemento pode aparecer depois que webcamAtiva muda o template.
      const esperarElemento = (): Promise<HTMLVideoElement> =>
        new Promise((resolve, reject) => {
          let tentativas = 0;

          const verificar = () => {
            tentativas++;
            const el = getVideoElement();

            if (el?.nativeElement) {
              resolve(el.nativeElement);
              return;
            }

            if (tentativas > 30) {
              reject(new Error('Elemento de vídeo não encontrado após 3 segundos.'));
              return;
            }

            setTimeout(verificar, 100);
          };

          verificar();
        });

      const videoEl = await esperarElemento();
      this.videoElementRef = getVideoElement()!;
      videoEl.srcObject = this.stream;

      // Câmeras virtuais podem não iniciar somente com autoplay.
      try {
        await videoEl.play();
      } catch (playErr) {
        console.warn('[Webcam] video.play() retornou erro não crítico:', playErr);
      }

      // Não inicia a IA enquanto a câmera virtual ainda reporta 0x0.
      await new Promise<void>((resolve) => {
        if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          resolve();
          return;
        }

        let concluido = false;
        const concluir = () => {
          if (concluido) return;
          concluido = true;
          videoEl.removeEventListener('loadedmetadata', concluir);
          videoEl.removeEventListener('canplay', concluir);
          resolve();
        };

        videoEl.addEventListener('loadedmetadata', concluir);
        videoEl.addEventListener('canplay', concluir);

        setTimeout(concluir, 5000);
      });

      const ehDroidCam = this.cameraAtivaLabel().toLowerCase().includes('droidcam');
      const precisaRotacionarDroidCam =
        ehDroidCam && videoEl.videoWidth > videoEl.videoHeight;

      this.droidCamRetrato.set(precisaRotacionarDroidCam);
      this.atualizarDimensoesProcessamento(videoEl);

      console.log(
        '[Webcam] Resolução do stream:',
        videoEl.videoWidth,
        'x',
        videoEl.videoHeight,
      );
      console.log(
        '[Webcam] Orientação aplicada:',
        precisaRotacionarDroidCam
          ? 'DroidCam retrato (90° horário)'
          : 'normal',
        '| Frame IA:',
        this.larguraFrameProcessado(),
        'x',
        this.alturaFrameProcessado(),
      );

      this.iniciarLoopValidacao();
    } catch (err) {
      console.error('[Webcam] Erro ao iniciar:', err);
      this.webcamAtiva.set(false);
      this.carregandoHardware.set(false);
      this.cameraAtivaLabel.set('');
      this.webcamErro.set(
        'Erro ao acessar a webcam. Verifique as permissões e se o DroidCam está ativo.',
      );
      this.speech.falar('Erro ao acessar a câmera.');
    }
  }

  ativarCooldownPosAcesso(
    aprovado: boolean,
    duracaoMs = 5000,
  ): void {
    this.emCooldown.set(true);
    this.autoCapturaHabilitada.set(false);
    this.resetAutoCaptura();
    this.statusValidacao.set(
      aprovado
        ? 'Acesso liberado — aguardando próxima leitura RFID'
        : 'Acesso negado — aguardando próxima leitura RFID',
    );
    this.tipoStatus.set('info');
    this.faceBox.set(null);
    this.currentBox = null;

    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
    this.cooldownTimer = setTimeout(() => {
      this.emCooldown.set(false);
      this.statusValidacao.set('Aguardando cartão RFID');
      this.tipoStatus.set('info');
      this.ultimoEstadoEnquadramento = null;
      // Não reinicia a detecção automaticamente. Um novo fluxo RFID
      // deve criar uma tentativa antes da próxima captura facial.
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

        const fonteProcessamento = this.obterFonteProcessamento(video);
        const larguraProcessamento = this.larguraFrameProcessado() || video.videoWidth;

        // Checagem de Iluminação Reutilizando Buffer Canvas
        const brilhoMedio = this.calcularLuminanciaOtimizada(fonteProcessamento);
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
          .detectSingleFace(fonteProcessamento, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
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

        const proporcaoRosto = rawBox.width / larguraProcessamento;
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

  private atualizarDimensoesProcessamento(video: HTMLVideoElement): void {
    if (this.droidCamRetrato()) {
      this.larguraFrameProcessado.set(video.videoHeight);
      this.alturaFrameProcessado.set(video.videoWidth);
      return;
    }

    this.larguraFrameProcessado.set(video.videoWidth);
    this.alturaFrameProcessado.set(video.videoHeight);
  }

  private obterFonteProcessamento(
    video: HTMLVideoElement,
  ): HTMLVideoElement | HTMLCanvasElement {
    if (!this.droidCamRetrato()) {
      this.atualizarDimensoesProcessamento(video);
      return video;
    }

    const largura = video.videoHeight;
    const altura = video.videoWidth;

    if (
      this.frameProcessamentoCanvas.width !== largura
      || this.frameProcessamentoCanvas.height !== altura
    ) {
      this.frameProcessamentoCanvas.width = largura;
      this.frameProcessamentoCanvas.height = altura;
    }

    this.larguraFrameProcessado.set(largura);
    this.alturaFrameProcessado.set(altura);

    const ctx = this.frameProcessamentoCtx;
    if (!ctx) return video;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, largura, altura);
    ctx.translate(largura, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    ctx.restore();

    return this.frameProcessamentoCanvas;
  }

  private calcularLuminanciaOtimizada(fonte: CanvasImageSource): number {
    if (!this.lumaCtx) return 100;
    this.lumaCtx.drawImage(fonte, 0, 0, 64, 48);
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
    this.cameraAtivaLabel.set('');
    this.droidCamRetrato.set(false);
    this.larguraFrameProcessado.set(0);
    this.alturaFrameProcessado.set(0);
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

    const fonteProcessamento = this.obterFonteProcessamento(video);
    const canvas = document.createElement('canvas');
    canvas.width = this.larguraFrameProcessado() || video.videoWidth || 640;
    canvas.height = this.alturaFrameProcessado() || video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);

    // Mantém a experiência de espelho, mas a foto já sai orientada em retrato
    // quando a fonte ativa é DroidCam horizontal.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(fonteProcessamento, 0, 0, canvas.width, canvas.height);
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