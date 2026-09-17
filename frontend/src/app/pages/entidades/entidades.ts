import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  selector: 'app-entidades-page',
  templateUrl: './entidades.html',
  styleUrl: './entidades.scss',
})
export class EntidadesPage {
  // Mapeia o estado de expansão de cada entidade
  expandido: Record<string, boolean> = {
    usuario: false,
    permissao: false,
    historico_acesso: false,
    local: false,
    administrador: false,
    audit_logs: false,
    password_reset_token: false,
  };

  toggleEntity(nome: string): void {
    this.expandido[nome] = !this.expandido[nome];
  }

  toggleTodos(): void {
    const todosExpandidos = Object.values(this.expandido).every((v) => v);
    Object.keys(this.expandido).forEach((key) => {
      this.expandido[key] = !todosExpandidos;
    });
  }

  get todosExpandidos(): boolean {
    return Object.values(this.expandido).every((v) => v);
  }
}