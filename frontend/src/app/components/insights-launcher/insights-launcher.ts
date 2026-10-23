import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IAService } from '../../services/ia.service';

@Component({
  selector: 'app-insights-launcher',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './insights-launcher.html',
  styleUrl: './insights-launcher.scss',
})
export class InsightsLauncher {
  readonly auth = inject(AuthService);
  readonly router = inject(Router);
  private readonly ia = inject(IAService);
  aberto = signal(false);
  pergunta = '';

  enviar(): void {
    const pergunta = this.pergunta.trim();
    if (pergunta.length < 3) return;
    this.ia.prepararPergunta(pergunta);
    this.pergunta = '';
    this.aberto.set(false);
    void this.router.navigateByUrl('/ia');
  }

  abrirPagina(): void {
    this.aberto.set(false);
    void this.router.navigateByUrl('/ia');
  }
}
