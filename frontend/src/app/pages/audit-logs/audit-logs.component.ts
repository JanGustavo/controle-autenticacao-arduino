import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuditLogsService, AuditLog } from '../../services/audit-logs.service';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    RouterLink,
  ],
  templateUrl: './audit-logs.component.html',
  styleUrl: './audit-logs.component.scss',
})
export class AuditLogsComponent implements OnInit {
  private auditLogsService = inject(AuditLogsService);

  logs: AuditLog[] = [];
  carregando = true;
  erro = '';

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.auditLogsService.getAuditLogs().subscribe({
      next: (dados) => {
        this.logs = dados;
        this.erro = '';
        this.carregando = false;
      },
      error: (err) => {
        console.error('Erro ao carregar logs de auditoria:', err);
        this.erro = 'Não foi possível carregar os logs de auditoria.';
        this.carregando = false;
      },
    });
  }

  formatDate(isoDate: string): string {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toLocaleString();
  }
}
