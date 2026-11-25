import { Component, inject, Injectable } from '@angular/core';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
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
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-heading">
      <span class="warning-mark" aria-hidden="true"><mat-icon>delete_outline</mat-icon></span>
      <div>
        <span class="eyebrow">Ação permanente</span>
        <h2 mat-dialog-title>{{ data.title }}</h2>
      </div>
    </div>
    <mat-dialog-content>
      <p id="confirmation-message" class="confirmation-message">{{ data.message }}</p>
      @if (data.items?.length) {
        <section class="impact" aria-labelledby="impact-title">
          <h3 id="impact-title">O que será afetado</h3>
          <ul>
            @for (item of data.items; track item.label) {
              <li>
                <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
                <span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
              </li>
            }
          </ul>
        </section>
      }
      <p class="confirmation-hint">
        <mat-icon aria-hidden="true">info</mat-icon>
        Esta ação não pode ser desfeita.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button [mat-dialog-close]="false">Cancelar</button>
      <button mat-flat-button class="confirm-delete" [mat-dialog-close]="true">
        <mat-icon aria-hidden="true">delete</mat-icon>{{ data.confirmLabel || 'Excluir' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
      color: var(--ard-ink);
      background: var(--ard-surface);
    }
    .dialog-heading {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 24px 24px 8px;
    }
    .warning-mark {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      flex: 0 0 42px;
      border-radius: 50%;
      color: var(--ard-danger);
      background: color-mix(in srgb, var(--ard-danger) 12%, transparent);
    }
    .warning-mark mat-icon {
      font-size: 23px;
    }
    .eyebrow {
      display: block;
      margin-bottom: 3px;
      color: var(--ard-danger);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    h2 {
      margin: 0;
      padding: 0;
      color: var(--ard-ink);
      font-size: 1.22rem;
      line-height: 1.25;
    }
    mat-dialog-content {
      padding: 8px 24px 0;
    }
    p {
      margin: 0;
      line-height: 1.6;
      overflow-wrap: anywhere;
      color: var(--ard-ink);
    }
    .confirmation-message {
      font-size: 0.94rem;
    }
    .impact {
      margin-top: 18px;
      border: 1px solid color-mix(in srgb, var(--ard-danger) 18%, var(--ard-line));
      border-radius: var(--ard-radius-sm);
      background: color-mix(in srgb, var(--ard-danger) 4%, var(--ard-surface));
      padding: 12px;
    }
    .impact h3 {
      margin: 0 0 8px;
      color: var(--ard-ink);
      font-size: 0.76rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    ul {
      display: grid;
      gap: 9px;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    li {
      display: flex;
      align-items: flex-start;
      gap: 9px;
    }
    li > mat-icon {
      width: 18px;
      height: 18px;
      color: var(--ard-danger);
      font-size: 18px;
      flex: 0 0 18px;
    }
    li span {
      display: grid;
      gap: 2px;
    }
    li strong {
      color: var(--ard-ink);
      font-size: 0.84rem;
    }
    li small {
      color: var(--ard-muted);
      font-size: 0.76rem;
      line-height: 1.35;
    }
    .confirmation-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 16px;
      color: var(--ard-muted);
      font-size: 0.85rem;
    }
    .confirmation-hint mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    mat-dialog-actions {
      gap: 12px;
      padding: 16px 24px 24px;
    }
    :host-context(body.dark-mode) h2 mat-icon {
      color: #f87171;
    }
    .confirm-delete {
      background-color: var(--ard-danger);
      color: #fff;
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
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      role: 'alertdialog',
      ariaDescribedBy: 'confirmation-message',
      panelClass: 'ard-confirmation-dialog',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
