import { Component, inject, Injectable } from '@angular/core';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

interface ConfirmationData {
  title: string;
  message: string;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title><mat-icon aria-hidden="true">warning_amber</mat-icon>{{ data.title }}</h2>
    <mat-dialog-content
      ><p id="confirmation-message">{{ data.message }}</p>
      <p class="confirmation-hint">Esta ação não pode ser desfeita.</p></mat-dialog-content
    >
    <mat-dialog-actions align="end">
      <button mat-stroked-button [mat-dialog-close]="false">Cancelar</button>
      <button mat-flat-button class="confirm-delete" [mat-dialog-close]="true">Excluir</button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
      color: var(--ard-ink);
      background: var(--ard-surface);
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--ard-ink);
    }
    h2 mat-icon {
      color: var(--ard-danger);
      flex-shrink: 0;
    }
    p {
      line-height: 1.6;
      overflow-wrap: anywhere;
      color: var(--ard-ink);
    }
    .confirmation-hint {
      color: var(--ard-muted);
      font-size: 0.85rem;
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
  async excluir(title: string, message: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmationDialog, {
      data: { title, message },
      width: '440px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      role: 'alertdialog',
      ariaDescribedBy: 'confirmation-message',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
