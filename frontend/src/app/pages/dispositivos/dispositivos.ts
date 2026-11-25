import { ConfirmationService } from '../../components/confirmation-dialog/confirmation-dialog';
import { ChangeDetectorRef, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';

import {
  ApiService,
  DispositivoRequest,
  DispositivoResponse,
  LocalResponse,
} from '../../services/api.service';

@Component({
  selector: 'app-dispositivos-page',
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
  templateUrl: './dispositivos.html',
  styleUrl: './dispositivos.scss',
})
export class DispositivosPage implements OnInit {
  private confirmation = inject(ConfirmationService);
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  dispositivos: DispositivoResponse[] = [];
  locais: LocalResponse[] = [];
  carregando = true;
  salvando = false;
  editandoId: number | null = null;
  /** Erro do formulário (validação ou salvamento). */
  erro = '';
  /** Erro ao carregar a lista; fica separado para não apagar a tabela. */
  erroLista = '';
  carregandoLocais = true;
  destacadoId: number | null = null;

  filtroTexto = '';
  filtroAtivo = 'todos';
  filtroLocalId: number | null = null;

  form: DispositivoRequest = this.novoForm();

  @ViewChild('editor') private editor?: ElementRef<HTMLElement>;
  @ViewChild('localSelect') private localSelect?: ElementRef<HTMLSelectElement>;

  get ativos(): number {
    return this.dispositivos.filter((dispositivo) => dispositivo.ativo).length;
  }

  get filtrando(): boolean {
    return !!this.filtroTexto.trim() || this.filtroAtivo !== 'todos' || this.filtroLocalId !== null;
  }

  /** Só locais ativos recebem leitor novo; o atual continua listado na edição. */
  get locaisDoFormulario(): LocalResponse[] {
    return this.locais.filter((local) => local.ativo || local.local_id === this.form.local_id);
  }

  limparFiltros(): void {
    this.filtroTexto = '';
    this.filtroAtivo = 'todos';
    this.filtroLocalId = null;
  }

  get displayedDispositivos(): DispositivoResponse[] {
    const termo = this.filtroTexto.trim().toLowerCase();

    return this.dispositivos.filter((dispositivo) => {
      const local = this.locais.find((item) => item.local_id === dispositivo.local_id);

      const matchTexto =
        !termo ||
        dispositivo.nome.toLowerCase().includes(termo) ||
        dispositivo.identificador.toLowerCase().includes(termo) ||
        (local?.nome.toLowerCase().includes(termo) ?? false);

      const matchAtivo =
        this.filtroAtivo === 'todos' ||
        (this.filtroAtivo === 'ativo' && dispositivo.ativo) ||
        (this.filtroAtivo === 'inativo' && !dispositivo.ativo);

      const matchLocal = this.filtroLocalId === null || dispositivo.local_id === this.filtroLocalId;

      return matchTexto && matchAtivo && matchLocal;
    });
  }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.carregandoLocais = true;
    this.erroLista = '';
    this.api.getLocais().subscribe({
      next: (locais) => {
        this.locais = locais;
        this.carregandoLocais = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.carregandoLocais = false;
        this.erro = 'Não foi possível carregar os locais. Recarregue a página para escolher um local.';
        this.cdr.markForCheck();
      },
    });
    this.api.getDispositivos().subscribe({
      next: (dispositivos) => {
        this.dispositivos = dispositivos;
        this.carregando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.erroLista = 'Não foi possível carregar os dispositivos.';
        this.carregando = false;
        this.cdr.markForCheck();
      },
    });
  }

  nomeLocal(localId: number): string {
    return this.locais.find((local) => local.local_id === localId)?.nome ?? `ID ${localId}`;
  }

  salvar(): void {
    this.erro = '';

    const payload: DispositivoRequest = {
      local_id: Number(this.form.local_id),
      nome: this.form.nome.trim(),
      identificador: this.form.identificador.trim().toUpperCase(),
      ativo: this.form.ativo,
    };

    if (!payload.local_id || payload.nome.length < 2 || !payload.identificador) {
      this.erro = !payload.local_id
        ? 'Escolha o local onde o leitor está instalado.'
        : payload.nome.length < 2
          ? 'Informe o nome do dispositivo, com pelo menos 2 caracteres.'
          : 'Informe o identificador gravado no firmware do ESP32.';
      // Leva o foco ao campo que precisa de ajuste, como em Locais.
      const campo = !payload.local_id ? 'disp-local' : payload.nome.length < 2 ? 'disp-nome' : 'disp-identificador';
      document.getElementById(campo)?.focus();
      return;
    }

    this.salvando = true;

    const request =
      this.editandoId === null
        ? this.api.criarDispositivo(payload)
        : this.api.atualizarDispositivo(this.editandoId, payload);

    request.subscribe({
      next: (dispositivo) => {
        this.salvando = false;
        this.dispositivos =
          this.editandoId === null
            ? [...this.dispositivos, dispositivo].sort(
                (a, b) => a.dispositivo_id - b.dispositivo_id,
              )
            : this.dispositivos.map((item) =>
                item.dispositivo_id === dispositivo.dispositivo_id ? dispositivo : item,
              );

        this.snackBar.open(
          this.editandoId === null
            ? `Dispositivo ${dispositivo.nome} cadastrado.`
            : `Alterações em ${dispositivo.nome} salvas.`,
          'Fechar',
          { duration: 4000 },
        );
        this.destacar(dispositivo.dispositivo_id);
        this.cancelar();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.salvando = false;
        this.erro =
          error.status === 409
            ? 'Este identificador de dispositivo já está cadastrado.'
            : 'Não foi possível salvar o dispositivo.';
        this.cdr.markForCheck();
      },
    });
  }

  editar(dispositivo: DispositivoResponse): void {
    this.editandoId = dispositivo.dispositivo_id;
    this.form = {
      local_id: dispositivo.local_id,
      nome: dispositivo.nome,
      identificador: dispositivo.identificador,
      ativo: dispositivo.ativo,
    };
    this.erro = '';
    setTimeout(() => {
      const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this.editor?.nativeElement.scrollIntoView({ block: 'nearest', behavior: reduzir ? 'auto' : 'smooth' });
      this.localSelect?.nativeElement.focus({ preventScroll: true });
    });
  }

  async excluir(dispositivo: DispositivoResponse): Promise<void> {
    if (
      !(await this.confirmation.excluir(
        'Excluir dispositivo?',
        `O dispositivo "${dispositivo.nome}" será removido.`,
        {
          items: [
            {
              icon: 'memory',
              label: dispositivo.nome,
              description: 'Dispositivo e identificador de comunicação.',
            },
            {
              icon: 'location_on',
              label: 'Vínculo com o local',
              description: 'A associação deste dispositivo será removida.',
            },
          ],
        },
      ))
    )
      return;

    this.api.deletarDispositivo(dispositivo.dispositivo_id).subscribe({
      next: () => {
        this.dispositivos = this.dispositivos.filter(
          (item) => item.dispositivo_id !== dispositivo.dispositivo_id,
        );
        this.snackBar.open(`Dispositivo ${dispositivo.nome} excluído.`, 'Fechar', { duration: 4000 });
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackBar.open(`Não foi possível excluir ${dispositivo.nome}. Tente novamente.`, 'Fechar', {
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

  private destacar(id: number): void {
    this.destacadoId = id;
    setTimeout(() => {
      if (this.destacadoId === id) this.destacadoId = null;
      this.cdr.markForCheck();
    }, 1700);
  }

  private novoForm(): DispositivoRequest {
    return {
      local_id: 0,
      nome: '',
      identificador: '',
      ativo: true,
    };
  }
}
