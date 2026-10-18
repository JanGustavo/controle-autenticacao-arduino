import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { ApiService, HealthResponse } from '../../services/api.service';
import { signal } from '@angular/core';

@Component({
  selector: 'app-adm-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterLink,
  ],
  templateUrl: './adm-page.html',
  styleUrl: './adm-page.scss',
})
export class AdmPage implements OnInit {
  private api = inject(ApiService);

  readonly grupos = [
    {
      title: 'Operação',
      description: 'Prepare e acompanhe o fluxo de acesso.',
      links: [
        {
          path: '/usuarios',
          title: 'Usuários',
          description: 'Gerenciar dados, cartões e biometria',
          icon: 'group',
        },
        {
          path: '/permissoes',
          title: 'Permissões',
          description: 'Definir locais, dias e horários',
          icon: 'schedule',
        },
        {
          path: '/validar-acesso',
          title: 'Validar acesso',
          description: 'Confirmar cartão e rosto do titular',
          icon: 'face',
        },
        {
          path: '/dashboard',
          title: 'Histórico de acesso',
          description: 'Consultar tentativas e resultados',
          icon: 'history',
        },
      ],
    },
    {
      title: 'Configuração e gestão',
      description: 'Organize a infraestrutura e as contas administrativas.',
      links: [
        {
          path: '/locais',
          title: 'Locais',
          description: 'Gerenciar pontos de acesso',
          icon: 'location_on',
        },
        {
          path: '/dispositivos',
          title: 'Dispositivos',
          description: 'Vincular os leitores aos locais',
          icon: 'memory',
        },
        {
          path: '/administradores',
          title: 'Administradores',
          description: 'Gerenciar contas administrativas',
          icon: 'admin_panel_settings',
        },
        {
          path: '/audit-logs',
          title: 'Auditoria',
          description: 'Consultar ações administrativas',
          icon: 'fact_check',
        },
        {
          path: '/entidades',
          title: 'Modelo de dados',
          description: 'Consultar a estrutura do projeto',
          icon: 'account_tree',
        },
      ],
    },
  ];

  dados = signal<HealthResponse | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getHealth().subscribe({
      next: (res) => {
        this.dados.set(res);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível conectar ao servidor.');
        this.carregando.set(false);
      },
    });
  }
}
