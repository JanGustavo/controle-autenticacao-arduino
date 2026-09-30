import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
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
  private cdr = inject(ChangeDetectorRef);

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
        console.log("Recebeu dados:", dados);
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
}