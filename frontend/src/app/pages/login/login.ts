import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthFrame, EtapaAuth } from '../../components/auth-frame/auth-frame';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    AuthFrame,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private api = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);


  /** A decisão de acesso que o painel controla, na ordem em que acontece. */
  readonly etapas: EtapaAuth[] = [
    { titulo: 'Cartão RFID', texto: 'Lido pelo leitor ESP32 na porta.', icone: 'contactless', estado: 'done' },
    { titulo: 'Permissão', texto: 'Local, dia da semana e horário.', icone: 'vpn_key', estado: 'done' },
    { titulo: 'Rosto do titular', texto: 'Comparado 1:1 com a biometria cadastrada.', icone: 'face', estado: 'done' },
    { titulo: 'Decisão', texto: 'Porta liberada ou negada, e tudo fica no histórico.', icone: 'lock_open', estado: 'ok' },
  ];

  usuario = '';
  senha = '';
  hidePassword = signal(true);
  carregando = signal(false);
  erro = signal<string | null>(null);

  togglePassword(event: MouseEvent) {
    this.hidePassword.update((val) => !val);
    event.stopPropagation();
  }

  async onSubmit() {
    if (!this.usuario || !this.senha) {
      this.erro.set('Por favor, preencha o e-mail e a senha.');
      return;
    }

    this.carregando.set(true);
    this.erro.set(null);


    if (this.usuario.trim().toLowerCase() === 'root') {
      try {
        const response = await fetch('/plataforma/api/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario: this.usuario.trim().toLowerCase(), senha: this.senha }),
        });
        if (!response.ok) throw new Error('Usuário ou senha incorretos.');
        window.location.assign('/plataforma/root');
      } catch (error) {
        this.erro.set(error instanceof Error ? error.message : 'Não foi possível autenticar.');
        this.carregando.set(false);
      }
      return;
    }
    this.api.loginAdm(this.usuario, this.senha).subscribe({
      next: (res) => {
        this.carregando.set(false);
        if (res.sucesso && res.token) {
          this.authService.setToken(res.token);
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
