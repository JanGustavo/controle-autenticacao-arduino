import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss'
})
export class ForgotPassword {
  private api = inject(ApiService);

  email = '';
  carregando = signal(false);
  erro = signal<string | null>(null);
  sucesso = signal<string | null>(null);

  onSubmit() {
    if (!this.email) {
      this.erro.set('Por favor, preencha o e-mail.');
      return;
    }

    this.carregando.set(true);
    this.erro.set(null);
    this.sucesso.set(null);

    this.api.solicitarRecuperacaoSenha(this.email).subscribe({
      next: (res) => {
        this.carregando.set(false);
        this.sucesso.set(res.mensagem || 'E-mail enviado com sucesso.');
      },
      error: (error) => {
        this.carregando.set(false);
        this.erro.set(
          error.error?.detail || 'Não foi possível solicitar a recuperação. Tente novamente mais tarde.'
        );
      },
    });
  }
}
