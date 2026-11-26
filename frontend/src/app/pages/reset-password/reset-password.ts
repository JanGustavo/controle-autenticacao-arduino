import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthFrame, EtapaAuth } from '../../components/auth-frame/auth-frame';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    AuthFrame,
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss'
})
export class ResetPassword implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  /** Etapas da recuperação vistas desta tela: o link já foi aberto; falta a senha nova. */
  get etapas(): EtapaAuth[] {
    const salva = !!this.sucesso();
    return [
      { titulo: 'Informe seu e-mail', texto: 'O mesmo usado para entrar no painel.', icone: 'alternate_email', estado: 'done' },
      this.token
        ? { titulo: 'Abra o link recebido', texto: 'Link aberto.', icone: 'mark_email_read', estado: 'done' }
        : { titulo: 'Abra o link recebido', texto: 'Link incompleto: peça um novo.', icone: 'link_off', estado: 'fail' },
      { titulo: 'Crie uma nova senha', texto: salva ? 'Senha salva.' : 'E entre de novo no painel.', icone: 'password', estado: salva ? 'ok' : this.token ? 'active' : null },
    ];
  }

  /** As duas senhas foram digitadas e não coincidem (aviso antes de enviar). */
  get senhasDiferentes(): boolean {
    return !!this.nova_senha && !!this.confirmar_senha && this.nova_senha !== this.confirmar_senha;
  }

  token: string | null = null;
  nova_senha = '';
  confirmar_senha = '';
  hidePassword = signal(true);
  carregando = signal(false);
  erro = signal<string | null>(null);
  sucesso = signal<string | null>(null);

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      if (!this.token) {
        this.erro.set('Token de recuperação não fornecido.');
      }
    });
  }

  togglePassword(event: MouseEvent) {
    this.hidePassword.update((val) => !val);
    event.stopPropagation();
  }

  onSubmit() {
    if (!this.token) {
      this.erro.set('Token de recuperação ausente.');
      return;
    }
    
    if (!this.nova_senha || !this.confirmar_senha) {
      this.erro.set('Por favor, preencha ambas as senhas.');
      return;
    }

    if (this.nova_senha !== this.confirmar_senha) {
      this.erro.set('As senhas não coincidem.');
      return;
    }

    this.carregando.set(true);
    this.erro.set(null);
    this.sucesso.set(null);

    this.api.redefinirSenha(this.token, this.nova_senha).subscribe({
      next: (res) => {
        this.carregando.set(false);
        this.sucesso.set(res.mensagem || 'Senha redefinida com sucesso.');
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (error) => {
        this.carregando.set(false);
        this.erro.set(
          error.error?.detail || 'Não foi possível redefinir a senha. O token pode estar inválido ou expirado.'
        );
      },
    });
  }
}
