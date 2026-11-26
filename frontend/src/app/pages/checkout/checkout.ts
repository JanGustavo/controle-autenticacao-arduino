import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import {
  ApiService,
  CheckoutValidacaoRequest,
  CheckoutValidacaoResponse,
  PlanoItem,
} from '../../services/api.service';

const PLANOS_FALLBACK: PlanoItem[] = [
  {
    id: 'basico',
    nome: 'Básico',
    slug: 'basico',
    badge: 'Início Rápido',
    preco_mensal: 149,
    preco_formatado: 'R$ 149',
    periodo: '/mês',
    descricao: 'Ideal para pequenas salas, estoques ou controle de entrada única.',
    dispositivos: 1,
    usuarios: 50,
    tipo_suporte: 'Suporte e manutenção padrão (horário comercial)',
    destaque: false,
    decoy: false,
    vantagens: [
      { texto: '1 dispositivo (controladora ESP32 / RFID)', icone: 'memory', incluido: true },
      { texto: 'Até 50 usuários cadastrados', icone: 'groups', incluido: true },
      { texto: 'Biometria facial 1:1 e cartão RFID', icone: 'face', incluido: true },
      { texto: 'Suporte médio por chamado e e-mail', icone: 'support_agent', incluido: true },
      { texto: 'Suporte de manutenção padrão', icone: 'build', incluido: true },
      { texto: 'Histórico de acessos dos últimos 30 dias', icone: 'history', incluido: true },
      { texto: 'Sem acesso prioritário ou visita presencial', icone: 'close', destaque: false, incluido: false },
    ],
  },
  {
    id: 'intermediario',
    nome: 'Profissional',
    slug: 'profissional',
    badge: 'Intermediário',
    preco_mensal: 329,
    preco_formatado: 'R$ 329',
    periodo: '/mês',
    descricao: 'Para operações em crescimento que precisam de mais de um ponto de acesso.',
    dispositivos: 4,
    usuarios: 150,
    tipo_suporte: 'Suporte médio',
    destaque: false,
    decoy: true,
    vantagens: [
      { texto: 'Até 4 dispositivos integrados', icone: 'developer_board', incluido: true },
      { texto: 'Até 150 usuários cadastrados', icone: 'groups', incluido: true },
      { texto: 'Biometria facial e regras de horários', icone: 'verified_user', incluido: true },
      { texto: 'Suporte médio comercial', icone: 'support_agent', incluido: true },
      { texto: 'Manutenção remota sob agendamento', icone: 'build', incluido: true },
      { texto: 'Sem suporte presencial emergencial', icone: 'close', destaque: false, incluido: false },
    ],
  },
  {
    id: 'premium',
    nome: 'Avançado Empresarial',
    slug: 'avancado-empresarial',
    badge: 'Mais Escolhido',
    preco_mensal: 389,
    preco_formatado: 'R$ 389',
    periodo: '/mês',
    descricao: 'Solução completa com infraestrutura garantida e deslocamento da equipe para conserto presencial.',
    dispositivos: 7,
    usuarios: 500,
    tipo_suporte: 'Suporte prioritário 24/7 com equipe on-site',
    destaque: true,
    decoy: false,
    vantagens: [
      { texto: 'Até 7 dispositivos (ESP32/Arduino) simultâneos', icone: 'router', destaque: true, incluido: true },
      { texto: 'Até 500 usuários ativos e visitantes', icone: 'badge', destaque: true, incluido: true },
      {
        texto: 'Suporte prioritário com equipe técnica presencial: reparo e troca de peças/Arduinos on-site',
        icone: 'engineering',
        destaque: true,
        incluido: true,
      },
      { texto: 'Canal VIP de atendimento 24/7 (WhatsApp e Telefone)', icone: 'headset_mic', destaque: true, incluido: true },
      { texto: 'Assistente iArdLock com Inteligência Artificial incluso', icone: 'psychology', destaque: true, incluido: true },
      { texto: 'Auditoria detalhada e histórico ilimitado em tempo real', icone: 'analytics', destaque: true, incluido: true },
      { texto: 'Painel de múltiplos gestores com permissões granulares', icone: 'admin_panel_settings', destaque: true, incluido: true },
    ],
  },
  {
    id: 'personalizado',
    nome: 'Personalizado',
    slug: 'personalizado',
    badge: 'Sob Demanda',
    preco_mensal: 0,
    preco_formatado: 'Sob Demanda',
    periodo: '',
    descricao: 'Para indústrias, universidades ou condomínios que demandam projeto de infraestrutura sob medida.',
    dispositivos: 'Ilimitados / Projeto customizado',
    usuarios: 'Ilimitados',
    tipo_suporte: 'SLA sob medida e gerente de conta dedicado',
    destaque: false,
    decoy: false,
    email_contato: 'janderson.gustavo1@gmail.com',
    vantagens: [
      { texto: 'Quantidade ilimitada de dispositivos e catracas', icone: 'all_inclusive', incluido: true },
      { texto: 'Sem limite de usuários cadastrados', icone: 'groups_3', incluido: true },
      { texto: 'Desenvolvimento de integrações e firmwares dedicados', icone: 'code', incluido: true },
      { texto: 'SLA de resposta contratual e visitas periódicas', icone: 'verified', incluido: true },
      { texto: 'Gerente de conta exclusivo e canal direto', icone: 'contact_support', incluido: true },
      { texto: 'Contato direto: janderson.gustavo1@gmail.com', icone: 'email', destaque: true, incluido: true },
    ],
  },
];

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class CheckoutPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly planos = signal<PlanoItem[]>(PLANOS_FALLBACK);
  readonly carregando = signal(false);
  readonly processando = signal(false);
  readonly planoSelecionado = signal<PlanoItem>(PLANOS_FALLBACK[2]); // Plano 3 por padrão (melhor conversão)
  readonly transacaoConcluida = signal<CheckoutValidacaoResponse | null>(null);
  readonly erroValidacao = signal<string | null>(null);
  readonly temaEscuro = signal(document.body.classList.contains('dark-mode'));

  alternarTema(): void {
    const botao = document.querySelector<HTMLButtonElement>('app-navbar .theme-btn');
    if (botao) {
      botao.click();
    } else {
      const escuro = document.body.classList.toggle('dark-mode');
      localStorage.setItem('theme', escuro ? 'dark' : 'light');
    }
    this.temaEscuro.set(document.body.classList.contains('dark-mode'));
  }

  // Formulário estático de checkout
  nomeOrganizacao = '';
  emailGestor = '';
  documento = '';
  formaPagamento: 'cartao' | 'pix' | 'boleto' = 'cartao';
  numeroCartao = '•••• •••• •••• 4242';
  validadeCartao = '12/28';
  cvvCartao = '•••';

  readonly emailDemanda = 'janderson.gustavo1@gmail.com';

  ngOnInit(): void {
    this.carregarPlanos();
  }

  carregarPlanos(): void {
    this.carregando.set(true);
    this.api.obterPlanos().subscribe({
      next: (lista) => {
        if (lista && lista.length) {
          this.planos.set(lista);
          // Verificar se veio query param indicando plano
          const planoParam = this.route.snapshot.queryParamMap.get('plano');
          if (planoParam) {
            const achado = lista.find(
              (p) => p.id === planoParam || p.slug === planoParam,
            );
            if (achado) {
              this.selecionarPlano(achado);
            }
          } else {
            // Garantir que o plano 3 (destaque) esteja selecionado
            const destaque = lista.find((p) => p.destaque) || lista[2] || lista[0];
            this.planoSelecionado.set(destaque);
          }
        }
        this.carregando.set(false);
      },
      error: () => {
        // Mantém fallback seguro
        this.carregando.set(false);
      },
    });
  }

  selecionarPlano(plano: PlanoItem): void {
    this.planoSelecionado.set(plano);
    this.transacaoConcluida.set(null);
    this.erroValidacao.set(null);

    if (plano.id !== 'personalizado') {
      setTimeout(() => {
        const elemento = document.getElementById('painel-checkout');
        if (elemento) {
          elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 80);
    }
  }

  obterLinkEmail(plano: PlanoItem): string {
    const assunto = encodeURIComponent(`Solicitação de Proposta - Plano ${plano.nome} ArdLock`);
    const corpo = encodeURIComponent(
      `Olá Janderson,\n\nTenho interesse em contratar o plano ${plano.nome} para a nossa empresa/operação.\n\nGostaria de mais detalhes sobre implementação, suporte de infraestrutura e prazos.\n\nNome:\nEmpresa:\nTelefone:\nQuantidade estimada de portas/dispositivos:`,
    );
    return `mailto:${this.emailDemanda}?subject=${assunto}&body=${corpo}`;
  }

  confirmarCheckout(): void {
    const plano = this.planoSelecionado();
    if (!plano) return;

    if (plano.id === 'personalizado') {
      window.location.href = this.obterLinkEmail(plano);
      return;
    }

    if (!this.nomeOrganizacao.trim() || !this.emailGestor.trim()) {
      this.erroValidacao.set('Por favor, informe o nome da sua organização e o e-mail do gestor.');
      return;
    }

    this.processando.set(true);
    this.erroValidacao.set(null);

    const payload: CheckoutValidacaoRequest = {
      plano_id: plano.id,
      nome_organizacao: this.nomeOrganizacao.trim(),
      email_gestor: this.emailGestor.trim(),
      documento: this.documento.trim() || undefined,
      forma_pagamento: this.formaPagamento,
      valor_esperado: plano.preco_mensal,
    };

    this.api.validarTransacaoCheckout(payload).subscribe({
      next: (resposta) => {
        this.processando.set(false);
        this.transacaoConcluida.set(resposta);
      },
      error: (err) => {
        this.processando.set(false);
        const detalhe =
          err?.error?.detail ||
          'Não foi possível concluir a validação da transação com o servidor. Verifique os dados e tente novamente.';
        this.erroValidacao.set(detalhe);
      },
    });
  }

  novaSimulacao(): void {
    this.transacaoConcluida.set(null);
    this.erroValidacao.set(null);
  }
}
