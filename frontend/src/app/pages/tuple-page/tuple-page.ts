import { ConfirmationService } from '../../components/confirmation-dialog/confirmation-dialog';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  input,
  OnInit,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TuplePageConfig } from '../../models/tuple-page.model';
import {
  ApiService,
  HistoricoAcessoResponse,
  LocalResponse,
  PermissaoRequest,
  PermissaoResponse,
  UsuarioResponse,
  UsuarioSimplesResponse,
} from '../../services/api.service';
import { CadastrarPage } from '../cadastrar/cadastrar';
import { UserEditDialog } from './user-edit-dialog';
import { WebSocketLogsService, WebSocketLogEvent } from '../../services/websocket-logs.service';

@Component({
  selector: 'app-tuple-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    RouterLink,
  ],
  templateUrl: './tuple-page.html',
  styleUrl: './tuple-page.scss',
})
export class TuplePage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private confirmation = inject(ConfirmationService);
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  private wsLogs = inject(WebSocketLogsService);

  configInput = input<TuplePageConfig | undefined>(undefined, { alias: 'config' });
  rowsFromApi = signal<Record<string, unknown>[] | null>(null);
  usingMock = signal(false);
  dataNotice = signal<string | null>(null);
  usuarios: UsuarioSimplesResponse[] = [];
  locais: LocalResponse[] = [];
  editandoPermissaoId: number | null = null;
  permissaoForm: PermissaoRequest = this.novaPermissaoForm();
  /** Erro ao salvar no editor de permissão (sucessos vão para o snackbar). */
  acaoNotice = '';
  salvandoPermissao = false;
  /** Linha recém-criada ou alterada, destacada por um instante. */
  destacado: unknown = null;
  private destaqueTimer?: ReturnType<typeof setTimeout>;
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  /** Pessoas ou locais não carregaram: filtros e editor ficam incompletos. */
  erroReferencias = false;
  /** Texto lido por leitores de tela quando chega uma tentativa em tempo real. */
  anuncio = signal('');
  /** Tentativas recebidas agora pelo WebSocket, destacadas por um instante. */
  private idsNovos = new Set<number>();
  @ViewChild('editorPermissao') private editorPermissao?: ElementRef<HTMLElement>;
  @ViewChild('localPermissao') private localPermissao?: ElementRef<HTMLSelectElement>;
  private historico: HistoricoAcessoResponse[] = [];
  private permissoes: PermissaoResponse[] = [];
  private wsSubscription: Subscription | null = null;

  // Filtros de busca
  filtroTexto = signal('');
  filtroAtivo = signal('todos'); // 'todos' | 'ativo' | 'inativo'
  filtroUsuarioId = signal<number | null>(null);
  filtroLocalId = signal<number | null>(null);
  filtroAutorizado = signal('todos'); // 'todos' | 'autorizado' | 'negado'

  get config(): TuplePageConfig | undefined {
    return this.configInput() || (this.route.snapshot.data['config'] as TuplePageConfig);
  }

  get allRows(): TuplePageConfig['rows'] {
    return this.rowsFromApi() ?? this.config?.rows ?? [];
  }

  get displayedRows(): TuplePageConfig['rows'] {
    let rows = this.allRows;

    const termo = this.filtroTexto().trim().toLowerCase();
    if (termo) {
      // Campos internos (prefixo _) não entram na busca.
      rows = rows.filter((row) =>
        Object.entries(row).some(
          ([chave, val]) =>
            !chave.startsWith('_') &&
            val !== null &&
            val !== undefined &&
            String(val).toLowerCase().includes(termo),
        ),
      );
    }

    if (this.config?.resource === 'usuarios') {
      const st = this.filtroAtivo();
      if (st === 'ativo') rows = rows.filter((r) => r['ativo'] === 'Sim');
      if (st === 'inativo') rows = rows.filter((r) => r['ativo'] === 'Não');
    }

    if (this.config?.resource === 'permissoes') {
      const uId = this.filtroUsuarioId();
      if (uId) {
        const nomeU = this.nomeUsuario(uId);
        rows = rows.filter((r) => r['usuario_id'] === nomeU);
      }
      const lId = this.filtroLocalId();
      if (lId) {
        const nomeL = this.nomeLocal(lId);
        rows = rows.filter((r) => r['local_id'] === nomeL);
      }
    }

    if (this.config?.resource === 'historico') {
      const uId = this.filtroUsuarioId();
      if (uId) {
        const nomeU = this.nomeUsuario(uId);
        rows = rows.filter((r) => r['usuario_id'] === nomeU);
      }
      const lId = this.filtroLocalId();
      if (lId) {
        const nomeL = this.nomeLocal(lId);
        rows = rows.filter((r) => r['local_id'] === nomeL);
      }
      const aut = this.filtroAutorizado();
      if (aut === 'autorizado') rows = rows.filter((r) => r['autorizado'] === 'Sim');
      if (aut === 'negado') rows = rows.filter((r) => r['autorizado'] === 'Não');
    }

    return rows;
  }

  /** Estado real do WebSocket do histórico (o serviço reconecta sozinho a cada 5 s). */
  get tempoReal(): boolean {
    return this.wsLogs.conectado();
  }

  get filtrando(): boolean {
    return (
      !!this.filtroTexto().trim() ||
      this.filtroAtivo() !== 'todos' ||
      this.filtroUsuarioId() !== null ||
      this.filtroLocalId() !== null ||
      this.filtroAutorizado() !== 'todos'
    );
  }

  /** Pessoas e locais usados nos filtros, no editor de permissão e nos nomes das linhas. */
  carregarReferencias(): void {
    this.erroReferencias = false;
    const falhou = () => {
      this.erroReferencias = true;
      this.cdr.markForCheck();
    };
    this.api.getUsuariosSimples().subscribe({
      next: (usuarios) => {
        this.usuarios = usuarios;
        if (this.config?.resource === 'historico') this.atualizarLinhasHistorico();
        if (this.config?.resource === 'permissoes') this.atualizarLinhasPermissoes();
        this.cdr.markForCheck();
      },
      error: falhou,
    });
    this.api.getLocais().subscribe({
      next: (locais) => {
        this.locais = locais;
        if (this.config?.resource === 'historico') this.atualizarLinhasHistorico();
        if (this.config?.resource === 'permissoes') this.atualizarLinhasPermissoes();
        this.cdr.markForCheck();
      },
      error: falhou,
    });
  }

  private destacar(chave: unknown): void {
    clearTimeout(this.destaqueTimer);
    this.destacado = chave;
    this.destaqueTimer = setTimeout(() => {
      this.destacado = null;
      this.cdr.markForCheck();
    }, 2000);
  }

  private avisar(mensagem: string): void {
    this.snackBar.open(mensagem, 'Fechar', { duration: 4000 });
  }

  /** Chave estável por registro: linhas novas ganham elemento novo (e o destaque). */
  chaveLinha(row: Record<string, unknown>, indice: number): unknown {
    return row['_id'] ?? row['user_id'] ?? row['permissao_id'] ?? indice;
  }

  contarResultado(valor: 'Sim' | 'Não'): number {
    return this.displayedRows.filter((row) => row['autorizado'] === valor).length;
  }

  /** Dias numéricos (1 = domingo) da permissão de uma linha, para a faixa da semana. */
  diasDaPermissao(row: Record<string, unknown>): number[] {
    const id = Number(row['permissao_id']);
    return this.permissoes.find((permissao) => permissao.permissao_id === id)?.dias_semana ?? [];
  }

  horaCurta(valor: unknown): string {
    return String(valor ?? '').slice(0, 5);
  }

  /** "dd/mm/aaaa hh:mm:ss" em data e hora separadas, para a coluna Quando. */
  partesDataHora(valor: unknown): { data: string; hora: string } {
    const [data = '', hora = ''] = String(valor ?? '').split(' ');
    return { data, hora };
  }

  get permissaoValida(): boolean {
    return (
      !!this.permissaoForm.usuario_id &&
      !!this.permissaoForm.local_id &&
      this.permissaoForm.dias_semana.length > 0
    );
  }

  cadastrarUsuario(): void {
    const ref = this.dialog.open(CadastrarPage, {
      width: '1000px',
      maxWidth: '96vw',
      maxHeight: '92dvh',
      // A primeira ação do cadastro é digitar o nome.
      autoFocus: '#cad-nome',
      restoreFocus: true,
      disableClose: true,
      ariaLabelledBy: 'user-create-title',
      panelClass: 'ard-user-create-dialog',
    });
    // O próprio cadastro confirma o resultado (snackbar e voz); aqui só atualiza a lista.
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado?.criado) return;
      this.carregarDados();
      this.cdr.markForCheck();
    });
  }

  editarUsuario(row: Record<string, unknown>): void {
    const usuarioId = Number(row['user_id']);
    if (!usuarioId) return;

    this.api.getUsuario(usuarioId).subscribe({
      next: (usuario) => {
        const ref = this.dialog.open(UserEditDialog, {
          data: { usuario },
          width: '1000px',
          maxWidth: '96vw',
          maxHeight: '92dvh',
          autoFocus: false,
          restoreFocus: true,
          disableClose: true,
          ariaLabelledBy: 'user-edit-title',
          panelClass: 'ard-user-edit-dialog',
        });

        // O diálogo confirma cada alteração; na lista, a linha alterada pisca.
        ref.afterClosed().subscribe((resultado) => {
          if (!resultado?.atualizado) return;
          this.destacar(usuarioId);
          this.carregarDados();
          this.cdr.markForCheck();
        });
      },
      error: (error) => {
        this.avisar(error.error?.detail || `Não foi possível abrir ${row['nome']} para edição. Tente novamente.`);
      },
    });
  }

  async excluirUsuario(row: Record<string, unknown>): Promise<void> {
    const id = Number(row['user_id']);
    if (
      !(await this.confirmation.excluir(
        'Excluir usuário?',
        `O usuário "${row['nome']}" será removido.`,
        {
          items: [
            {
              icon: 'person',
              label: String(row['nome']),
              description: 'Cadastro, credenciais e dados biométricos.',
            },
            {
              icon: 'vpn_key',
              label: 'Permissões vinculadas',
              description: 'Acessos deste usuário também serão removidos.',
            },
          ],
        },
      ))
    )
      return;

    this.api.deletarUsuario(id).subscribe({
      next: () => {
        this.carregarDados();
        this.avisar(`Usuário ${row['nome']} excluído.`);
      },
      error: (err) => {
        console.error('Erro ao excluir usuário:', err);
        this.avisar(`Não foi possível excluir ${row['nome']}. Tente novamente.`);
      },
    });
  }

  limparFiltros(): void {
    this.filtroTexto.set('');
    this.filtroAtivo.set('todos');
    this.filtroUsuarioId.set(null);
    this.filtroLocalId.set(null);
    this.filtroAutorizado.set('todos');
    this.carregarDados();
  }

  ngOnInit(): void {
    if (this.config?.resource === 'historico' || this.config?.resource === 'permissoes') {
      this.carregarReferencias();
    }
    // Subscribe to WebSocket for real-time historico updates
    if (this.config?.resource === 'historico') {
      this.wsSubscription = this.wsLogs.obterLogsEmTempoReal().subscribe({
        next: (evento) => {
          if (evento.type === 'NOVO_ACESSO' && evento.data) {
            // Prepend new access to local history array
            const novoRegistro: HistoricoAcessoResponse = {
              id: evento.data.id ?? Date.now(), // fallback ID
              usuario_id: evento.data.usuario_id ?? null,
              local_id: evento.data.local_id ?? null,
              uid_card_lido: null, // not in WebSocket event
              // Horário do servidor (ISO com fuso); sem ele, o momento da chegada.
              data_hora: evento.data.data_hora ?? new Date().toISOString(),
              autorizado: evento.data.autorizado ?? false,
              percentual_similaridade: evento.data.percentual_similaridade ?? null,
              motivo_recusa: evento.data.motivo_recusa ?? null,
              nome_usuario: evento.data.nome_usuario ?? null,
              nome_local: null, // will be resolved via this.locais
            };
            this.historico.unshift(novoRegistro);
            this.idsNovos.add(novoRegistro.id);
            this.anuncio.set(
              `Nova tentativa: ${novoRegistro.autorizado ? 'autorizada' : 'negada'}` +
                `${novoRegistro.nome_usuario ? `, ${novoRegistro.nome_usuario}` : ''}.`,
            );
            this.atualizarLinhasHistorico();
            this.cdr.markForCheck();
            setTimeout(() => {
              this.idsNovos.delete(novoRegistro.id);
              this.atualizarLinhasHistorico();
              this.cdr.markForCheck();
            }, 2000);
          }
        },
      });
    }

    this.carregarDados();
  }

  ngOnDestroy(): void {
    this.wsSubscription?.unsubscribe();
    clearTimeout(this.destaqueTimer);
  }

  carregarDados(): void {
    const termo = this.filtroTexto().trim() || undefined;

    if (this.config?.resource === 'historico') {
      const autBool =
        this.filtroAutorizado() === 'todos' ? undefined : this.filtroAutorizado() === 'autorizado';
      this.api
        .getHistoricoAcesso({
          q: termo,
          usuario_id: this.filtroUsuarioId() ?? undefined,
          local_id: this.filtroLocalId() ?? undefined,
          autorizado: autBool,
        })
        .subscribe({
          next: (historico) => {
            this.historico = historico;
            this.atualizarLinhasHistorico();
            this.dataNotice.set(null);
            this.cdr.markForCheck();
          },
          error: () => {
            this.rowsFromApi.set([]);
            this.cdr.markForCheck();
            this.dataNotice.set('Não foi possível carregar o histórico de acesso da API.');
          },
        });
      return;
    }

    if (this.config?.resource === 'permissoes') {
      this.api
        .getPermissoes({
          q: termo,
          usuario_id: this.filtroUsuarioId() ?? undefined,
          local_id: this.filtroLocalId() ?? undefined,
        })
        .subscribe({
          next: (permissoes) => {
            this.permissoes = permissoes;
            this.atualizarLinhasPermissoes();
            this.dataNotice.set(null);
            this.cdr.markForCheck();
          },
          error: () => {
            this.rowsFromApi.set([]);
            this.cdr.markForCheck();
            this.dataNotice.set('Não foi possível carregar as permissões da API.');
          },
        });
      return;
    }

    if (this.config?.resource !== 'usuarios') return;

    const ativoBool = this.filtroAtivo() === 'todos' ? undefined : this.filtroAtivo() === 'ativo';
    this.api.getUsuarios({ q: termo, ativo: ativoBool }).subscribe({
      next: (usuarios) => {
        this.rowsFromApi.set(usuarios.map((usuario) => this.toTableRow(usuario)));
        this.dataNotice.set(null);
      },
      error: () => {
        this.rowsFromApi.set([]);
        this.dataNotice.set('Não foi possível carregar os usuários da API.');
      },
    });
  }

  private toTableRow(usuario: UsuarioResponse): Record<string, unknown> {
    const qtdVetor = Array.isArray(usuario.vetor_facial) ? usuario.vetor_facial.length : 0;
    return {
      user_id: usuario.user_id,
      nome: usuario.nome,
      cpf: this.formatarCpf(usuario.cpf),
      tipo_usuario: usuario.tipo_usuario === 'VISITANTE' ? 'Visitante' : 'Interno',
      uid_card: usuario.uid_card ?? '-',
      vetor_facial: usuario.vetor_facial && qtdVetor > 0 ? 'Cadastrada' : 'Não Cadastrado',
      ativo: usuario.ativo ? 'Sim' : 'Não',
      criado_em: this.formatarDataHora(usuario.criado_em, false),
    };
  }

  private toPermissionRow(permissao: PermissaoResponse): Record<string, unknown> {
    return {
      permissao_id: permissao.permissao_id,
      usuario_id: this.nomeUsuario(permissao.usuario_id),
      local_id: this.nomeLocal(permissao.local_id),
      horario_inicio: permissao.horario_inicio,
      horario_fim: permissao.horario_fim,
      dias_semana: this.formatarDias(permissao.dias_semana),
    };
  }

  private formatarCpf(cpf: string | null | undefined): string {
    if (!cpf) return '-';
    const digitos = cpf.replace(/\D/g, '');
    if (digitos.length !== 11) return cpf;
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  private formatarDias(dias: number[]): string {
    const nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return dias.length
      ? dias.map((dia) => nomes[dia - 1] ?? `Dia ${dia}`).join(', ')
      : 'Nenhum dia definido';
  }

  private formatarDataHora(
    dataStr: string | null | undefined,
    incluirSegundos: boolean = true,
  ): string {
    if (!dataStr) return '-';
    try {
      const d = new Date(dataStr);
      if (isNaN(d.getTime())) return String(dataStr);

      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      const horas = String(d.getHours()).padStart(2, '0');
      const minutos = String(d.getMinutes()).padStart(2, '0');
      const segundos = String(d.getSeconds()).padStart(2, '0');

      if (incluirSegundos) {
        return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
      }
      return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
    } catch {
      return String(dataStr);
    }
  }

  private atualizarLinhasPermissoes(): void {
    this.rowsFromApi.set(this.permissoes.map((permissao) => this.toPermissionRow(permissao)));
  }

  private atualizarLinhasHistorico(): void {
    this.rowsFromApi.set(this.historico.map((registro) => this.toHistoryRow(registro)));
  }

  private toHistoryRow(registro: HistoricoAcessoResponse): Record<string, unknown> {
    const sim = registro.percentual_similaridade;
    // Backend envia similaridade como decimal (0.0 a 1.0). Converter para % se necessário.
    const simDisplay =
      sim !== null && sim !== undefined
        ? sim > 1
          ? `${sim.toFixed(2)}%`
          : `${(sim * 100).toFixed(2)}%`
        : '-';

    return {
      _id: registro.id,
      _novo: this.idsNovos.has(registro.id),
      usuario_id:
        registro.usuario_id === null ? 'Não identificado' : this.nomeUsuario(registro.usuario_id),
      local_id: registro.local_id === null ? 'Não identificado' : this.nomeLocal(registro.local_id),
      uid_card_lido: registro.uid_card_lido ?? '-',
      data_hora: this.formatarDataHora(registro.data_hora, true),
      autorizado: registro.autorizado ? 'Sim' : 'Não',
      percentual_similaridade: simDisplay,
      motivo_recusa: registro.motivo_recusa ?? '-',
    };
  }

  nomeUsuario(id: number): string {
    return this.usuarios.find((usuario) => usuario.user_id === id)?.nome ?? `ID ${id}`;
  }

  nomeLocal(id: number): string {
    return this.locais.find((local) => local.local_id === id)?.nome ?? `ID ${id}`;
  }

  iniciarEdicao(row: Record<string, unknown>): void {
    const permissaoId = Number(row['permissao_id']);
    const original = this.permissoes.find((permissao) => permissao.permissao_id === permissaoId);
    if (!original) return;
    this.editandoPermissaoId = permissaoId;
    this.permissaoForm = { ...original, dias_semana: [...original.dias_semana] };
    this.acaoNotice = '';
    setTimeout(() => {
      const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this.editorPermissao?.nativeElement.scrollIntoView({ block: 'nearest', behavior: reduzir ? 'auto' : 'smooth' });
      this.localPermissao?.nativeElement.focus({ preventScroll: true });
    });
  }

  cancelarEdicao(): void {
    this.editandoPermissaoId = null;
    this.acaoNotice = '';
    this.permissaoForm = this.novaPermissaoForm();
  }

  salvarPermissao(): void {
    if (this.salvandoPermissao) return;
    this.acaoNotice = '';
    this.salvandoPermissao = true;
    const criando = this.editandoPermissaoId === null;
    const request = { ...this.permissaoForm, dias_semana: this.permissaoForm.dias_semana };
    const chamada =
      this.editandoPermissaoId === null
        ? this.api.criarPermissao(request)
        : this.api.atualizarPermissao(this.editandoPermissaoId, request);

    chamada.subscribe({
      next: (permissao) => {
        const permissoes = this.permissoes.filter(
          (item) => item.permissao_id !== permissao.permissao_id,
        );
        this.permissoes = [...permissoes, permissao].sort(
          (a, b) => a.permissao_id - b.permissao_id,
        );
        this.rowsFromApi.set(this.permissoes.map((item) => this.toPermissionRow(item)));
        this.salvandoPermissao = false;
        const mensagem = criando
          ? `Permissão criada: ${this.nomeUsuario(permissao.usuario_id)} em ${this.nomeLocal(permissao.local_id)}.`
          : `Alterações na permissão de ${this.nomeUsuario(permissao.usuario_id)} salvas.`;
        // Próximo passo natural: testar o acesso com o cartão da pessoa.
        this.snackBar
          .open(mensagem, 'Validar acesso', { duration: 6000 })
          .onAction()
          .subscribe(() => this.router.navigateByUrl('/validar-acesso'));
        this.destacar(permissao.permissao_id);
        this.cancelarEdicao();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.salvandoPermissao = false;
        this.acaoNotice =
          error.status === 409
            ? 'Já existe uma permissão para este usuário e local.'
            : 'Não foi possível salvar a permissão.';
        this.cdr.markForCheck();
      },
    });
  }

  async excluirPermissao(row: Record<string, unknown>): Promise<void> {
    const id = Number(row['permissao_id']);
    if (
      !(await this.confirmation.excluir(
        'Excluir permissão?',
        `A permissão de "${row['usuario_id']}" para "${row['local_id']}" será removida.`,
        {
          items: [
            {
              icon: 'person',
              label: String(row['usuario_id']),
              description: 'Usuário que perderá este acesso.',
            },
            {
              icon: 'location_on',
              label: String(row['local_id']),
              description: 'Local que deixará de estar autorizado.',
            },
          ],
        },
      ))
    )
      return;
    this.api.deletarPermissao(id).subscribe({
      next: () => {
        this.permissoes = this.permissoes.filter((item) => item.permissao_id !== id);
        this.rowsFromApi.set(this.permissoes.map((item) => this.toPermissionRow(item)));
        // Se era a permissão aberta no editor, o editor volta para "Criar".
        if (this.editandoPermissaoId === id) this.cancelarEdicao();
        this.avisar(`Permissão de ${row['usuario_id']} em ${row['local_id']} excluída.`);
        this.cdr.markForCheck();
      },
      error: () => {
        this.avisar(`Não foi possível excluir a permissão de ${row['usuario_id']}. Tente novamente.`);
      },
    });
  }

  private novaPermissaoForm(): PermissaoRequest {
    return {
      usuario_id: 0,
      local_id: 0,
      horario_inicio: '08:00',
      horario_fim: '18:00',
      dias_semana: [2, 3, 4, 5, 6],
    };
  }

  togglePermissaoDia(dia: number): void {
    this.permissaoForm.dias_semana = this.permissaoForm.dias_semana.includes(dia)
      ? this.permissaoForm.dias_semana.filter((item) => item !== dia)
      : [...this.permissaoForm.dias_semana, dia].sort();
  }

  nomeDia(dia: number): string {
    return (
      [
        'Domingo',
        'Segunda-feira',
        'Terça-feira',
        'Quarta-feira',
        'Quinta-feira',
        'Sexta-feira',
        'Sábado',
      ][dia - 1] ?? `Dia ${dia}`
    );
  }

  isBadgeStatus(val: any): boolean {
    if (typeof val !== 'string') return false;
    const lower = val.toLowerCase();
    return ['sucesso', 'negado', 'alerta', 'ativo', 'inativo', 'pendente', 'sim', 'não'].includes(
      lower,
    );
  }

  getStatusClass(val: string): string {
    switch (val.toLowerCase()) {
      case 'sucesso':
      case 'ativo':
      case 'sim':
        return 'badge-success';
      case 'negado':
      case 'inativo':
      case 'não':
        return 'badge-danger';
      case 'alerta':
      case 'pendente':
        return 'badge-warning';
      default:
        return 'badge-neutral';
    }
  }
}
