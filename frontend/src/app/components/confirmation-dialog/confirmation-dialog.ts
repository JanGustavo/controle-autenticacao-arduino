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
    <div class="ard-dialog confirm-delete-dialog">
      <header class="ard-dialog-head confirm-head">
        <span class="alerta" aria-hidden="true"><mat-icon>delete_forever</mat-icon></span>
        <div>
          <h2 id="confirmation-title">{{ data.title }}</h2>
          <p id="confirmation-message">{{ data.message }}</p>
        </div>
      </header>

      <div class="ard-dialog-body">
        @if (data.items?.length) {
          <section class="impacto" aria-labelledby="impact-title">
            <h3 id="impact-title">
              <mat-icon aria-hidden="true">warning_amber</mat-icon>
              O que será afetado
            </h3>
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
          <mat-icon aria-hidden="true">block</mat-icon>
          Esta ação é <strong>permanente</strong> e não pode ser desfeita.
        </p>
      </div>

      <footer class="ard-dialog-foot confirm-foot">
        <button type="button" class="ard-btn is-quiet" [mat-dialog-close]="false">Cancelar</button>
        <button type="button" class="ard-btn is-destructive" [mat-dialog-close]="true">
          <mat-icon aria-hidden="true">delete_forever</mat-icon>
          {{ data.confirmLabel || 'Excluir definitivamente' }}
        </button>
      </footer>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .confirm-delete-dialog {
      border-top: 3px solid var(--ard-danger);
      border-radius: 0 0 var(--ard-radius) var(--ard-radius);
    }

    .confirm-head {
      gap: 16px;
      padding: 24px 24px 10px;
      border-bottom: 0;
      background: color-mix(in srgb, var(--ard-danger) 5%, var(--ard-surface));

      h2 {
        font-size: 1.1rem;
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      p {
        margin-top: 4px;
        color: var(--ard-ink);
        font-size: 0.93rem;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }
    }

    .alerta {
      display: grid;
      flex: 0 0 44px;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--ard-danger) 18%, transparent);
      color: var(--ard-danger);
      box-shadow: 0 0 0 6px color-mix(in srgb, var(--ard-danger) 8%, transparent);

      mat-icon {
        width: 24px;
        height: 24px;
        font-size: 24px;
      }
    }

    .ard-dialog-body {
      gap: 14px;
      padding: 14px 24px 22px 84px;
    }

    .impacto {
      padding: 14px 16px;
      border: 1px solid color-mix(in srgb, var(--ard-danger) 25%, var(--ard-line));
      border-radius: var(--ard-radius-sm);
      background: color-mix(in srgb, var(--ard-danger) 4%, var(--ard-surface-2));

      h3 {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0 0 12px;
        color: color-mix(in srgb, var(--ard-danger) 80%, var(--ard-muted));
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;

        mat-icon {
          width: 15px;
          height: 15px;
          font-size: 15px;
        }
      }
      ul {
        display: grid;
        gap: 12px;
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
        gap: 2px;
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
      gap: 7px;
      margin: 0;
      padding: 10px 14px;
      border-radius: var(--ard-radius-sm);
      background: color-mix(in srgb, var(--ard-danger) 7%, transparent);
      color: color-mix(in srgb, var(--ard-danger) 85%, var(--ard-ink));
      font-size: 0.86rem;

      mat-icon {
        flex: 0 0 17px;
        width: 17px;
        height: 17px;
        font-size: 17px;
      }

      strong {
        font-weight: 600;
      }
    }

    .confirm-foot {
      padding: 14px 24px 18px;
      border-top: 1px solid var(--ard-line);
      gap: 10px;

      .ard-btn.is-destructive {
        min-width: 180px;
      }
    }

    @media (max-width: 480px) {
      .ard-dialog-body {
        padding-left: 24px;
      }
      .confirm-foot {
        flex-direction: column-reverse;
        .ard-btn {
          width: 100%;
          justify-content: center;
        }
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
