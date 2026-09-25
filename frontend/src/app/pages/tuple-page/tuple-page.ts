import { ChangeDetectorRef, Component, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuplePageConfig } from '../../models/tuple-page.model';
import { ApiService, HistoricoAcessoResponse, LocalResponse, PermissaoRequest, PermissaoResponse, UsuarioResponse } from '../../services/api.service';
import { UserEditDialog } from './user-edit-dialog';

@Component({
  selector: 'app-tuple-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    RouterLink,
  ],
  templateUrl: './tuple-page.html',
  styleUrl: './tuple-page.scss',
})
export class TuplePage implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);

  configInput = input<TuplePageConfig | undefined>(undefined, { alias: 'config' });
  rowsFromApi = signal<Record<string, unknown>[] | null>(null);
  usingMock = signal(false);
  dataNotice = signal<string | null>(null);
  usuarios: UsuarioResponse[] = [];
  locais: LocalResponse[] = [];
  editandoPermissaoId: number | null = null;
  permissaoForm: PermissaoRequest = this.novaPermissaoForm();
  acaoNotice = '';
  private historico: HistoricoAcessoResponse[] = [];
  private permissoes: PermissaoResponse[] = [];

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
      rows = rows.filter((row) =>
        Object.values(row).some((val) =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(termo)
        )
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

  editarUsuario(row: Record<string, unknown>): void {
    const usuarioId = Number(row['user_id']);
    if (!usuarioId) return;

    this.acaoNotice = '';
    this.api.getUsuario(usuarioId).subscribe({
      next: (usuario) => {
        const ref = this.dialog.open(UserEditDialog, {
          data: { usuario },
          autoFocus: false,
          restoreFocus: true,
          maxWidth: '96vw',
          disableClose: true,
          panelClass: 'ard-user-edit-dialog',
        });

        ref.afterClosed().subscribe((resultado) => {
          if (!resultado?.atualizado) return;
          this.acaoNotice = 'Usuário atualizado com sucesso.';
          this.carregarDados();
          this.cdr.markForCheck();
        });
      },
      error: (error) => {
        this.dataNotice.set(
          error.error?.detail || 'Não foi possível carregar o usuário para edição.',
        );
        this.cdr.markForCheck();
      },
    });
  }

  excluirUsuario(row: Record<string, unknown>): void {
  const id = Number(row['user_id']);
  if (!confirm('Deseja realmente excluir este usuário?')) return;

  this.api.deletarUsuario(id).subscribe({
    next: () => {
      this.carregarDados();
      this.acaoNotice = 'Usuário excluído com sucesso.';
    },
    error: (err) => {
      console.error('Erro ao excluir usuário:', err);
      this.dataNotice.set('Não foi possível excluir o usuário.');
      this.cdr.markForCheck();
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
      this.api.getUsuarios().subscribe({
        next: (usuarios) => {
          this.usuarios = usuarios;
          if (this.config?.resource === 'historico') this.atualizarLinhasHistorico();
          if (this.config?.resource === 'permissoes') this.atualizarLinhasPermissoes();
          this.cdr.markForCheck();
        },
      });
      this.api.getLocais().subscribe({
        next: (locais) => {
          this.locais = locais;
          if (this.config?.resource === 'historico') this.atualizarLinhasHistorico();
          if (this.config?.resource === 'permissoes') this.atualizarLinhasPermissoes();
          this.cdr.markForCheck();
        },
      });
    }

    this.carregarDados();
  }

  carregarDados(): void {
    const termo = this.filtroTexto().trim() || undefined;

    if (this.config?.resource === 'historico') {
      const autBool = this.filtroAutorizado() === 'todos' ? undefined : this.filtroAutorizado() === 'autorizado';
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
      uid_card: usuario.uid_card ?? '-',
      vetor_facial: usuario.vetor_facial && qtdVetor > 0 ? `${qtdVetor} dimensões` : 'Não Cadastrado',
      ativo: usuario.ativo ? 'Sim' : 'Não',
      criado_em: usuario.criado_em,
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

  private formatarDias(dias: number[]): string {
    const nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return dias.length ? dias.map((dia) => nomes[dia - 1] ?? `Dia ${dia}`).join(', ') : 'Nenhum dia definido';
  }

  private atualizarLinhasPermissoes(): void {
    this.rowsFromApi.set(
      this.permissoes.map((permissao) => this.toPermissionRow(permissao))
    );
  }

  private atualizarLinhasHistorico(): void {
    this.rowsFromApi.set(
      this.historico.map((registro) => this.toHistoryRow(registro))
    );
  }

  private toHistoryRow(registro: HistoricoAcessoResponse): Record<string, unknown> {
    return {
      usuario_id: registro.usuario_id === null ? 'Não identificado' : this.nomeUsuario(registro.usuario_id),
      local_id: registro.local_id === null ? 'Não identificado' : this.nomeLocal(registro.local_id),
      uid_card_lido: registro.uid_card_lido ?? '-',
      data_hora: registro.data_hora,
      autorizado: registro.autorizado ? 'Sim' : 'Não',
      percentual_similaridade: registro.percentual_similaridade ?? '-',
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
  }

  cancelarEdicao(): void {
    this.editandoPermissaoId = null;
    this.permissaoForm = this.novaPermissaoForm();
  }

  salvarPermissao(): void {
    this.acaoNotice = '';
    const request = { ...this.permissaoForm, dias_semana: this.permissaoForm.dias_semana };
    const chamada = this.editandoPermissaoId === null
      ? this.api.criarPermissao(request)
      : this.api.atualizarPermissao(this.editandoPermissaoId, request);

    chamada.subscribe({
      next: (permissao) => {
        const permissoes = this.permissoes.filter((item) => item.permissao_id !== permissao.permissao_id);
        this.permissoes = [...permissoes, permissao].sort((a, b) => a.permissao_id - b.permissao_id);
        this.rowsFromApi.set(this.permissoes.map((item) => this.toPermissionRow(item)));
        this.acaoNotice = 'Permissão salva com sucesso.';
        this.cancelarEdicao();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.acaoNotice = error.status === 409
          ? 'Já existe uma permissão para este usuário e local.'
          : 'Não foi possível salvar a permissão.';
        this.cdr.markForCheck();
      },
    });
  }

  excluirPermissao(row: Record<string, unknown>): void {
    const id = Number(row['permissao_id']);
    if (!confirm('Excluir esta permissão?')) return;
    this.api.deletarPermissao(id).subscribe({
      next: () => {
        this.permissoes = this.permissoes.filter((item) => item.permissao_id !== id);
        this.rowsFromApi.set(this.permissoes.map((item) => this.toPermissionRow(item)));
        this.acaoNotice = 'Permissão excluída com sucesso.';
        this.cdr.markForCheck();
      },
      error: () => {
        this.acaoNotice = 'Não foi possível excluir a permissão.';
        this.cdr.markForCheck();
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
    return ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][dia - 1] ?? `Dia ${dia}`;
  }

  isBadgeStatus(val: any): boolean {
    if (typeof val !== 'string') return false;
    const lower = val.toLowerCase();
    return ['sucesso', 'negado', 'alerta', 'ativo', 'inativo', 'pendente', 'sim', 'não'].includes(lower);
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
