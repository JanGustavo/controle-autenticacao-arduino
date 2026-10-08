import { ConfirmationService } from '../../components/confirmation-dialog/confirmation-dialog';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  OnInit,
  OnDestroy,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  ApiService,
  AdministradorResponse,
  AdministradorCreateRequest,
  AdministradorUpdateRequest,
} from '../../services/api.service';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-administradores-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    RouterLink,
    MatDialogModule,
  ],
  templateUrl: './administradores.html',
  styleUrl: './administradores.scss',
})
export class AdministradoresPage implements OnInit, OnDestroy {
  @ViewChild('adminForm') adminForm!: TemplateRef<unknown>;
  private dialog = inject(MatDialog);
  private dialogRef?: MatDialogRef<unknown>;
  private confirmation = inject(ConfirmationService);
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  administradores: AdministradorResponse[] = [];
  carregando = false;
  erroLista = '';
  salvando = false;
  editandoId: number | null = null;
  editandoPrincipal = false;
  erro = '';

  // Form para criação/edição
  form = {
    nome: '',
    email: '',
    senha: '',
    ativo: true,
    foto_url: '',
  };

  // Imagens com erro de carregamento
  imgErros = new Set<number>();
  formImgFailed = false;

  onAdminImgError(adminId: number): void {
    this.imgErros.add(adminId);
  }

  hasAdminImgError(adminId: number): boolean {
    return this.imgErros.has(adminId);
  }

  onFormImgError(): void {
    this.formImgFailed = true;
  }

  onFotoUrlChange(): void {
    this.formImgFailed = false;
  }

  // Filtros de busca
  filtroTexto = '';
  filtroAtivo = 'todos'; // 'todos' | 'ativo' | 'inativo'

  get displayedAdmins(): AdministradorResponse[] {
    return this.administradores.filter((admin) => {
      const matchTexto =
        !this.filtroTexto ||
        (admin.nome && admin.nome.toLowerCase().includes(this.filtroTexto.trim().toLowerCase())) ||
        (admin.email && admin.email.toLowerCase().includes(this.filtroTexto.trim().toLowerCase()));

      const isAtivo = Boolean(admin.ativo);
      const matchAtivo =
        this.filtroAtivo === 'todos' ||
        (this.filtroAtivo === 'ativo' && isAtivo) ||
        (this.filtroAtivo === 'inativo' && !isAtivo);

      return matchTexto && matchAtivo;
    });
  }

  ngOnInit(): void {
    this.carregar();
  }

  private sincronizarSessaoSeUsuarioAtual(admin: AdministradorResponse): void {
    const sessaoAtual = this.authService.userSession();

    if (!sessaoAtual) {
      if (admin.principal) {
        this.authService.updateUserSession({
          admin_id: admin.admin_id,
          name: admin.nome,
          email: admin.email,
          foto_url: admin.foto_url,
        });
      }
      return;
    }

    const eMesmoId =
      sessaoAtual.admin_id !== undefined && Number(sessaoAtual.admin_id) === Number(admin.admin_id);
    const eMesmoEmail =
      Boolean(sessaoAtual.email) && sessaoAtual.email.toLowerCase() === admin.email.toLowerCase();
    const ePrincipal =
      Boolean(admin.principal) &&
      (sessaoAtual.email === 'admin@ardlock.local' ||
        sessaoAtual.name === 'Administrador' ||
        sessaoAtual.admin_id === 1);

    if (eMesmoId || eMesmoEmail || ePrincipal) {
      this.authService.updateUserSession({
        admin_id: admin.admin_id,
        name: admin.nome,
        email: admin.email,
        foto_url: admin.foto_url,
      });
    }
  }

  carregar(): void {
    this.carregando = true;
    this.erroLista = '';

    this.api
      .getAdministradores()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.carregando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (admins) => {
          this.administradores = admins;

          for (const admin of admins) {
            this.sincronizarSessaoSeUsuarioAtual(admin);
          }
        },
        error: () => {
          this.administradores = [];
          this.erroLista = 'Não foi possível carregar a lista de administradores.';
        },
      });
  }

  novo(): void {
    this.limparFormulario();
    this.abrirFormulario();
  }

  private abrirFormulario(): void {
    this.dialogRef = this.dialog.open(this.adminForm, {
      width: '560px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      ariaLabelledBy: 'admin-dialog-title',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
    this.dialogRef.afterClosed().subscribe(() => {
      this.dialogRef = undefined;
      this.limparFormulario();
    });
  }

  ngOnDestroy(): void {
    this.dialogRef?.close();
  }

  salvar(): void {
    if (this.salvando) return;
    this.erro = '';
    const nomeLimpo = this.form.nome.trim();
    const emailLimpo = this.form.email.trim();

    if (nomeLimpo.length < 2 || emailLimpo.length < 5) {
      this.erro = 'Informe o nome (mín. 2 caracteres) e um e-mail válido.';
      return;
    }

    if (this.form.senha && this.form.senha.length < 6) {
      this.erro = 'A senha deve ter no mínimo 6 caracteres.';
      return;
    }

    if (this.editandoId === null) {
      // Criação
      if (!this.form.senha || this.form.senha.length < 6) {
        this.erro = 'A senha para o novo administrador deve ter no mínimo 6 caracteres.';
        this.definirSalvando(false);
        return;
      }

      const payloadCreate: AdministradorCreateRequest = {
        nome: nomeLimpo,
        email: emailLimpo,
        senha: this.form.senha,
        ativo: this.form.ativo,
        foto_url: this.form.foto_url.trim() || null,
      };

      this.definirSalvando(true);
      this.api
        .criarAdministrador(payloadCreate)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (admin) => {
            this.definirSalvando(false);
            this.administradores = [...this.administradores, admin].sort(
              (a, b) => a.admin_id - b.admin_id,
            );
            this.snackBar.open('Administrador criado com sucesso.', 'Fechar', { duration: 4000 });
            this.cancelar();
          },
          error: (err) => {
            this.definirSalvando(false);
            this.erro =
              err.status === 409
                ? 'Este e-mail já está cadastrado para outro administrador.'
                : err.error?.detail || 'Não foi possível criar o administrador.';
          },
        });
    } else {
      // Edição
      const payloadUpdate: AdministradorUpdateRequest = {
        nome: nomeLimpo,
        email: emailLimpo,
        ativo: this.form.ativo,
        foto_url: this.form.foto_url.trim() || null,
      };

      if (this.form.senha && this.form.senha.length >= 6) {
        payloadUpdate.senha = this.form.senha;
      }

      this.definirSalvando(true);
      this.api
        .atualizarAdministrador(this.editandoId, payloadUpdate)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (admin) => {
            this.definirSalvando(false);
            this.administradores = this.administradores.map((item) =>
              item.admin_id === admin.admin_id ? admin : item,
            );
            this.sincronizarSessaoSeUsuarioAtual(admin);
            this.snackBar.open('Administrador atualizado com sucesso.', 'Fechar', {
              duration: 4000,
            });
            this.cancelar();
          },
          error: (err) => {
            this.definirSalvando(false);
            this.erro =
              err.status === 409
                ? 'Este e-mail já está cadastrado para outro administrador.'
                : err.error?.detail || 'Não foi possível atualizar o administrador.';
          },
        });
    }
  }

  editar(admin: AdministradorResponse): void {
    this.editandoId = admin.admin_id;
    this.editandoPrincipal = admin.principal;
    this.formImgFailed = false;
    this.form = {
      nome: admin.nome,
      email: admin.email,
      senha: '', // Não exibe a senha armazenada
      ativo: admin.ativo,
      foto_url: admin.foto_url || '',
    };
    this.erro = '';
    this.abrirFormulario();
  }

  async excluir(admin: AdministradorResponse): Promise<void> {
    if (admin.principal) {
      this.snackBar.open('A conta principal do ArdLock não pode ser excluída.', 'Entendi', {
        duration: 4000,
      });
      return;
    }

    if (
      !(await this.confirmation.excluir(
        'Excluir administrador?',
        `A conta de "${admin.nome}" (${admin.email}) será removida.`,
      ))
    )
      return;

    this.api
      .deletarAdministrador(admin.admin_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.administradores = this.administradores.filter(
            (item) => item.admin_id !== admin.admin_id,
          );
          this.cdr.markForCheck();
          this.snackBar.open('Administrador excluído com sucesso.', 'Fechar', { duration: 4000 });
        },
        error: (err) => {
          this.snackBar.open(
            err.error?.detail || 'Não foi possível excluir o administrador.',
            'Fechar',
            { duration: 4000 },
          );
        },
      });
  }

  private definirSalvando(salvando: boolean): void {
    this.salvando = salvando;
    this.cdr.markForCheck();
    if (this.dialogRef) this.dialogRef.disableClose = salvando;
  }

  cancelar(): void {
    if (this.salvando) return;
    this.dialogRef?.close();
  }

  private limparFormulario(): void {
    this.editandoId = null;
    this.editandoPrincipal = false;
    this.formImgFailed = false;
    this.form = {
      nome: '',
      email: '',
      senha: '',
      ativo: true,
      foto_url: '',
    };
    this.erro = '';
  }
}
