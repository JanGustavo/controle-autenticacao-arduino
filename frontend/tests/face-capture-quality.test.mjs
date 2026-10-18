import test from 'node:test';
import assert from 'node:assert/strict';
import { regiaoCentralRosto, inclinacaoDosOlhos } from '../src/app/services/face-capture-quality.ts';

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
});
