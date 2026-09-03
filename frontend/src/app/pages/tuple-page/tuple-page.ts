import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuplePageConfig } from '../../models/tuple-page.model';

@Component({
  selector: 'app-tuple-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './tuple-page.html',
  styleUrl: './tuple-page.scss',
})
export class TuplePage {
  private route = inject(ActivatedRoute);

  configInput = input<TuplePageConfig | undefined>(undefined, { alias: 'config' });

  get config(): TuplePageConfig | undefined {
    return this.configInput() || (this.route.snapshot.data['config'] as TuplePageConfig);
  }

  isBadgeStatus(val: any): boolean {
    if (typeof val !== 'string') return false;
    const lower = val.toLowerCase();
    return ['sucesso', 'negado', 'alerta', 'ativo', 'inativo', 'pendente', 'sim', 'não'].includes(lower);
  }

  getStatusClass(val: string): string {
    switch (val.toLowerCase()) {
      case 'sucesso':
      case 'ativo':
      case 'sim':
        return 'badge-success';
      case 'negado':
      case 'inativo':
      case 'não':
        return 'badge-danger';
      case 'alerta':
      case 'pendente':
        return 'badge-warning';
      default:
        return 'badge-neutral';
    }
  }
}
