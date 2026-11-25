import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthFrame, EtapaAuth } from '../../components/auth-frame/auth-frame';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    AuthFrame,
  ],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss'
})
export class ForgotPassword {
  private api = inject(ApiService);

  /** Etapas da recuperação; depois do envio, a próxima é abrir o link do e-mail. */
  get etapas(): EtapaAuth[] {
    const enviado = !!this.sucesso();
    return [
      { titulo: 'Informe seu e-mail', texto: 'O mesmo usado para entrar no painel.', icone: 'alternate_email', estado: enviado ? 'done' : 'active' },
      { titulo: 'Abra o link recebido', texto: 'Ele leva à tela de nova senha.', icone: 'mark_email_read', estado: enviado ? 'active' : null },
      { titulo: 'Crie uma nova senha', texto: 'E entre de novo no painel.', icone: 'password', estado: null },
    ];
  }

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
