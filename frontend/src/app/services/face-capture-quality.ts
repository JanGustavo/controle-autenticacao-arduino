export interface Ponto { x: number; y: number }
interface Caixa extends Ponto { width: number; height: number }

// Evita cabelo, roupa e fundo na medição de luz. Coordenadas do frame real.
export function regiaoCentralRosto(rosto: Caixa): Caixa {
  return {
    x: rosto.x + rosto.width * 0.2,
    y: rosto.y + rosto.height * 0.2,
    width: rosto.width * 0.6,
    height: rosto.height * 0.6,
  };
}

export function inclinacaoDosOlhos(esquerdo: Ponto[], direito: Ponto[]): number {
  if (!esquerdo.length || !direito.length) return 90;
  const a = centroDosPontos(esquerdo);
  const b = centroDosPontos(direito);
  // Valor independente de espelhamento e da ordem dos olhos.
  return Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180 / Math.PI;
}

export function centroDosPontos(pontos: Ponto[]): Ponto {
  return {
    x: pontos.reduce((soma, ponto) => soma + ponto.x, 0) / pontos.length,
    y: pontos.reduce((soma, ponto) => soma + ponto.y, 0) / pontos.length,
  };
}

export function calcularEAR(olho: Ponto[]): number {
  if (olho.length !== 6) return 0;
  const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);
  const largura = distancia(olho[0], olho[3]);
  if (!largura) return 0;
  return (distancia(olho[1], olho[5]) + distancia(olho[2], olho[4])) / (2 * largura);
}

interface AmostraOcular {
  instante: number;
  esquerdo: number;
  direito: number;
}

export const INTERVALO_MAXIMO_ENTRE_FRAMES = 450;
const EAR_MINIMO = 0.26;
const QUEDA_EAR = 0.04;
const JANELA_QUEDA_MS = 450;
const DURACAO_ESTABILIDADE_MS = 750;
const MAX_AMOSTRAS_OCULARES = 5;

export class EstabilidadeOcular {
  private amostras: AmostraOcular[] = [];

  avaliar(amostra: AmostraOcular): 'fechados' | 'queda' | 'aguardando' | 'estavel' {
    const { instante, esquerdo, direito } = amostra;
    if (![esquerdo, direito].every((ear) => Number.isFinite(ear) && ear >= EAR_MINIMO)) {
      this.limpar();
      return 'fechados';
    }

    const anterior = this.amostras.at(-1);
    if (anterior && instante - anterior.instante > INTERVALO_MAXIMO_ENTRE_FRAMES) {
      this.limpar();
    }

    // Uma queda em qualquer olho pode indicar o início de uma piscada acima do limiar fixo.
    if (this.amostras.some((recente) => instante - recente.instante <= JANELA_QUEDA_MS &&
      (recente.esquerdo - esquerdo >= QUEDA_EAR || recente.direito - direito >= QUEDA_EAR))) {
      this.limpar();
      return 'queda';
    }

    this.amostras.push(amostra);
    if (this.amostras.length > MAX_AMOSTRAS_OCULARES) this.amostras.shift();

    return this.amostras.length >= 4 && instante - this.amostras[0].instante >= DURACAO_ESTABILIDADE_MS
      ? 'estavel'
      : 'aguardando';
  }

  limpar(): void {
    this.amostras.length = 0;
  }
}

export function qualidadeDoFrame(earEsquerdo: number, earDireito: number, inclinacao: number): number {
  return Math.min(earEsquerdo, earDireito) - inclinacao * 0.002;
}

export const JANELA_MELHOR_FRAME = 900;

export function melhorFrameRecente<T extends { instante: number; qualidade: number }>(
  frames: T[],
  agora: number,
): T | null {
  // Em empate, usa o mais novo. Os quadros chegam em ordem cronológica.
  return frames.reduce<T | null>((atual, frame) =>
    agora - frame.instante <= JANELA_MELHOR_FRAME && (!atual || frame.qualidade >= atual.qualidade)
      ? frame
      : atual, null);
}
