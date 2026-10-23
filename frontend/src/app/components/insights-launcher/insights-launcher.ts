import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
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
  rotaAtual = signal(this.router.url.split('?')[0]);
  pergunta = '';

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe((event) => this.rotaAtual.set(event.urlAfterRedirects.split('?')[0]));
  }

  enviar(): void {
    const pergunta = this.pergunta.trim();
    if (pergunta.length < 3) return;
    this.ia.prepararPergunta(pergunta);
    this.pergunta = '';
    this.aberto.set(false);
    void this.router.navigateByUrl('/ia');
  }

  abrirPagina(): void {
    void this.router.navigateByUrl('/ia');
  }
}
