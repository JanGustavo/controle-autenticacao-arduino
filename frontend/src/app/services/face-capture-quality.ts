interface Ponto { x: number; y: number }
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
  const centro = (pontos: Ponto[]): Ponto => ({
    x: pontos.reduce((soma, p) => soma + p.x, 0) / pontos.length,
    y: pontos.reduce((soma, p) => soma + p.y, 0) / pontos.length,
  });
  const a = centro(esquerdo);
  const b = centro(direito);
  // Valor independente de espelhamento e da ordem dos olhos.
  return Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180 / Math.PI;
}
