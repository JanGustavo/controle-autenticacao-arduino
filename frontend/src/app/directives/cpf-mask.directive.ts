import { Directive, ElementRef, forwardRef, HostListener, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { formatCpf, maskCpfInput } from '../utils/cpf-mask';

@Directive({
  selector: 'input[appCpfMask]', standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CpfMaskDirective), multi: true }],
})
export class CpfMaskDirective implements ControlValueAccessor {
  private input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private previous = '';
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  writeValue(value: string | null): void { this.previous = formatCpf(value ?? ''); this.input.value = this.previous; }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.input.disabled = disabled; }
  @HostListener('blur') blur(): void { this.onTouched(); }
  @HostListener('input', ['$event']) inputChanged(event: InputEvent): void {
    if (event.isComposing) return;
    const raw = this.input.value;
    const result = maskCpfInput(raw, this.input.selectionStart ?? raw.length, this.previous, event.inputType ?? '');
    this.input.value = result.value;
    this.input.setSelectionRange(result.caret, result.caret);
    this.previous = result.value;
    this.onChange(result.value);
    if (raw !== result.value && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.input.animate([{ boxShadow: '0 0 0 2px rgba(37,99,235,.25)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 180 });
    }
  }
}
