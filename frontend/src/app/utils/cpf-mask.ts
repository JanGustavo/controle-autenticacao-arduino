export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits.replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2');
}

export function maskCpfInput(raw: string, caret: number, previous: string, inputType: string) {
  let digits = raw.replace(/\D/g, '').slice(0, 11);
  let before = raw.slice(0, caret).replace(/\D/g, '').length;
  // Ao apagar só um separador, remove também o dígito adjacente para não prender o cursor.
  if (raw !== previous && digits === previous.replace(/\D/g, '') && inputType.startsWith('delete')) {
    const index = inputType === 'deleteContentBackward' ? Math.max(0, before - 1) : before;
    digits = digits.slice(0, index) + digits.slice(index + 1);
    before = index;
  }
  const value = formatCpf(digits);
  let position = 0, count = 0;
  while (position < value.length && count < before) {
    if (/\d/.test(value[position])) count++;
    position++;
  }
  return { value, caret: position };
}
