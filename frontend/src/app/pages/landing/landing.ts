import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type EtapaId = 'cartao' | 'permissao' | 'rosto' | 'decisao';
type EtapaEstado = 'aguardando' | 'verificando' | 'ok' | 'falha' | 'ignorada';

interface Etapa {
  id: EtapaId;
  titulo: string;
  icone: string;
  detalhe: string;
}

interface RegistroSimulado {
  id: number;
  dataHora: Date;
  autorizado: boolean;
  motivo: string | null;
}

/**
 * Mensagens de recusa idênticas às gravadas pelo backend
 * (backend/app/services/acesso_service.py). A simulação não consulta a API.
 */
const MOTIVO_CARTAO = 'Cartão não cadastrado no sistema.';
const MOTIVO_HORARIO =
  'Cartão válido, mas fora do horário de acesso permitido para este usuário.';
const MOTIVO_ROSTO = 'Similaridade facial insuficiente com o titular do cartão.';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [DatePipe, MatIconModule, RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class LandingPage implements AfterViewInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private proximoId = 1;

  readonly temaEscuro = signal(document.body.classList.contains('dark-mode'));
  readonly destinoPainel = computed(() => (this.auth.isLoggedIn() ? '/adm-page' : '/login'));
  readonly rotuloPainel = computed(() =>
    this.auth.isLoggedIn() ? 'Abrir o painel' : 'Entrar no painel',
  );

  readonly secoes = [
    { id: 'problema', rotulo: 'O problema' },
    { id: 'funcionamento', rotulo: 'Como funciona' },
    { id: 'demonstracao', rotulo: 'Demonstração' },
    { id: 'seguranca', rotulo: 'Segurança' },
  ];

  readonly publicos = [
    {
      icone: 'apartment',
      titulo: 'Empresas',
      texto: 'Salas, estoques e áreas restritas com acesso definido por pessoa, local e horário.',
    },
    {
      icone: 'school',
      titulo: 'Instituições',
      texto:
        'Laboratórios e espaços compartilhados, com internos e visitantes no mesmo cadastro e permissões separadas.',
    },
    {
      icone: 'admin_panel_settings',
      titulo: 'Administradores',
      texto: 'Um painel para cadastrar pessoas, definir permissões e responder quem tentou entrar, onde e quando.',
    },
  ];

  readonly comparacao = [
    {
      antes: 'Quem está com o cartão entra, seja ou não o titular.',
      depois: 'O rosto de quem apresenta o cartão é comparado ao do titular antes de liberar.',
    },
    {
      antes: 'A mesma chave vale o dia inteiro, todos os dias.',
      depois: 'Cada permissão define o local, os dias da semana e o horário.',
    },
    {
      antes: 'Uma entrada negada não deixa rastro.',
      depois: 'Toda tentativa entra no histórico com resultado e motivo da recusa.',
    },
    {
      antes: 'Ninguém sabe quem alterou um cadastro.',
      depois: 'As ações dos administradores ficam registradas na auditoria.',
    },
  ];

  readonly passos = [
    {
      icone: 'contactless',
      titulo: 'A pessoa aproxima o cartão',
      texto: 'O leitor com ESP32 lê o cartão RFID e envia a identificação ao servidor.',
    },
    {
      icone: 'rule',
      titulo: 'O servidor confere a permissão',
      texto:
        'Cartão cadastrado, usuário e local ativos, permissão para aquele dia e horário. Se algo não confere, o acesso é negado nesse ponto.',
    },
    {
      icone: 'face',
      titulo: 'O rosto é comparado ao do titular',
      texto:
        'A câmera captura o rosto e o sistema compara com a biometria cadastrada para aquele cartão, um para um.',
    },
    {
      icone: 'lock_open',
      titulo: 'O leitor recebe a ordem e a tentativa é registrada',
      texto: 'O leitor apenas executa liberar ou negar. O resultado aparece no histórico em tempo real.',
    },
  ];

  readonly beneficios = [
    {
      titulo: 'Para empresas',
      itens: [
        'Um cartão emprestado, perdido ou copiado não basta para entrar.',
        'Desativar um usuário bloqueia o acesso na hora, sem recolher o cartão.',
        'O histórico mostra o que aconteceu em cada porta quando for preciso apurar um incidente.',
      ],
    },
    {
      titulo: 'Para instituições',
      itens: [
        'Internos e visitantes ficam no mesmo cadastro, cada um com a sua permissão.',
        'Cada laboratório ou sala é um local com regras próprias de dia e horário.',
        'A consulta por local mostra quem tentou acessar cada espaço.',
      ],
    },
    {
      titulo: 'Para administradores',
      itens: [
        'Cartão, biometria e permissões são cadastrados no mesmo fluxo.',
        'O histórico se atualiza sozinho a cada nova tentativa.',
        'O assistente iArdLock responde perguntas sobre usuários e acessos quando está configurado na instalação.',
      ],
    },
  ];

  readonly pilares = [
    {
      icone: 'verified_user',
      titulo: 'Segurança',
      resumo: 'Dois fatores físicos e nenhuma decisão fora do servidor.',
      itens: [
        'Cartão RFID e rosto do titular precisam conferir na mesma tentativa.',
        'O leitor não decide: o servidor é a única fonte da decisão de acesso.',
        'A validação facial tem tempo máximo; passado o prazo, a tentativa é negada.',
        'O painel exige login de administrador e a sessão expira.',
      ],
    },
    {
      icone: 'tune',
      titulo: 'Controle',
      resumo: 'A regra de acesso é sua, por pessoa e por porta.',
      itens: [
        'Permissões por local, dias da semana e faixa de horário.',
        'Usuários, locais e leitores podem ser desativados sem apagar o cadastro.',
        'Cada leitor é vinculado a um local, e a permissão vale para aquele local.',
      ],
    },
    {
      icone: 'manage_search',
      titulo: 'Rastreabilidade',
      resumo: 'O que aconteceu fica escrito, inclusive o que foi negado.',
      itens: [
        'Histórico de tentativas com data, local, resultado, similaridade e motivo da recusa.',
        'Auditoria das ações feitas pelos administradores no painel.',
        'Cada instalação roda com o seu próprio banco de dados.',
      ],
    },
  ];

  readonly fluxo = [
    { icone: 'location_on', titulo: 'Cadastre os locais', texto: 'Cada porta ou ambiente controlado.' },
    { icone: 'memory', titulo: 'Vincule os leitores', texto: 'Um dispositivo para cada local.' },
    { icone: 'group', titulo: 'Cadastre as pessoas', texto: 'Dados, cartão RFID e biometria facial.' },
    { icone: 'vpn_key', titulo: 'Defina as permissões', texto: 'Local, dias e horário de cada pessoa.' },
    { icone: 'history', titulo: 'Acompanhe', texto: 'Histórico de acesso e auditoria do painel.' },
  ];

  // ---- Simulação da decisão de acesso ----
  readonly etapas: Etapa[] = [
    { id: 'cartao', titulo: 'Leitura do cartão', icone: 'contactless', detalhe: 'O cartão está cadastrado?' },
    { id: 'permissao', titulo: 'Permissão', icone: 'rule', detalhe: 'Local, dia e horário permitidos?' },
    { id: 'rosto', titulo: 'Biometria facial', icone: 'face', detalhe: 'O rosto confere com o titular?' },
    { id: 'decisao', titulo: 'Decisão', icone: 'lock', detalhe: 'Liberar ou negar' },
  ];

  readonly cartaoCadastrado = signal(true);
  readonly dentroDoHorario = signal(true);
  readonly rostoConfere = signal(true);
  readonly simulando = signal(false);
  readonly estados = signal<Record<EtapaId, EtapaEstado>>(this.estadosIniciais());
  readonly resultado = signal<RegistroSimulado | null>(null);
  readonly registros = signal<RegistroSimulado[]>([]);

  ngAfterViewInit(): void {
    const alvos = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-tracar]');
    if (typeof IntersectionObserver === 'undefined') {
      alvos.forEach((alvo) => alvo.classList.add('is-tracado'));
      return;
    }
    this.observer = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          entrada.target.classList.add('is-tracado');
          this.observer?.unobserve(entrada.target);
        }
      },
      { threshold: 0.35 },
    );
    alvos.forEach((alvo) => this.observer?.observe(alvo));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.limparTimers();
  }

  irPara(evento: Event, id: string): void {
    const alvo = this.host.nativeElement.querySelector<HTMLElement>(`#${id}`);
    if (!alvo) return;
    evento.preventDefault();
    const reduzir = this.movimentoReduzido();
    alvo.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' });
    alvo.focus({ preventScroll: true });
  }

  /** Usa o controle de tema do cabeçalho do app para manter uma única fonte de estado. */
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

  alternar(condicao: 'cartao' | 'horario' | 'rosto'): void {
    if (this.simulando()) return;
    if (condicao === 'cartao') this.cartaoCadastrado.update((v) => !v);
    if (condicao === 'horario') this.dentroDoHorario.update((v) => !v);
    if (condicao === 'rosto') this.rostoConfere.update((v) => !v);
  }

  simular(): void {
    if (this.simulando()) return;
    this.limparTimers();
    this.simulando.set(true);
    this.resultado.set(null);
    this.estados.set(this.estadosIniciais());

    const passo = this.movimentoReduzido() ? 0 : 720;
    const checagens: { id: EtapaId; passou: boolean; motivo: string }[] = [
      { id: 'cartao', passou: this.cartaoCadastrado(), motivo: MOTIVO_CARTAO },
      { id: 'permissao', passou: this.dentroDoHorario(), motivo: MOTIVO_HORARIO },
      { id: 'rosto', passou: this.rostoConfere(), motivo: MOTIVO_ROSTO },
    ];

    let atraso = 0;
    let motivo: string | null = null;

    for (const checagem of checagens) {
      if (motivo) {
        this.definirEstado(checagem.id, 'ignorada', atraso);
        continue;
      }
      this.definirEstado(checagem.id, 'verificando', atraso);
      atraso += passo;
      this.definirEstado(checagem.id, checagem.passou ? 'ok' : 'falha', atraso);
      if (!checagem.passou) motivo = checagem.motivo;
    }

    this.definirEstado('decisao', 'verificando', atraso);
    atraso += Math.round(passo * 0.6);
    const motivoFinal = motivo;
    this.agendar(() => {
      const registro: RegistroSimulado = {
        id: this.proximoId++,
        dataHora: new Date(),
        autorizado: motivoFinal === null,
        motivo: motivoFinal,
      };
      this.estados.update((atual) => ({ ...atual, decisao: registro.autorizado ? 'ok' : 'falha' }));
      this.resultado.set(registro);
      this.registros.update((lista) => [registro, ...lista].slice(0, 4));
      this.simulando.set(false);
    }, atraso);
  }

  rotuloEstado(estado: EtapaEstado): string {
    switch (estado) {
      case 'verificando':
        return 'Verificando';
      case 'ok':
        return 'Confere';
      case 'falha':
        return 'Não confere';
      case 'ignorada':
        return 'Não executada';
      default:
        return 'Aguardando';
    }
  }

  private definirEstado(id: EtapaId, estado: EtapaEstado, atraso: number): void {
    this.agendar(() => this.estados.update((atual) => ({ ...atual, [id]: estado })), atraso);
  }

  private agendar(acao: () => void, atraso: number): void {
    this.timers.push(setTimeout(acao, atraso));
  }

  private limparTimers(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }

  private estadosIniciais(): Record<EtapaId, EtapaEstado> {
    return { cartao: 'aguardando', permissao: 'aguardando', rosto: 'aguardando', decisao: 'aguardando' };
  }

  private movimentoReduzido(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }
}
