import { ConfirmationService } from '../../components/confirmation-dialog/confirmation-dialog';
import { ChangeDetectorRef, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';

import { ApiService, LocalRequest, LocalResponse } from '../../services/api.service';

@Component({
  selector: 'app-locais-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    RouterLink,
  ],
  templateUrl: './locais.html',
  styleUrl: './locais.scss',
})
export class LocaisPage implements OnInit {
  private confirmation = inject(ConfirmationService);
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  locais: LocalResponse[] = [];
  carregando = true;
  salvando = false;
  editandoId: number | null = null;
  /** Erro do formulário (validação ou salvamento). */
  erro = '';
  /** Erro ao carregar a lista; fica separado para não apagar a tabela. */
  erroLista = '';
  /** Linha recém-criada ou alterada, destacada por um instante. */
  destacadoId: number | null = null;
  form: LocalRequest = this.novoForm();

  @ViewChild('editor') private editor?: ElementRef<HTMLElement>;
  @ViewChild('nomeInput') private nomeInput?: ElementRef<HTMLInputElement>;

  // Filtros de busca
  filtroTexto = '';
  filtroAtivo = 'todos'; // 'todos' | 'ativo' | 'inativo'

  get displayedLocais(): LocalResponse[] {
    return this.locais.filter((local) => {
      const matchTexto =
        !this.filtroTexto ||
        local.nome.toLowerCase().includes(this.filtroTexto.trim().toLowerCase());

      const matchAtivo =
        this.filtroAtivo === 'todos' ||
        (this.filtroAtivo === 'ativo' && local.ativo) ||
        (this.filtroAtivo === 'inativo' && !local.ativo);

      return matchTexto && matchAtivo;
    });
  }

  get ativos(): number {
    return this.locais.filter((local) => local.ativo).length;
  }

  get filtrando(): boolean {
    return !!this.filtroTexto.trim() || this.filtroAtivo !== 'todos';
  }

  limparFiltros(): void {
    this.filtroTexto = '';
    this.filtroAtivo = 'todos';
  }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erroLista = '';
    this.api.getLocais().subscribe({
      next: (locais) => {
        this.locais = locais;
        this.carregando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.erroLista = 'Não foi possível carregar os locais.';
        this.carregando = false;
        this.cdr.markForCheck();
      },
    });
  }

  salvar(): void {
    this.erro = '';
    const payload: LocalRequest = {
      nome: this.form.nome.trim(),
      ativo: this.form.ativo,
    };
    if (payload.nome.length < 2) {
      this.erro = 'Informe o nome do local, com pelo menos 2 caracteres.';
      this.nomeInput?.nativeElement.focus();
      return;
    }

    this.salvando = true;
    const request =
      this.editandoId === null
        ? this.api.criarLocal(payload)
        : this.api.atualizarLocal(this.editandoId, payload);

    request.subscribe({
      next: (local) => {
        this.salvando = false;
        this.locais =
          this.editandoId === null
            ? [...this.locais, local].sort((a, b) => a.local_id - b.local_id)
            : this.locais.map((item) => (item.local_id === local.local_id ? local : item));
        this.snackBar.open(
          this.editandoId === null ? `Local ${local.nome} cadastrado.` : `Alterações em ${local.nome} salvas.`,
          'Fechar',
          { duration: 4000 },
        );
        this.destacar(local.local_id);
        this.cancelar();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.salvando = false;
        this.erro = error.error?.detail || 'Não foi possível salvar o local.';
        this.cdr.markForCheck();
      },
    });
  }

  editar(local: LocalResponse): void {
    this.editandoId = local.local_id;
    this.form = {
      nome: local.nome,
      ativo: local.ativo,
    };
    this.erro = '';
    this.focarEditor();
  }

  async excluir(local: LocalResponse): Promise<void> {
    if (
      !(await this.confirmation.excluir(
        'Excluir local?',
        `O local "${local.nome}" e suas permissões vinculadas serão removidos.`,
        {
          items: [
            {
              icon: 'location_on',
              label: local.nome,
              description: 'Local físico e configuração de status.',
            },
            {
              icon: 'vpn_key',
              label: 'Permissões vinculadas',
              description: 'Acessos configurados para este local.',
            },
          ],
        },
      ))
    )
      return;
    this.api.deletarLocal(local.local_id).subscribe({
      next: () => {
        this.locais = this.locais.filter((item) => item.local_id !== local.local_id);
        this.snackBar.open(`Local ${local.nome} excluído.`, 'Fechar', { duration: 4000 });
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackBar.open(`Não foi possível excluir ${local.nome}. Tente novamente.`, 'Fechar', {
          duration: 6000,
        });
        this.cdr.markForCheck();
      },
    });
  }

  cancelar(): void {
    this.editandoId = null;
    this.erro = '';
    this.form = this.novoForm();
  }

  /** Leva o formulário à vista (no celular ele fica acima da lista) e foca o nome. */
  private focarEditor(): void {
    setTimeout(() => {
      const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this.editor?.nativeElement.scrollIntoView({ block: 'nearest', behavior: reduzir ? 'auto' : 'smooth' });
      this.nomeInput?.nativeElement.focus({ preventScroll: true });
    });
  }

  private destacar(id: number): void {
    this.destacadoId = id;
    setTimeout(() => {
      if (this.destacadoId === id) this.destacadoId = null;
      this.cdr.markForCheck();
    }, 1700);
  }

  private novoForm(): LocalRequest {
    return { nome: '', ativo: true };
  }
}
