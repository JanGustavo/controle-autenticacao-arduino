import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { ApiService, AdmPageResponse } from '../../services/api.service';

@Component({
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, RouterLink],
  selector: 'app-adm-page',
  styleUrl: './adm-page.scss',
  templateUrl: './adm-page.html',
})
export class AdmPage implements OnInit {
  private api = inject(ApiService);

  dados = signal<AdmPageResponse | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getAdmPage().subscribe({
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
