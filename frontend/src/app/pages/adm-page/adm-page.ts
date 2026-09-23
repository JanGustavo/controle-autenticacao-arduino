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