import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SpeechService {
  private audio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private chaveAtual: string | null = null;
  private tempoInicioPlayback = 0;

  private readonly COOLDOWN_INSTRUCAO = 1200;

  private readonly mapaSons: Record<string, string> = {
    centralize: '/sounds/centralize-rosto.mp3',
    neutro: '/sounds/mantenha-expressao-neutra.mp3',
    sorriso: '/sounds/sorriso-detectado.mp3',
    sem_rosto: '/sounds/rosto-nao-detectado.mp3',
    olhos: '/sounds/olhos-fechados.mp3',
    liberado: '/sounds/acesso-liberado.mp3',
    negado: '/sounds/acesso-negado.mp3',
  };

  falar(mensagem: string, forcar: boolean = false): void {
    const chave = this.identificarChave(mensagem);
    if (!chave) return;

    const agora = Date.now();
    const tempoDecorrido = agora - this.tempoInicioPlayback;
    const ehPrioridadeAlta = chave === 'liberado' || chave === 'negado';

    if (this.chaveAtual === chave && !forcar && this.audio && !this.audio.ended) {
      return;
    }

    if (!ehPrioridadeAlta && !forcar && this.audio && !this.audio.ended && tempoDecorrido < this.COOLDOWN_INSTRUCAO) {
      return;
    }

    this.parar();

    this.chaveAtual = chave;
    this.tempoInicioPlayback = agora;
    const caminho = this.mapaSons[chave];

    if (caminho) {
      this.audio = new Audio(caminho);
      this.audio.volume = 1.0;
      this.audio.play().catch((err) => {
        console.warn('[SpeechService] MP3 falhou/bloqueado, acionando Bip:', err);
        this.tocarSomBiometrico(chave);
      });
    } else {
      this.tocarSomBiometrico(chave);
    }
  }

  private identificarChave(msg: string): string | null {
    const m = msg.toLowerCase();
    if (m.includes('liberado') || m.includes('seja bem-vindo')) return 'liberado';
    if (m.includes('negado') || m.includes('não corresponde')) return 'negado';
    if (m.includes('sorriso') || m.includes('sério')) return 'sorriso';
    if (m.includes('olhos') || m.includes('abertos')) return 'olhos';
    if (m.includes('não detectado')) return 'sem_rosto';
    if (m.includes('centralize')) return 'centralize';
    if (m.includes('neutra') || m.includes('expressão')) return 'neutro';
    return null;
  }

  parar(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    this.chaveAtual = null;
  }

  /** Bip ritmado ultra suave para a contagem regressiva de auto-captura (Audio Ticking) */
  tocarBipTick(): void {
    try {
      this.garantirAudioContext();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      this.emitirTom(1046.5, now, 0.04, 0.05); // Nota C6 bem curta e suave
    } catch {}
  }

  /** Bip de confirmação de disparo/foto realizada */
  tocarBipDisparo(): void {
    try {
      this.garantirAudioContext();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      this.emitirTom(1318.51, now, 0.08, 0.12); // Nota E6
    } catch {}
  }

  private garantirAudioContext(): void {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private tocarSomBiometrico(tipo: string): void {
    try {
      this.garantirAudioContext();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;

      if (tipo === 'liberado') {
        this.emitirTom(523.25, now, 0.1);
        this.emitirTom(659.25, now + 0.1, 0.1);
        this.emitirTom(783.99, now + 0.2, 0.2);
      } else if (tipo === 'negado' || tipo === 'sorriso' || tipo === 'sem_rosto') {
        this.emitirTom(300, now, 0.15);
        this.emitirTom(300, now + 0.2, 0.15);
      } else {
        this.emitirTom(880, now, 0.08);
      }
    } catch (e) {
      console.warn('Erro ao emitir bip sintético:', e);
    }
  }

  private emitirTom(frequencia: number, inicio: number, duracao: number, volume = 0.15): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequencia, inicio);
    gain.gain.setValueAtTime(volume, inicio);
    gain.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(inicio);
    osc.stop(inicio + duracao);
  }
}