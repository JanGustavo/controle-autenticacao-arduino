import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CaptureStationService {
  readonly clienteId = crypto.randomUUID();
  readonly ativa = signal(false);
  readonly carregando = signal(false);
  private http = inject(HttpClient);
  private sequence = 0;
  private revision = -1;

  atualizar(clienteId: string | null | undefined, revision: number): void {
    if (revision < this.revision) return;
    this.revision = revision;
    this.ativa.set(clienteId === this.clienteId);
  }

  async ativar(): Promise<void> {
    const sequence = ++this.sequence;
    this.carregando.set(true);
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    try {
      const state = await firstValueFrom(this.http.post<{cliente_id:string, capture_revision:number}>(
        `${local ? 'http://localhost:8001' : location.origin}/api/v1/captura/ativar`,
        { cliente_id: this.clienteId }));
      this.atualizar(state.cliente_id, state.capture_revision);
      if (!this.ativa()) throw new Error('Outro aparelho assumiu a captura.');
    } finally {
      if (sequence === this.sequence) this.carregando.set(false);
    }
  }
}
