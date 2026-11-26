import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Uma etapa da trilha lateral: o mesmo nó da trilha de verificação do produto. */
export interface EtapaAuth {
  titulo: string;
  texto: string;
  icone: string;
  estado: 'active' | 'done' | 'fail' | 'ok' | null;
}

/**
 * Moldura comum às telas de entrada (login, recuperar e redefinir senha):
 * a trilha do ArdLock de um lado, o formulário (projetado) do outro.
 */
@Component({
  selector: 'app-auth-frame',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-frame.html',
  styleUrl: './auth-frame.scss',
})
export class AuthFrame {
  readonly titulo = input.required<string>();
  readonly texto = input('');
  readonly etapas = input.required<EtapaAuth[]>();
  readonly rotuloTrilha = input('Etapas');
}
