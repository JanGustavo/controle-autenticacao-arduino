import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService, HistoricoAcessoResponse } from '../../services/api.service';
import { WebSocketLogsService } from '../../services/websocket-logs.service';

type EstadoCarga = 'carregando' | 'pronto' | 'erro';
type EtapaId = 'locais' | 'dispositivos' | 'usuarios' | 'permissoes';

interface EtapaPreparacao {
  id: EtapaId;
  path: string;
  icon: string;
  titulo: string;
  /** Texto exibido enquanto não há registros. */
  pendente: string;
  acao: string;
  singular: string;
  plural: string;
}

interface Tentativa {
  id: number;
  dataHora: string;
  autorizado: boolean;
  usuario: string;
  local: string;
  motivo: string | null;
  /** Registro recebido em tempo real nesta sessão. */
  nova: boolean;
}

const LIMITE_TENTATIVAS = 6;

@Component({
  selector: 'app-adm-page',
  standalone: true,
  imports: [DatePipe, MatIconModule, RouterLink],
  templateUrl: './adm-page.html',
  styleUrl: './adm-page.scss',
})
export class AdmPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly wsLogs = inject(WebSocketLogsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly grupos = [
    {
      title: 'Operação',
      description: 'Prepare e acompanhe o fluxo de acesso.',
      links: [
        {
          path: '/usuarios',
          title: 'Usuários',
          description: 'Gerenciar dados, cartões e biometria',
          icon: 'group',
          tone: 'users',
        },
        {
          path: '/permissoes',
          title: 'Permissões',
          description: 'Definir locais, dias e horários',
          icon: 'vpn_key',
          tone: 'permissions',
        },
        {
          path: '/validar-acesso',
          title: 'Validar acesso',
          description: 'Confirmar cartão e rosto do titular',
          icon: 'face',
          tone: 'validation',
        },
        {
          path: '/dashboard',
          title: 'Histórico de acesso',
          description: 'Consultar tentativas e resultados',
          icon: 'history',
          tone: 'history',
        },
        {
          path: '/ia',
          title: 'iArdLock',
          description: 'Perguntar sobre usuários e resultados de acesso',
          icon: 'auto_awesome',
          tone: 'ai',
        },
      ],
    },
    {
      title: 'Configuração e gestão',
      description: 'Organize a infraestrutura e as contas administrativas.',
      links: [
        {
          path: '/locais',
          title: 'Locais',
          description: 'Gerenciar pontos de acesso',
          icon: 'location_on',
          tone: 'locations',
        },
        {
          path: '/dispositivos',
          title: 'Dispositivos',
          description: 'Vincular os leitores aos locais',
          icon: 'memory',
          tone: 'devices',
        },
        {
          path: '/administradores',
          title: 'Administradores',
          description: 'Gerenciar contas administrativas',
          icon: 'admin_panel_settings',
          tone: 'admins',
        },
        {
          path: '/audit-logs',
          title: 'Auditoria',
          description: 'Consultar ações administrativas',
          icon: 'fact_check',
          tone: 'audit',
        },
        {
          path: '/entidades',
          title: 'Modelo de dados',
          description: 'Consultar a estrutura do projeto',
          icon: 'account_tree',
          tone: 'data',
        },
      ],
    },
  ];

  /** Ordem em que o ambiente precisa ser preparado para o primeiro acesso. */
  readonly etapas: EtapaPreparacao[] = [
    {
      id: 'locais',
      path: '/locais',
      icon: 'location_on',
      titulo: 'Locais',
      pendente: 'Cadastre o primeiro ponto de acesso.',
      acao: 'Cadastrar local',
      singular: 'local cadastrado',
      plural: 'locais cadastrados',
    },
    {
      id: 'dispositivos',
      path: '/dispositivos',
      icon: 'memory',
      titulo: 'Dispositivos',
      pendente: 'Vincule um leitor a um local.',
      acao: 'Vincular leitor',
      singular: 'leitor vinculado',
      plural: 'leitores vinculados',
    },
    {
      id: 'usuarios',
      path: '/usuarios',
      icon: 'group',
      titulo: 'Usuários',
      pendente: 'Cadastre uma pessoa com cartão e biometria.',
      acao: 'Cadastrar usuário',
      singular: 'usuário cadastrado',
      plural: 'usuários cadastrados',
    },
    {
      id: 'permissoes',
      path: '/permissoes',
      icon: 'vpn_key',
      titulo: 'Permissões',
      pendente: 'Defina quem entra em cada local, em quais dias e horários.',
      acao: 'Definir permissão',
      singular: 'permissão definida',
      plural: 'permissões definidas',
    },
  ];

  readonly estadoServidor = signal<EstadoCarga>('carregando');
  readonly estadoPreparacao = signal<EstadoCarga>('carregando');
  readonly estadoTentativas = signal<EstadoCarga>('carregando');
  readonly contagens = signal<Record<EtapaId, number> | null>(null);
  readonly tentativas = signal<Tentativa[]>([]);
  /** Texto anunciado por leitores de tela quando chega uma tentativa em tempo real. */
  readonly anuncio = signal('');

  readonly proximaEtapa = computed(() => {
    const contagens = this.contagens();
    return contagens ? (this.etapas.find((etapa) => contagens[etapa.id] === 0) ?? null) : null;
  });
  readonly etapasConcluidas = computed(() => {
    const contagens = this.contagens();
    return contagens ? this.etapas.filter((etapa) => contagens[etapa.id] > 0).length : 0;
  });

  private nomesLocais = new Map<number, string>();

  ngOnInit(): void {
    this.verificarServidor();
    this.carregarPreparacao();
    this.carregarTentativas();

    this.wsLogs
      .obterLogsEmTempoReal()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((evento) => {
        if (evento.type !== 'NOVO_ACESSO' || !evento.data) return;
        const dados = evento.data;
        const tentativa: Tentativa = {
          id: dados.id ?? Date.now(),
          dataHora: new Date().toISOString(),
          autorizado: dados.autorizado ?? false,
          usuario: dados.nome_usuario || 'Usuário não identificado',
          local: this.nomeLocal(dados.local_id ?? null, null),
          motivo: dados.motivo_recusa ?? null,
          nova: true,
        };
        this.tentativas.update((lista) => [tentativa, ...lista].slice(0, LIMITE_TENTATIVAS));
        this.anuncio.set(
          `Nova tentativa: ${tentativa.autorizado ? 'acesso autorizado' : 'acesso negado'}, ${tentativa.usuario}.`,
        );
        if (this.estadoTentativas() === 'erro') this.estadoTentativas.set('pronto');
      });
  }

  verificarServidor(): void {
    this.estadoServidor.set('carregando');
    this.api.getHealth().subscribe({
      next: () => this.estadoServidor.set('pronto'),
      error: () => this.estadoServidor.set('erro'),
    });
  }

  carregarPreparacao(): void {
    this.estadoPreparacao.set('carregando');
    forkJoin({
      locais: this.api.getLocais(),
      dispositivos: this.api.getDispositivos(),
      usuarios: this.api.getUsuariosSimples(),
      permissoes: this.api.getPermissoes(),
    }).subscribe({
      next: ({ locais, dispositivos, usuarios, permissoes }) => {
        this.nomesLocais = new Map(locais.map((local) => [local.local_id, local.nome]));
        this.contagens.set({
          locais: locais.length,
          dispositivos: dispositivos.length,
          usuarios: usuarios.length,
          permissoes: permissoes.length,
        });
        this.estadoPreparacao.set('pronto');
      },
      error: () => this.estadoPreparacao.set('erro'),
    });
  }

  carregarTentativas(): void {
    this.estadoTentativas.set('carregando');
    this.api.getHistoricoAcesso().subscribe({
      next: (historico) => {
        this.tentativas.set(
          historico.slice(0, LIMITE_TENTATIVAS).map((registro) => this.paraTentativa(registro)),
        );
        this.estadoTentativas.set('pronto');
      },
      error: () => this.estadoTentativas.set('erro'),
    });
  }

  resumoEtapa(etapa: EtapaPreparacao): string {
    const total = this.contagens()?.[etapa.id] ?? 0;
    if (total === 0) return etapa.pendente;
    return `${total} ${total === 1 ? etapa.singular : etapa.plural}`;
  }

  private paraTentativa(registro: HistoricoAcessoResponse): Tentativa {
    return {
      id: registro.id,
      dataHora: registro.data_hora,
      autorizado: registro.autorizado,
      usuario: registro.nome_usuario || 'Usuário não identificado',
      local: this.nomeLocal(registro.local_id, registro.nome_local ?? null),
      motivo: registro.motivo_recusa,
      nova: false,
    };
  }

  private nomeLocal(localId: number | null, nome: string | null): string {
    if (nome) return nome;
    if (localId === null) return 'Local não identificado';
    return this.nomesLocais.get(localId) ?? `Local ${localId}`;
  }
}
