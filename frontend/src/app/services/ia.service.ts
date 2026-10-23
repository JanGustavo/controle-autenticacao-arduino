import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface UsuarioIA {
  id: number;
  nome: string;
  ativo: boolean;
  total: number;
  aceitos: number;
  negados: number;
  percentual_aceitos: number;
  percentual_negados: number;
}

export interface ResumoIA {
  usuarios: UsuarioIA[];
  total_usuarios: number;
  total_acessos: number;
  aceitos: number;
  negados: number;
  percentual_aceitos: number;
  percentual_negados: number;
}

@Injectable({ providedIn: 'root' })
export class IAService {
  private http = inject(HttpClient);
  private base =
    (['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'http://localhost:8001'
      : window.location.origin) + '/api/v1/ia';

  resumo() {
    return this.http.get<ResumoIA>(`${this.base}/resumo`);
  }

  perguntar(pergunta: string) {
    return this.http.post<{ resposta: string; resumo: ResumoIA }>(`${this.base}/perguntar`, { pergunta });
  }
}
