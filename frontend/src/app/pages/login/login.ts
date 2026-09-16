import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private api = inject(ApiService);
  private router = inject(Router);

  usuario = '';
  senha = '';
  hidePassword = signal(true);
  carregando = signal(false);
  erro = signal<string | null>(null);

  togglePassword(event: MouseEvent) {
    this.hidePassword.update((val) => !val);
    event.stopPropagation();
  }

  onSubmit() {
    if (!this.usuario || !this.senha) {
      this.erro.set('Por favor, preencha o e-mail e a senha.');
      return;
    }

    this.carregando.set(true);
    this.erro.set(null);

    this.api.loginAdm(this.usuario, this.senha).subscribe({
      next: (res) => {
        this.carregando.set(false);
        if (res.sucesso && res.token) {
          localStorage.setItem('adm_token', res.token);
          this.router.navigate(['/adm-page']);
        } else {
          this.erro.set(res.mensagem || 'Credenciais inválidas.');
        }
      },
      error: (error) => {
        this.carregando.set(false);
        this.erro.set(
          error.error?.detail || 'Não foi possível autenticar. Verifique o usuário e a senha.',
        );
      },
    });
  }
}
