import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { WebcamService } from '../../services/webcam.service';

@Component({
  selector: 'app-visor-facial',
  imports: [MatIconModule],
  templateUrl: './visor-facial.html',
  styleUrl: './visor-facial.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisorFacial {
  protected webcam = inject(WebcamService);
  readonly videoElement = viewChild<ElementRef<HTMLVideoElement>>('video');
  readonly validandoTitular = input(false);

  protected readonly fases = [
    { inicio: 0, fim: 30, texto: 'Enquadramento' },
    { inicio: 30, fim: 70, texto: 'Análise do olhar' },
    { inicio: 70, fim: 100, texto: 'Confirmação da captura' },
  ];

  protected readonly faseAtual = computed(() => {
    const progresso = this.webcam.progressoAutoCaptura();
    if (progresso >= this.fases[2].inicio) return 2;
    return progresso >= this.fases[1].inicio ? 1 : 0;
  });

  protected readonly proporcaoRetrato = computed(() => {
    const largura = this.webcam.larguraFrameProcessado();
    const altura = this.webcam.alturaFrameProcessado();
    return largura && altura ? largura / altura : 3 / 4;
  });

  protected readonly reticulo = computed(() => {
    const box = this.webcam.faceBox();
    const largura = this.webcam.larguraFrameProcessado();
    const altura = this.webcam.alturaFrameProcessado();
    if (!box || !largura || !altura) return null;

    const margemX = box.width * 0.1;
    const margemY = box.height * 0.1;
    const esquerda = Math.max(0, largura - box.x - box.width - margemX);
    const direita = Math.min(largura, largura - box.x + margemX);
    const topo = Math.max(0, box.y - margemY);
    const base = Math.min(altura, box.y + box.height + margemY);
    return {
      left: `${100 * esquerda / largura}%`,
      top: `${100 * topo / altura}%`,
      width: `${100 * (direita - esquerda) / largura}%`,
      height: `${100 * (base - topo) / altura}%`,
    };
  });

  protected readonly pontos = computed(() => {
    const largura = this.webcam.larguraFrameProcessado();
    const altura = this.webcam.alturaFrameProcessado();
    if (!largura || !altura) return [];
    return this.webcam.pontosFaciais().map(({ x, y }) => ({
      left: `${100 * (1 - x / largura)}%`,
      top: `${100 * y / altura}%`,
    }));
  });

  protected preenchimento(inicio: number, fim: number): number {
    return Math.min(1, Math.max(0, (this.webcam.progressoAutoCaptura() - inicio) / (fim - inicio)));
  }
}
