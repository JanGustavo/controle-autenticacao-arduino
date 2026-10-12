import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCpf, maskCpfInput } from '../src/app/utils/cpf-mask.ts';
test('formata progressivamente nos limites dos grupos', () => {
  for (const [input, expected] of [['123','123'],['1234','123.4'],['1234567','123.456.7'],['1234567890','123.456.789-0'],['12345678901','123.456.789-01']]) assert.equal(formatCpf(input),expected);
});
test('normaliza colagem com espaços e pontuação e limita a onze dígitos',()=> {
 assert.equal(formatCpf(' 123 . 456 789 - 01 abc '),'123.456.789-01');
 assert.equal(formatCpf('123456789012345'),'123.456.789-01');
 assert.equal(formatCpf('abc'),'');
});
test('preserva cursor ao inserir no meio',()=> {
 assert.deepEqual(maskCpfInput('123.945.678-01',5,'123.456.780-1','insertText'),{value:'123.945.678-01',caret:5});
});
test('permite apagar separadores com backspace e delete',()=> {
 assert.deepEqual(maskCpfInput('123456',3,'123.456','deleteContentBackward'),{value:'124.56',caret:2});
 assert.deepEqual(maskCpfInput('123456',3,'123.456','deleteContentForward'),{value:'123.56',caret:3});
});
