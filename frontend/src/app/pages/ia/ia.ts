import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { IAService, ResumoIA } from '../../services/ia.service';

@Component({
  selector: 'app-ia',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './ia.html',
  styleUrl: './ia.scss',
})
export class IAPage implements OnInit {
  private ia = inject(IAService);
  pergunta = 'Liste todos os usuários e o percentual de acessos aceitos e negados.';
  resumo = signal<ResumoIA | null>(null);
  resposta = signal('');
  erro = signal('');
  carregando = signal(false);
  consultando = signal(false);

  ngOnInit(): void {
    this.carregando.set(true);
    this.ia.resumo().subscribe({
      next: (resumo) => {
        this.resumo.set(resumo);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os indicadores.');
        this.carregando.set(false);
      },
    });
  }

  consultar(): void {
    const pergunta = this.pergunta.trim();
    if (pergunta.length < 3 || this.consultando()) return;
    this.consultando.set(true);
    this.erro.set('');
    this.ia.perguntar(pergunta).subscribe({
      next: ({ resposta, resumo }) => {
        this.resposta.set(resposta);
        this.resumo.set(resumo);
        this.consultando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.erro.set(typeof error.error?.detail === 'string'
          ? error.error.detail : 'Não foi possível consultar a Groq.');
        this.consultando.set(false);
      },
    });
  }
}
