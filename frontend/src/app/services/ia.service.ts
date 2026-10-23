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
  insights: {
    data_referencia: string;
    acessos_hoje: number;
    acessos_ontem: number;
    variacao_hoje: number | null;
    media_diaria_7_dias: number;
    acessos_7_dias: number;
    aceitos_7_dias: number;
    negados_7_dias: number;
    percentual_aceitos_7_dias: number;
    serie_7_dias: { dia: string; total: number; aceitos: number; negados: number }[];
  };
}

export interface RespostaIA {
  id: number;
  pergunta: string;
  resposta: string;
  criado_em: string;
}

@Injectable({ providedIn: 'root' })
export class IAService {
  private http = inject(HttpClient);
  private perguntaPendente: string | null = null;
  private base =
    (['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'http://localhost:8001'
      : window.location.origin) + '/api/v1/ia';

  resumo() {
    return this.http.get<ResumoIA>(`${this.base}/resumo`);
  }

  perguntar(pergunta: string) {
    return this.http.post<{ resposta: string; resumo: ResumoIA; item: RespostaIA }>(`${this.base}/perguntar`, { pergunta });
  }

  historico() {
    return this.http.get<RespostaIA[]>(`${this.base}/historico`);
  }

  apagar(itemId: number) {
    return this.http.delete<void>(`${this.base}/historico/${itemId}`);
  }

  atualizar(itemId: number) {
    return this.http.post<{ resposta: string; resumo: ResumoIA; item: RespostaIA }>(
      `${this.base}/historico/${itemId}/atualizar`, {},
    );
  }

  prepararPergunta(pergunta: string): void {
    this.perguntaPendente = pergunta;
  }

  consumirPergunta(): string | null {
    const pergunta = this.perguntaPendente;
    this.perguntaPendente = null;
    return pergunta;
  }
}
