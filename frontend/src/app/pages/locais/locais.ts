import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';

import { ApiService, LocalRequest, LocalResponse } from '../../services/api.service';

@Component({
  selector: 'app-locais-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatSnackBarModule, RouterLink],
  templateUrl: './locais.html',
  styleUrl: './locais.scss',
})
export class LocaisPage implements OnInit {
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  locais: LocalResponse[] = [];
  carregando = true;
  salvando = false;
  editandoId: number | null = null;
  erro = '';
  form: LocalRequest = this.novoForm();

  // Filtros de busca
  filtroTexto = '';
  filtroAtivo = 'todos'; // 'todos' | 'ativo' | 'inativo'

  get displayedLocais(): LocalResponse[] {
    return this.locais.filter((local) => {
      const matchTexto =
        !this.filtroTexto ||
        local.nome.toLowerCase().includes(this.filtroTexto.trim().toLowerCase()) ||
        local.identificador_dispositivo.toLowerCase().includes(this.filtroTexto.trim().toLowerCase());

      const matchAtivo =
        this.filtroAtivo === 'todos' ||
        (this.filtroAtivo === 'ativo' && local.ativo) ||
        (this.filtroAtivo === 'inativo' && !local.ativo);

      return matchTexto && matchAtivo;
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
        this.erro = '';
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Não foi possível carregar os locais.';
        this.carregando = false;
      },
    });
  }

  salvar(): void {
    this.erro = '';
    const payload: LocalRequest = {
      nome: this.form.nome.trim(),
      identificador_dispositivo: this.form.identificador_dispositivo.trim().toUpperCase(),
      ativo: this.form.ativo,
    };
    if (payload.nome.length < 2 || !payload.identificador_dispositivo) {
      this.erro = 'Informe o nome e o identificador do dispositivo.';
      return;
    }

    this.salvando = true;
    const request = this.editandoId === null
      ? this.api.criarLocal(payload)
      : this.api.atualizarLocal(this.editandoId, payload);

    request.subscribe({
      next: (local) => {
        this.salvando = false;
        this.locais = this.editandoId === null
          ? [...this.locais, local].sort((a, b) => a.local_id - b.local_id)
          : this.locais.map((item) => item.local_id === local.local_id ? local : item);
        this.snackBar.open(this.editandoId === null ? 'Local criado com sucesso.' : 'Local atualizado com sucesso.', 'Fechar', { duration: 4000 });
        this.cancelar();
      },
      error: (error) => {
        this.salvando = false;
        this.erro = error.status === 409
          ? 'Este identificador de dispositivo já está cadastrado.'
          : 'Não foi possível salvar o local.';
      },
    });
  }

  editar(local: LocalResponse): void {
    this.editandoId = local.local_id;
    this.form = {
      nome: local.nome,
      identificador_dispositivo: local.identificador_dispositivo,
      ativo: local.ativo,
    };
    this.erro = '';
  }

  excluir(local: LocalResponse): void {
    if (!confirm(`Excluir o local "${local.nome}"? As permissões vinculadas também serão removidas.`)) return;
    this.api.deletarLocal(local.local_id).subscribe({
      next: () => {
        this.locais = this.locais.filter((item) => item.local_id !== local.local_id);
        this.snackBar.open('Local excluído com sucesso.', 'Fechar', { duration: 4000 });
      },
      error: () => (this.erro = 'Não foi possível excluir o local.'),
    });
  }

  cancelar(): void {
    this.editandoId = null;
    this.form = this.novoForm();
  }

  private novoForm(): LocalRequest {
    return { nome: '', identificador_dispositivo: '', ativo: true };
  }
}
