import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface Licenca {
  inicio: string; fim: string | null; situacao: string; dias_restantes: number | null;
  limite_usuarios: number | null; limite_dispositivos: number | null;
  limite_gestores: number | null; observacoes: string | null; plano_json: PlanoLicenca | null;
}
interface PlanoLicenca {
  schema_version: number; id: string; slug: string; name: string; badge: string;
  description: string; pricing: { amount: number; currency: string; interval: string; provider: string; provider_price_id: string | null };
  limits: { users: number | null; devices: number | null; managers: number | null }; features: string[];
  assignment: { status: string; assigned_at: string };
}
interface Contrato {
  id: number; plano: string; valor_mensal: number; inicio: string; fim: string | null;
}
interface Fatura {
  id: number; plano: string; valor: number; emitida_em: string; vencimento: string;
  paga_em: string | null; cancelada_em: string | null;
}
interface MinhaLicenca {
  instancia: { cliente: string; operacao: string; hospedagem: string; dominio: string | null; slug: string };
  licenca: Licenca | null; contratos: Contrato[]; proxima_fatura: Fatura | null;
  faturas: Fatura[]; data_referencia: string;
}

@Component({
  selector: 'app-licenca', standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './licenca.html', styleUrl: './licenca.scss',
})
export class LicencaPage implements OnInit {
  private http = inject(HttpClient);
  dados = signal<MinhaLicenca | null>(null);
  carregando = signal(false);
  erro = signal('');
  situacoes: Record<string, string> = {
    vigente: 'Vigente', agendada: 'Agendada', expirada: 'Expirada', revogada: 'Revogada',
  };
  ngOnInit() { this.carregar(); }
  carregar() {
    this.carregando.set(true);
    this.erro.set('');
    this.http.get<MinhaLicenca>('/plataforma/api/minha-licenca').subscribe({
      next: (dados) => { this.dados.set(dados); this.carregando.set(false); },
      error: () => {
        this.erro.set('Não foi possível consultar sua licença. Tente atualizar os dados.');
        this.carregando.set(false);
      },
    });
  }
  valor(valor: number) {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  data(valor: string) {
    return new Date(valor.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR');
  }
  /** Tom do selo da licença: vigente (ok), agendada (info), vencendo em até 30 dias (aviso), expirada ou revogada (erro). */
  tomLicenca(l: Licenca): 'ok' | 'info' | 'warn' | 'bad' {
    if (l.situacao === 'expirada' || l.situacao === 'revogada') return 'bad';
    if (l.situacao === 'agendada') return 'info';
    if (l.fim && l.dias_restantes !== null && l.dias_restantes <= 30) return 'warn';
    return 'ok';
  }
  /** Tom do selo da fatura, a partir da mesma regra de status(). */
  tomFatura(fatura: Fatura, hoje: string): 'ok' | 'info' | 'bad' | 'neutral' {
    const situacao = this.status(fatura, hoje);
    if (situacao === 'Paga') return 'ok';
    if (situacao === 'Vencida') return 'bad';
    if (situacao === 'Cancelada') return 'neutral';
    return 'info';
  }
  status(fatura: Fatura, hoje: string) {
    if (fatura.cancelada_em) return 'Cancelada';
    if (fatura.paga_em) return 'Paga';
    return fatura.vencimento < hoje ? 'Vencida' : 'Em aberto';
  }
}
