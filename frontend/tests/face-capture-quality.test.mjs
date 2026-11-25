import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularEAR,
  EstabilidadeOcular,
  inclinacaoDosOlhos,
  melhorFrameRecente,
  qualidadeDoFrame,
  regiaoCentralRosto,
} from '../src/app/services/face-capture-quality.ts';

test('mede dentro do rosto, independente do tamanho do fundo', () => {
  assert.deepEqual(regiaoCentralRosto({ x: 100, y: 50, width: 200, height: 300 }),
    { x: 140, y: 110, width: 120, height: 180 });
});
test('cabeça reta mantém orientação com olhos espelhados', () => {
  assert.equal(inclinacaoDosOlhos([{ x: 10, y: 30 }], [{ x: 50, y: 30 }]), 0);
  assert.equal(inclinacaoDosOlhos([{ x: 50, y: 30 }], [{ x: 10, y: 30 }]), 0);
});
test('inclinação excessiva é identificada mesmo com espelhamento', () => {
  for (const sinal of [-1, 1]) {
    assert.equal(inclinacaoDosOlhos([{ x: 0, y: 0 }], [{ x: 40 * sinal, y: 40 }]), 45);
  }
});
test('landmarks ausentes não liberam enquadramento', () => {
  assert.equal(inclinacaoDosOlhos([], []), 90);
  assert.equal(calcularEAR([]), 0);
});

test('um olho abaixo do limiar bloqueia por si só, mesmo com média alta', () => {
  const janela = new EstabilidadeOcular();
  assert.equal(janela.avaliar({ instante: 0, esquerdo: 0.25, direito: 0.36 }), 'fechados');
  assert.equal(janela.avaliar({ instante: 200, esquerdo: 0.36, direito: 0.25 }), 'fechados');
  assert.equal(janela.avaliar({ instante: 400, esquerdo: NaN, direito: 0.3 }), 'fechados');
  assert.equal(janela.avaliar({ instante: 600, esquerdo: 0.26, direito: 0.26 }), 'aguardando');
});

test('queda assimétrica acima do limiar reinicia a janela e exige recuperação contínua', () => {
  const janela = new EstabilidadeOcular();
  const avaliar = (instante, direito = 0.34) => janela.avaliar({ instante, esquerdo: 0.34, direito });
  for (const instante of [0, 200, 400, 600]) assert.equal(avaliar(instante), 'aguardando');
  assert.equal(avaliar(800), 'estavel');
  assert.equal(avaliar(1000, 0.32), 'estavel');
  assert.equal(avaliar(1200, 0.28), 'queda');
  for (const instante of [1400, 1600, 1800, 2000]) assert.equal(avaliar(instante), 'aguardando');
  assert.equal(avaliar(2200), 'estavel');
});

test('intervalo longo sem novos quadros invalida a estabilidade anterior', () => {
  const janela = new EstabilidadeOcular();
  const avaliar = (instante) => janela.avaliar({ instante, esquerdo: 0.31, direito: 0.31 });
  [0, 200, 400, 600].forEach(avaliar);
  assert.equal(avaliar(800), 'estavel');
  assert.equal(avaliar(1300), 'aguardando');
  assert.equal(avaliar(1500), 'aguardando');
});

test('busca o melhor quadro recente pela abertura do pior olho e pela inclinação', () => {
  const expirado = { instante: 100, qualidade: qualidadeDoFrame(0.42, 0.43, 0) };
  const melhor = { instante: 400, qualidade: qualidadeDoFrame(0.35, 0.36, 0) };
  const inclinado = { instante: 600, qualidade: qualidadeDoFrame(0.36, 0.37, 13) };
  const assimetrico = { instante: 1000, qualidade: qualidadeDoFrame(0.31, 0.45, 0) };
  assert.equal(melhorFrameRecente([expirado, melhor, inclinado, assimetrico], 1100), melhor);
  assert.equal(melhorFrameRecente([expirado], 1100), null);
  const empate = { ...melhor, instante: 800 };
  assert.equal(melhorFrameRecente([melhor, empate], 1100), empate);
});
