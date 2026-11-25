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
  status(fatura: Fatura, hoje: string) {
    if (fatura.cancelada_em) return 'Cancelada';
    if (fatura.paga_em) return 'Paga';
    return fatura.vencimento < hoje ? 'Vencida' : 'Em aberto';
  }
}
