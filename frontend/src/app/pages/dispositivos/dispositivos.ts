import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
    RouterLink,
  ],
  templateUrl: './dispositivos.html',
  styleUrl: '../locais/locais.scss',
})
export class DispositivosPage implements OnInit {
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  dispositivos: DispositivoResponse[] = [];
  locais: LocalResponse[] = [];
  carregando = true;
  salvando = false;
  editandoId: number | null = null;
  erro = '';

  filtroTexto = '';
  filtroAtivo = 'todos';
  filtroLocalId: number | null = null;

  form: DispositivoRequest = this.novoForm();

  get displayedDispositivos(): DispositivoResponse[] {
    const termo = this.filtroTexto.trim().toLowerCase();

    return this.dispositivos.filter((dispositivo) => {
      const local = this.locais.find(
        (item) => item.local_id === dispositivo.local_id
      );

      const matchTexto =
        !termo ||
        dispositivo.nome.toLowerCase().includes(termo) ||
        dispositivo.identificador.toLowerCase().includes(termo) ||
        (local?.nome.toLowerCase().includes(termo) ?? false);

      const matchAtivo =
        this.filtroAtivo === 'todos' ||
        (this.filtroAtivo === 'ativo' && dispositivo.ativo) ||
        (this.filtroAtivo === 'inativo' && !dispositivo.ativo);

      const matchLocal =
        this.filtroLocalId === null ||
        dispositivo.local_id === this.filtroLocalId;

      return matchTexto && matchAtivo && matchLocal;
    });
  }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;

    this.api.getLocais().subscribe({
      next: (locais) => {
        this.locais = locais;
        this.cdr.markForCheck();
      },
      error: () => {
        this.erro = 'Não foi possível carregar os locais.';
        this.cdr.markForCheck();
      },
    });

    this.api.getDispositivos().subscribe({
      next: (dispositivos) => {
        this.dispositivos = dispositivos;
        this.erro = '';
        this.carregando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.erro = 'Não foi possível carregar os dispositivos.';
        this.carregando = false;
        this.cdr.markForCheck();
      },
    });
  }

  nomeLocal(localId: number): string {
    return this.locais.find((local) => local.local_id === localId)?.nome
      ?? `ID ${localId}`;
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
      this.erro = 'Informe local, nome e identificador do dispositivo.';
      return;
    }

    this.salvando = true;

    const request = this.editandoId === null
      ? this.api.criarDispositivo(payload)
      : this.api.atualizarDispositivo(this.editandoId, payload);

    request.subscribe({
      next: (dispositivo) => {
        this.salvando = false;
        this.dispositivos = this.editandoId === null
          ? [...this.dispositivos, dispositivo].sort(
              (a, b) => a.dispositivo_id - b.dispositivo_id
            )
          : this.dispositivos.map((item) =>
              item.dispositivo_id === dispositivo.dispositivo_id
                ? dispositivo
                : item
            );

        this.snackBar.open(
          this.editandoId === null
            ? 'Dispositivo criado com sucesso.'
            : 'Dispositivo atualizado com sucesso.',
          'Fechar',
          { duration: 4000 }
        );

        this.cancelar();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.salvando = false;
        this.erro = error.status === 409
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
  }

  excluir(dispositivo: DispositivoResponse): void {
    if (!confirm(`Excluir o dispositivo "${dispositivo.nome}"?`)) return;

    this.api.deletarDispositivo(dispositivo.dispositivo_id).subscribe({
      next: () => {
        this.dispositivos = this.dispositivos.filter(
          (item) => item.dispositivo_id !== dispositivo.dispositivo_id
        );
        this.snackBar.open(
          'Dispositivo excluído com sucesso.',
          'Fechar',
          { duration: 4000 }
        );
        this.cdr.markForCheck();
      },
      error: () => {
        this.erro = 'Não foi possível excluir o dispositivo.';
        this.cdr.markForCheck();
      },
    });
  }

  cancelar(): void {
    this.editandoId = null;
    this.form = this.novoForm();
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
