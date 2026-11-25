import { Component, inject, OnInit, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { AuditLogsService, AuditLog } from '../../services/audit-logs.service';

type Categoria = 'todas' | 'criacao' | 'alteracao' | 'exclusao' | 'acesso';
type Resultado = 'todos' | 'sucesso' | 'falha';

/** Rótulos para os códigos gravados pelo backend. Código desconhecido aparece como veio. */
const VERBOS: Record<string, string> = {
  LOGIN_SUCCESS: 'Entrou no painel',
  LOGIN_FAILED: 'Tentou entrar',
  PASSWORD_RESET_REQUESTED: 'Pediu nova senha',
  PASSWORD_RESET_COMPLETED: 'Redefiniu a senha',
};
const RECURSOS: Record<string, string> = {
  USER: 'Usuário',
  USER_RFID: 'Cartão do usuário',
  USER_BIOMETRICS: 'Biometria do usuário',
  PERMISSION: 'Permissão',
  LOCAL: 'Local',
  DEVICE: 'Dispositivo',
  ADMIN: 'Administrador',
  AUTH: 'Autenticação',
};

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, RouterLink],
  templateUrl: './audit-logs.component.html',
  styleUrl: './audit-logs.component.scss',
})
export class AuditLogsComponent implements OnInit {
  private auditLogsService = inject(AuditLogsService);
  private cdr = inject(ChangeDetectorRef);

  logs: AuditLog[] = [];
  carregando = true;
  erro = '';

  readonly busca = signal('');
  readonly categoriaFiltro = signal<Categoria>('todas');
  readonly resultadoFiltro = signal<Resultado>('todos');

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.auditLogsService.getAuditLogs().subscribe({
      next: (dados) => {
        this.logs = dados;
        this.erro = '';
        this.carregando = false;
        this.cdr.detectChanges(); // Força a atualização da View
      },
      error: (err) => {
        console.error('Erro ao carregar logs de auditoria:', err);
        this.erro = 'Não foi possível carregar os logs de auditoria.';
        this.carregando = false;
        this.cdr.detectChanges();
      },
    });
  }

  get filtrando(): boolean {
    return !!this.busca().trim() || this.categoriaFiltro() !== 'todas' || this.resultadoFiltro() !== 'todos';
  }

  get exibidos(): AuditLog[] {
    const termo = this.busca().trim().toLowerCase();
    const categoria = this.categoriaFiltro();
    const resultado = this.resultadoFiltro();
    return this.logs.filter((log) => {
      if (categoria !== 'todas' && this.categoria(log.action) !== categoria) return false;
      if (resultado === 'sucesso' && !this.sucesso(log)) return false;
      if (resultado === 'falha' && this.sucesso(log)) return false;
      if (!termo) return true;
      return [log.admin_nome, log.description, log.action, log.resource_type, this.verbo(log), this.recurso(log), log.ip_address]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(termo));
    });
  }

  get totalFalhas(): number {
    return this.logs.filter((log) => !this.sucesso(log)).length;
  }

  limparFiltros(): void {
    this.busca.set('');
    this.categoriaFiltro.set('todas');
    this.resultadoFiltro.set('todos');
  }

  categoria(action: string): Categoria {
    const codigo = (action || '').toUpperCase();
    if (codigo.startsWith('CREATE')) return 'criacao';
    if (codigo.startsWith('UPDATE')) return 'alteracao';
    if (codigo.startsWith('DELETE')) return 'exclusao';
    if (codigo.startsWith('LOGIN') || codigo.startsWith('PASSWORD')) return 'acesso';
    return 'todas';
  }

  verbo(log: AuditLog): string {
    const codigo = (log.action || '').toUpperCase();
    if (VERBOS[codigo]) return VERBOS[codigo];
    switch (this.categoria(codigo)) {
      case 'criacao':
        return 'Criou';
      case 'alteracao':
        return 'Alterou';
      case 'exclusao':
        return 'Excluiu';
      default:
        return log.action || 'Ação';
    }
  }

  icone(log: AuditLog): string {
    switch (this.categoria(log.action)) {
      case 'criacao':
        return 'add_circle';
      case 'alteracao':
        return 'edit';
      case 'exclusao':
        return 'delete';
      case 'acesso':
        return 'login';
      default:
        return 'bolt';
    }
  }

  recurso(log: AuditLog): string {
    const codigo = (log.resource_type || '').toUpperCase();
    return RECURSOS[codigo] ?? log.resource_type ?? '';
  }

  sucesso(log: AuditLog): boolean {
    return (log.status || '').toUpperCase() === 'SUCCESS';
  }

  formatDate(isoDate: string): string {
    if (!isoDate) return '-';
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return isoDate;
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      const horas = String(d.getHours()).padStart(2, '0');
      const minutos = String(d.getMinutes()).padStart(2, '0');
      const segundos = String(d.getSeconds()).padStart(2, '0');
      return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
    } catch {
      return isoDate;
    }
  }

  /** Data e hora separadas, para a coluna Quando. */
  partesData(isoDate: string): { data: string; hora: string } {
    const [data = '-', hora = ''] = this.formatDate(isoDate).split(' ');
    return { data, hora };
  }
}
