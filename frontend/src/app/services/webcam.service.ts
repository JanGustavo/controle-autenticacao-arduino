import { Injectable, inject, signal, ElementRef } from '@angular/core';
import * as faceapi from '@vladmandic/face-api';
import { SpeechService } from './speech.service';
import { abrirCameraPreferida } from './camera-selection';
import {
  calcularEAR,
  centroDosPontos,
  EstabilidadeOcular,
  inclinacaoDosOlhos,
  INTERVALO_MAXIMO_ENTRE_FRAMES,
  JANELA_MELHOR_FRAME,
  melhorFrameRecente,
  qualidadeDoFrame,
  regiaoCentralRosto,
  type Ponto,
} from './face-capture-quality';

type EstadoEnquadramento = 'ok' | 'sem_rosto' | 'sorriso' | 'olhos' | null;

export interface FaceBoxPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FrameValidado {
  canvas: HTMLCanvasElement;
  instante: number;
  qualidade: number;
}

const INTERVALO_ANALISE = 200;
const TEMPO_AUTO_CAPTURA = 2100;

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

  faceBox = signal<FaceBoxPosition | null>(null);
  pontosFaciais = signal<Ponto[]>([]);

  // Totem: Progresso de Auto-captura, Cooldown e Flash
  progressoAutoCaptura = signal(0);
  dispararFlash = signal(false);
  nivelIluminacao = signal<'boa' | 'baixa'>('boa');
  emCooldown = signal(false);

  modoDebug = signal(false);

  // Modo auto-captura
  autoCapturaHabilitada = signal(false);
  private onAutoCapturaCallback: (() => void) | null = null;

  // ── Estado público ────────────────────────────────────────────────
  stream: MediaStream | null = null;

  // ── Estado privado e Otimização de Performance ────────────────────
  private intervalValidacao: ReturnType<typeof setInterval> | null = null;
  private modelosCarregados = false;
  private modelosPromise: Promise<void> | null = null;
  private aberturaId = 0;
  private validacaoId = 0;
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

  private readonly estabilidadeOcular = new EstabilidadeOcular();
  private framesValidados: FrameValidado[] = [];
  private canvasesDisponiveis: HTMLCanvasElement[] = [];
  private primeiroFrameValido: number | null = null;
  private ultimoFrameValido: number | null = null;
  private ultimoTickTimestamp = 0;

  // Cooldown pós-acesso
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.lumaCanvas.width = 64;
    this.lumaCanvas.height = 48;
    this.lumaCtx = this.lumaCanvas.getContext('2d', { willReadFrequently: true });
  }

  carregarModelos(): Promise<void> {
    if (this.modelosCarregados) return Promise.resolve();
    if (this.modelosPromise) return this.modelosPromise;
    this.modelosPromise = this.prepararModelos().catch((erro) => {
      this.modelosPromise = null;
      throw erro;
    });
    return this.modelosPromise;
  }

  private async prepararModelos(): Promise<void> {
    if (faceapi.tf && 'setBackend' in faceapi.tf) {
      await (faceapi.tf as any).setBackend('webgl')
        .catch(() => (faceapi.tf as any).setBackend('cpu'));
    }
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceExpressionNet.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    ]);
    // Compila os shaders antes da primeira leitura, inclusive no celular.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 224;
    await faceapi.detectSingleFace(canvas,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
      .withFaceLandmarks().withFaceExpressions();
    this.modelosCarregados = true;
  }

  async iniciarWebcam(
    getVideoElement: () => ElementRef<HTMLVideoElement> | undefined,
    enableAutoCaptura: boolean = false,
    onAutoCaptura?: () => void
  ): Promise<void> {
    if (this.stream || this.carregandoHardware()) this.pararWebcam();
    const aberturaId = ++this.aberturaId;
    this.webcamErro.set('');
    this.carregandoHardware.set(true);
    this.capturaPronta.set(false);
    this.statusValidacao.set('Iniciando câmera e sensores...');
    this.tipoStatus.set('info');
    this.autoCapturaHabilitada.set(enableAutoCaptura);
    this.onAutoCapturaCallback = onAutoCaptura || null;
    this.resetAutoCaptura();

    try {
      await this.carregarModelos();
      if (aberturaId !== this.aberturaId) return;

      const streamInicial = await abrirCameraPreferida(navigator.mediaDevices);
      if (aberturaId !== this.aberturaId) {
        streamInicial.getTracks().forEach((track) => track.stop());
        return;
      }

      this.stream = streamInicial;
      const trackAtivo = streamInicial.getVideoTracks()[0];
      const settingsAtivos = trackAtivo?.getSettings();

      this.cameraAtivaLabel.set(trackAtivo?.label || 'Câmera padrão');

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
            if (aberturaId !== this.aberturaId) {
              reject(new Error('Abertura de câmera cancelada.'));
              return;
            }
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
      if (aberturaId !== this.aberturaId) return;
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

        const concluir = () => {
          clearTimeout(timeout);
          videoEl.removeEventListener('loadedmetadata', concluir);
          videoEl.removeEventListener('canplay', concluir);
          resolve();
        };

        const timeout = setTimeout(concluir, 5000);
        videoEl.addEventListener('loadedmetadata', concluir);
        videoEl.addEventListener('canplay', concluir);
      });
      if (aberturaId !== this.aberturaId) return;

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
          ? 'DroidCam retrato (90° anti-horário)'
          : 'normal',
        '| Frame IA:',
        this.larguraFrameProcessado(),
        'x',
        this.alturaFrameProcessado(),
      );

      this.iniciarLoopValidacao();
    } catch (err) {
      if (aberturaId !== this.aberturaId) return;
      this.pararWebcam();
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

  private iniciarLoopValidacao(): void {
    this.pararLoopValidacao();
    this.ultimoEstadoEnquadramento = null;
    const validacaoId = this.validacaoId;
    let ultimoTempoVideo = -1;
    let ultimoTotalFrames = -1;

    this.intervalValidacao = setInterval(async () => {
      const video = this.videoElementRef?.nativeElement;
      if (this.processandoDeteccao || !this.webcamAtiva() || !video || this.emCooldown()) {
        return;
      }

      if (video.paused || video.ended || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        this.rejeitarEnquadramento('Aguardando imagem da câmera');
        this.suavizarRostoPerdido();
        return;
      }

      const instante = performance.now();
      if (this.ultimoFrameValido !== null &&
          instante - this.ultimoFrameValido > INTERVALO_MAXIMO_ENTRE_FRAMES) {
        this.rejeitarEnquadramento('Aguardando novos quadros da câmera');
        this.suavizarRostoPerdido();
      }

      const totalFrames = video.getVideoPlaybackQuality().totalVideoFrames;
      if (totalFrames > 0 ? totalFrames === ultimoTotalFrames : video.currentTime === ultimoTempoVideo) return;
      ultimoTotalFrames = totalFrames;
      ultimoTempoVideo = video.currentTime;

      this.processandoDeteccao = true;
      try {
        // A inferência e a foto leem o mesmo quadro, mesmo se o vídeo avançar.
        const fonte = this.obterFonteProcessamento(video);
        const detection = await faceapi
          .detectSingleFace(fonte, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceLandmarks()
          .withFaceExpressions();
        if (validacaoId !== this.validacaoId || this.emCooldown()) return;

        if (!detection) {
          this.rejeitarEnquadramento('Rosto não detectado', 'sem_rosto', 'Rosto não detectado. Centralize-se na câmera.');
          this.suavizarRostoPerdido();
          return;
        }

        const caixa = detection.detection.box;
        this.atualizarFaceBoxSuavizada(caixa);
        this.pontosFaciais.set([]);

        const brilho = this.calcularLuminanciaOtimizada(fonte, caixa);
        this.nivelIluminacao.set(brilho < 30 || brilho > 235 ? 'baixa' : 'boa');
        if (brilho < 30 || brilho > 235) {
          this.rejeitarEnquadramento(brilho < 30
            ? 'Ilumine o rosto pela frente'
            : 'Evite luz direta forte no rosto');
          return;
        }

        const proporcao = caixa.width / fonte.width;
        if (proporcao < 0.18 || proporcao > 0.70) {
          this.rejeitarEnquadramento(proporcao < 0.18 ? 'Aproxime-se da câmera' : 'Afaste-se um pouco');
          return;
        }

        const centroX = (caixa.x + caixa.width / 2) / fonte.width;
        const centroY = (caixa.y + caixa.height / 2) / fonte.height;
        if (Math.abs(centroX - 0.5) > 0.28 || Math.abs(centroY - 0.5) > 0.28) {
          this.rejeitarEnquadramento('Centralize o rosto na câmera');
          return;
        }

        const olhoEsq = detection.landmarks.getLeftEye();
        const olhoDir = detection.landmarks.getRightEye();
        const inclinacao = inclinacaoDosOlhos(olhoEsq, olhoDir);
        if (inclinacao > 20) {
          this.rejeitarEnquadramento('Mantenha a cabeça reta e olhe para a câmera');
          return;
        }

        if (detection.expressions.happy > 0.6) {
          this.rejeitarEnquadramento('Mantenha uma expressão neutra', 'sorriso', 'Por favor, mantenha uma expressão neutra.');
          return;
        }

        const esquerdo = calcularEAR(olhoEsq);
        const direito = calcularEAR(olhoDir);
        const estabilidade = this.estabilidadeOcular.avaliar({ instante, esquerdo, direito });

        if (estabilidade === 'fechados' || estabilidade === 'queda') {
          this.rejeitarEnquadramento(
            'Mantenha os olhos abertos',
            'olhos',
            estabilidade === 'fechados' ? 'Mantenha os olhos abertos.' : undefined,
          );
          return;
        }

        this.pontosFaciais.set([
          centroDosPontos(olhoEsq),
          centroDosPontos(olhoDir),
          detection.landmarks.getNose()[3],
        ]);

        this.primeiroFrameValido ??= instante;
        this.ultimoFrameValido = instante;
        const tempoValido = instante - this.primeiroFrameValido;
        const estavel = estabilidade === 'estavel';
        const auto = this.autoCapturaHabilitada();
        this.capturaPronta.set(estavel && !auto);
        this.statusValidacao.set(estavel ? 'Rosto estável' : 'Olhe para a câmera');
        this.tipoStatus.set(estavel ? 'success' : 'info');
        if (estavel) this.ultimoEstadoEnquadramento = 'ok';

        if (estavel && (!auto || tempoValido >= TEMPO_AUTO_CAPTURA - JANELA_MELHOR_FRAME)) {
          this.guardarFrame(fonte, instante, qualidadeDoFrame(esquerdo, direito, inclinacao));
        }
        if (auto) this.atualizarAutoCaptura(tempoValido, instante, estavel);
      } catch (erro) {
        if (validacaoId !== this.validacaoId) return;
        console.warn('[Webcam] Falha ao analisar quadro:', erro);
        this.rejeitarEnquadramento('Aguardando imagem da câmera');
        this.suavizarRostoPerdido();
      } finally {
        this.processandoDeteccao = false;
      }
    }, INTERVALO_ANALISE);
  }

  private rejeitarEnquadramento(
    mensagem: string,
    estado: EstadoEnquadramento = null,
    avisoFalado?: string,
  ): void {
    this.capturaPronta.set(false);
    this.statusValidacao.set(mensagem);
    this.tipoStatus.set('warn');
    this.resetAutoCaptura();

    if (avisoFalado && this.ultimoEstadoEnquadramento !== estado) {
      this.speech.falar(avisoFalado);
    }
    this.ultimoEstadoEnquadramento = estado;
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
    this.pontosFaciais.set([]);
  }

  private atualizarAutoCaptura(tempoValido: number, instante: number, estavel: boolean): void {
    const podeDisparar = estavel && this.framesValidados.length > 0 && tempoValido >= TEMPO_AUTO_CAPTURA;
    const progresso = podeDisparar
      ? 100
      : Math.min(estavel ? 99 : 29, Math.floor(100 * tempoValido / TEMPO_AUTO_CAPTURA));
    this.progressoAutoCaptura.set(progresso);

    if (podeDisparar) {
      this.capturaPronta.set(true);
      this.onAutoCapturaCallback?.();
    } else if (progresso > 0 && instante - this.ultimoTickTimestamp >= 450) {
      this.speech.tocarBipTick();
      this.ultimoTickTimestamp = instante;
    }
  }

  private guardarFrame(fonte: HTMLCanvasElement, instante: number, qualidade: number): void {
    while (this.framesValidados.length && instante - this.framesValidados[0].instante > JANELA_MELHOR_FRAME) {
      this.canvasesDisponiveis.push(this.framesValidados.shift()!.canvas);
    }
    const canvas = this.canvasesDisponiveis.pop() ?? document.createElement('canvas');
    if (canvas.width !== fonte.width) canvas.width = fonte.width;
    if (canvas.height !== fonte.height) canvas.height = fonte.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(fonte, 0, 0);
    this.framesValidados.push({ canvas, instante, qualidade });
  }

  private resetAutoCaptura(): void {
    this.estabilidadeOcular.limpar();
    this.canvasesDisponiveis.push(...this.framesValidados.map(({ canvas }) => canvas));
    this.framesValidados.length = 0;
    this.primeiroFrameValido = null;
    this.ultimoFrameValido = null;
    this.ultimoTickTimestamp = 0;
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

  private obterFonteProcessamento(video: HTMLVideoElement): HTMLCanvasElement {
    this.atualizarDimensoesProcessamento(video);
    const largura = this.larguraFrameProcessado();
    const altura = this.alturaFrameProcessado();
    const canvas = this.frameProcessamentoCanvas;
    if (canvas.width !== largura || canvas.height !== altura) {
      this.capturaPronta.set(false);
      this.resetAutoCaptura();
      this.suavizarRostoPerdido();
    }
    if (canvas.width !== largura) canvas.width = largura;
    if (canvas.height !== altura) canvas.height = altura;

    const ctx = this.frameProcessamentoCtx;
    if (!ctx) throw new Error('Canvas de processamento indisponível.');
    if (this.droidCamRetrato()) {
      ctx.setTransform(0, -1, 1, 0, 0, altura);
    }
    try {
      ctx.drawImage(video, 0, 0);
    } finally {
      ctx.resetTransform();
    }
    return canvas;
  }

  private calcularLuminanciaOtimizada(fonte: CanvasImageSource, rosto: FaceBoxPosition): number {
    if (!this.lumaCtx) return 100;
    const area = regiaoCentralRosto(rosto);
    this.lumaCtx.drawImage(fonte, area.x, area.y, area.width, area.height, 0, 0, 64, 48);
    const imgData = this.lumaCtx.getImageData(0, 0, 64, 48);
    const data = imgData.data;
    let somaLuma = 0;

    for (let i = 0; i < data.length; i += 4) {
      somaLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return somaLuma / (data.length / 4);
  }

  private pararLoopValidacao(): void {
    this.validacaoId++;
    if (this.intervalValidacao) {
      clearInterval(this.intervalValidacao);
      this.intervalValidacao = null;
    }
    this.capturaPronta.set(false);
    this.resetAutoCaptura();
    this.canvasesDisponiveis.length = 0;
    this.suavizarRostoPerdido();
  }

  pararWebcam(): void {
    this.aberturaId++;
    this.carregandoHardware.set(false);
    this.pararLoopValidacao();
    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
    this.speech.parar();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.frameProcessamentoCanvas.width = 0;
    this.frameProcessamentoCanvas.height = 0;
    this.webcamAtiva.set(false);
    this.autoCapturaHabilitada.set(false);
    this.dispararFlash.set(false);
    this.cameraAtivaLabel.set('');
    this.droidCamRetrato.set(false);
    this.larguraFrameProcessado.set(0);
    this.alturaFrameProcessado.set(0);
    this.videoElementRef = null;
    this.onAutoCapturaCallback = null;
    this.emCooldown.set(false);
  }

  private executarEfeitoFlash(): void {
    const aberturaId = this.aberturaId;
    this.dispararFlash.set(true);
    setTimeout(() => {
      if (aberturaId === this.aberturaId) this.dispararFlash.set(false);
    }, 150);
  }

  async capturarFrameComPreview(): Promise<{ blob: Blob; previewUrl: string } | null> {
    if (!this.webcamAtiva() || !this.capturaPronta() || this.emCooldown()) return null;
    const agora = performance.now();
    if (this.ultimoFrameValido === null ||
        agora - this.ultimoFrameValido > INTERVALO_MAXIMO_ENTRE_FRAMES) return null;

    const melhor = melhorFrameRecente(this.framesValidados, agora);
    if (!melhor) return null;

    const aberturaId = this.aberturaId;
    this.pararLoopValidacao();
    this.statusValidacao.set('Preparando a foto');
    this.tipoStatus.set('info');
    if (this.autoCapturaHabilitada()) this.speech.tocarBipDisparo();
    this.executarEfeitoFlash();

    try {
      const canvas = document.createElement('canvas');
      canvas.width = melhor.canvas.width;
      canvas.height = melhor.canvas.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas de captura indisponível.');

      // Preserva o espelhamento e a orientação da foto enviada ao backend.
      ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
      ctx.drawImage(melhor.canvas, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob) throw new Error('Não foi possível gerar a foto.');
      if (aberturaId !== this.aberturaId) return null;

      const previewUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      return aberturaId === this.aberturaId ? { blob, previewUrl } : null;
    } catch (erro) {
      if (aberturaId !== this.aberturaId) return null;
      console.warn('[Webcam] Falha ao preparar captura:', erro);
      this.rejeitarEnquadramento('Não foi possível preparar a foto. Tente novamente.');
      this.iniciarLoopValidacao();
      return null;
    }
  }
}
