import { Component, inject, Injectable } from '@angular/core';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

export interface ConfirmationItem {
  icon: string;
  label: string;
  description: string;
}

export interface ConfirmationData {
  title: string;
  message: string;
  items?: ConfirmationItem[];
  confirmLabel?: string;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatIconModule],
  template: `
    <div class="ard-dialog">
      <header class="ard-dialog-head">
        <span class="alerta" aria-hidden="true"><mat-icon>delete</mat-icon></span>
        <div>
          <h2 id="confirmation-title">{{ data.title }}</h2>
          <p id="confirmation-message">{{ data.message }}</p>
        </div>
      </header>

      <div class="ard-dialog-body">
        @if (data.items?.length) {
          <section class="impacto" aria-labelledby="impact-title">
            <h3 id="impact-title">O que será afetado</h3>
            <ul>
              @for (item of data.items; track item.label) {
                <li>
                  <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
                  <span>
                    <strong>{{ item.label }}</strong>
                    <small>{{ item.description }}</small>
                  </span>
                </li>
              }
            </ul>
          </section>
        }
        <p class="definitivo">
          <mat-icon aria-hidden="true">info</mat-icon>
          Esta ação não pode ser desfeita.
        </p>
      </div>

      <footer class="ard-dialog-foot">
        <button type="button" class="ard-btn" [mat-dialog-close]="false">Cancelar</button>
        <button type="button" class="ard-btn is-destructive" [mat-dialog-close]="true">
          <mat-icon aria-hidden="true">delete</mat-icon>
          {{ data.confirmLabel || 'Excluir' }}
        </button>
      </footer>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    // Diálogo curto: cabeçalho sem divisória, texto lido de uma vez.
    .ard-dialog-head {
      gap: 14px;
      padding: 22px 22px 6px;
      border-bottom: 0;
      h2 {
        overflow-wrap: anywhere;
      }
      p {
        margin-top: 4px;
        color: var(--ard-ink);
        font-size: 0.95rem;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }
    }
    .alerta {
      display: grid;
      flex: 0 0 40px;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--ard-danger) 14%, transparent);
      color: var(--ard-danger);
      mat-icon {
        width: 22px;
        height: 22px;
        font-size: 22px;
      }
    }
    .ard-dialog-body {
      gap: 14px;
      padding: 12px 22px 20px 76px;
    }
    .impacto {
      padding: 12px 14px;
      border: 1px solid var(--ard-line);
      border-radius: var(--ard-radius-sm);
      background: var(--ard-surface-2);
      h3 {
        margin: 0 0 10px;
        color: var(--ard-muted);
        font-size: 0.82rem;
        font-weight: 500;
      }
      ul {
        display: grid;
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      li {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      li > mat-icon {
        flex: 0 0 18px;
        width: 18px;
        height: 18px;
        margin-top: 1px;
        color: var(--ard-muted);
        font-size: 18px;
      }
      li span {
        display: grid;
        gap: 1px;
        min-width: 0;
      }
      strong {
        font-size: 0.9rem;
        font-weight: 500;
        overflow-wrap: anywhere;
      }
      small {
        color: var(--ard-muted);
        font-size: 0.82rem;
        line-height: 1.4;
      }
    }
    .definitivo {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      color: var(--ard-muted);
      font-size: 0.86rem;
      mat-icon {
        flex: 0 0 16px;
        width: 16px;
        height: 16px;
        font-size: 16px;
      }
    }
    @media (max-width: 480px) {
      .ard-dialog-body {
        padding-left: 22px;
      }
    }
  `,
})
export class ConfirmationDialog {
  readonly data = inject<ConfirmationData>(MAT_DIALOG_DATA);
}

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private dialog = inject(MatDialog);
  async excluir(
    title: string,
    message: string,
    options: Pick<ConfirmationData, 'items' | 'confirmLabel'> = {},
  ): Promise<boolean> {
    const ref = this.dialog.open(ConfirmationDialog, {
      data: { title, message, ...options },
      width: '480px',
      maxWidth: 'calc(100vw - 32px)',
      // O foco começa em Cancelar: a opção segura numa ação definitiva.
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      role: 'alertdialog',
      ariaLabelledBy: 'confirmation-title',
      ariaDescribedBy: 'confirmation-message',
      panelClass: 'ard-confirmation-dialog',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
