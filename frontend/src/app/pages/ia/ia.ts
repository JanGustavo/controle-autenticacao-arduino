import { Component, computed, inject, OnInit, SecurityContext, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { Marked } from 'marked';
import { IAService, RespostaIA, ResumoIA } from '../../services/ia.service';

const markdown = new Marked({
  async: false,
  gfm: true,
  breaks: true,
  renderer: { html: () => '' },
});

@Component({
  selector: 'app-ia',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './ia.html',
  styleUrl: './ia.scss',
  encapsulation: ViewEncapsulation.None,
})
export class IAPage implements OnInit {
  private ia = inject(IAService);
  private sanitizer = inject(DomSanitizer);
  pergunta = '';
  readonly sugestoes = [
    'Quais foram os acessos aceitos e negados nesta semana?',
    'Quais usuários tiveram mais tentativas de acesso negadas?',
    'Quantos logins foram registrados por IP nos últimos 7 dias?',
  ];
  resumo = signal<ResumoIA | null>(null);
  historico = signal<RespostaIA[]>([]);
  usuariosDestaque = computed(() =>
    [...(this.resumo()?.usuarios ?? [])].filter((usuario) => usuario.total > 0)
      .sort((a, b) => b.total - a.total).slice(0, 3)
  );
  erro = signal('');
  carregando = signal(false);
  consultando = signal(false);
  atualizando = signal<number | null>(null);
  apagando = signal<number | null>(null);

  ngOnInit(): void {
    const perguntaPendente = this.ia.consumirPergunta();
    if (perguntaPendente) {
      this.pergunta = perguntaPendente;
      this.consultar();
    }
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
    this.ia.historico().subscribe({
      next: (itens) => {
        this.historico.update((atuais) => [
          ...atuais.filter((atual) => !itens.some((item) => item.id === atual.id)),
          ...itens,
        ].slice(0, 30));
        if (!perguntaPendente) this.pergunta = itens[0]?.pergunta ?? '';
      },
      error: () => this.erro.set('Não foi possível carregar as perguntas anteriores.'),
    });
  }

  renderizar(resposta: string): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, markdown.parse(resposta) as string) ?? '';
  }

  preencher(sugestao: string): void {
    this.pergunta = sugestao;
  }

  alturaBarra(total: number): number {
    if (total === 0) return 0;
    const maximo = Math.max(1, ...(this.resumo()?.insights.serie_7_dias.map((dia) => dia.total) ?? []));
    return Math.max(8, Math.round(total * 100 / maximo));
  }

  diaLabel(dia: string): string {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
      .format(new Date(`${dia}T12:00:00Z`));
  }

  apagar(itemId: number): void {
    if (this.apagando() !== null) return;
    this.apagando.set(itemId);
    this.ia.apagar(itemId).subscribe({
      next: () => {
        const removido = this.historico().find((item) => item.id === itemId);
        this.historico.update((itens) => itens.filter((item) => item.id !== itemId));
        if (this.pergunta.trim() === removido?.pergunta) this.pergunta = this.historico()[0]?.pergunta ?? '';
        this.apagando.set(null);
      },
      error: () => {
        this.erro.set('Não foi possível apagar a resposta.');
        this.apagando.set(null);
      },
    });
  }

  atualizar(itemId: number): void {
    if (this.atualizando() !== null) return;
    this.atualizando.set(itemId);
    this.erro.set('');
    this.ia.atualizar(itemId).subscribe({
      next: ({ resumo, item }) => {
        this.historico.update((itens) => itens.map((atual) => atual.id === itemId ? item : atual));
        this.resumo.set(resumo);
        this.atualizando.set(null);
      },
      error: (error: HttpErrorResponse) => {
        this.erro.set(typeof error.error?.detail === 'string'
          ? error.error.detail : 'Não foi possível atualizar a análise.');
        this.atualizando.set(null);
      },
    });
  }

  consultar(): void {
    const pergunta = this.pergunta.trim();
    if (pergunta.length < 3 || this.consultando()) return;
    this.consultando.set(true);
    this.erro.set('');
    this.ia.perguntar(pergunta).subscribe({
      next: ({ resumo, item }) => {
        this.historico.update((itens) => [item, ...itens].slice(0, 30));
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
