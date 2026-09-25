import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';

import {
  ApiService,
  DispositivoResponse,
  UsuarioResponse,
} from '../../services/api.service';
import { WebcamService } from '../../services/webcam.service';
import { WebSocketLogsService } from '../../services/websocket-logs.service';

export interface UserEditDialogData {
  usuario: UsuarioResponse;
}

export interface UserEditDialogResult {
  atualizado: boolean;
}

@Component({
  selector: 'app-user-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './user-edit-dialog.html',
  styleUrl: './user-edit-dialog.scss',
})
export class UserEditDialog implements OnInit, OnDestroy {
  @ViewChild('editVideo') videoElement?: ElementRef<HTMLVideoElement>;

  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(
    MatDialogRef<UserEditDialog, UserEditDialogResult>,
  );
  private data = inject<UserEditDialogData>(MAT_DIALOG_DATA);
  private wsLogs = inject(WebSocketLogsService);
  public webcam = inject(WebcamService);

  usuario: UsuarioResponse = { ...this.data.usuario };
  nome = this.usuario.nome;
  ativo = this.usuario.ativo;

  salvandoDados = false;
  salvandoCartao = false;
  salvandoBiometria = false;

  dispositivos: DispositivoResponse[] = [];
  dispositivoSelecionadoId: number | null = null;
  carregandoDispositivos = true;
  aguardandoRfid = false;
  uidNovo = this.usuario.uid_card ?? '';

  fotoCapturada: Blob | File | null = null;
  fotoPreviewUrl: string | null = null;

  aviso = '';
  erro = '';
  alterado = false;

  private wsSubscription: Subscription | null = null;

  get dispositivoSelecionado(): DispositivoResponse | null {
    if (this.dispositivoSelecionadoId === null) return null;
    return (
      this.dispositivos.find(
        (item) => item.dispositivo_id === this.dispositivoSelecionadoId,
      ) ?? null
    );
  }

  get identificadorDispositivo(): string {
    return this.dispositivoSelecionado?.identificador ?? '';
  }

  get temBiometria(): boolean {
    return Array.isArray(this.usuario.vetor_facial)
      && this.usuario.vetor_facial.length > 0;
  }

  ngOnInit(): void {
    this.api.getDispositivos({ ativo: true }).subscribe({
      next: (dispositivos) => {
        this.dispositivos = dispositivos;
        this.carregandoDispositivos = false;
        if (dispositivos.length) {
          this.dispositivoSelecionadoId = dispositivos[0].dispositivo_id;
        }
      },
      error: () => {
        this.carregandoDispositivos = false;
        this.erro = 'Não foi possível carregar os dispositivos RFID.';
      },
    });

    this.wsSubscription = this.wsLogs.obterLogsEmTempoReal().subscribe({
      next: (evento) => {
        if (
          evento.type !== 'RFID_LIDO'
          || !this.aguardandoRfid
          || !evento.data.uid_card
          || evento.data.identificador_dispositivo !== this.identificadorDispositivo
        ) {
          return;
        }

        this.uidNovo = this.normalizarUid(evento.data.uid_card);
        this.aguardandoRfid = false;
        this.aviso = `Cartão lido: ${this.uidNovo}`;
        this.erro = '';
      },
    });
  }

  ngOnDestroy(): void {
    this.webcam.pararWebcam();
    this.wsSubscription?.unsubscribe();
  }

  salvarDadosBasicos(): void {
    const nome = this.nome.trim();
    if (nome.length < 2) {
      this.erro = 'Informe um nome com pelo menos 2 caracteres.';
      return;
    }

    this.salvandoDados = true;
    this.erro = '';
    this.aviso = '';

    this.api
      .atualizarUsuario(this.usuario.user_id, {
        nome,
        ativo: this.ativo,
      })
      .subscribe({
        next: (usuario) => {
          this.usuario = usuario;
          this.nome = usuario.nome;
          this.ativo = usuario.ativo;
          this.salvandoDados = false;
          this.alterado = true;
          this.aviso = 'Dados do usuário atualizados.';
          this.snackBar.open(this.aviso, 'OK', { duration: 3000 });
        },
        error: (error) => {
          this.salvandoDados = false;
          this.erro =
            error.error?.detail || 'Não foi possível atualizar o usuário.';
        },
      });
  }

  iniciarLeituraRfid(): void {
    if (!this.identificadorDispositivo) {
      this.erro = 'Selecione um dispositivo RFID ativo.';
      return;
    }

    this.erro = '';
    this.aviso = 'Aguardando aproximação do cartão no leitor selecionado...';
    this.aguardandoRfid = true;
  }

  cancelarLeituraRfid(): void {
    this.aguardandoRfid = false;
    this.aviso = '';
  }

  salvarNovoCartao(): void {
    const uid = this.normalizarUid(this.uidNovo);
    if (!this.identificadorDispositivo) {
      this.erro = 'Selecione o dispositivo que realizou a leitura.';
      return;
    }

    if (![8, 14, 20].includes(uid.length) || !/^[0-9A-F]+$/.test(uid)) {
      this.erro = 'UID inválido. Use hexadecimal com 8, 14 ou 20 caracteres.';
      return;
    }

    this.salvandoCartao = true;
    this.erro = '';
    this.aviso = '';

    this.api
      .cadastrarCartao(
        this.identificadorDispositivo,
        uid,
        this.usuario.user_id,
      )
      .subscribe({
        next: (resultado) => {
          this.salvandoCartao = false;
          this.alterado = true;
          this.uidNovo = resultado.uid_card ?? uid;
          this.usuario = { ...this.usuario, uid_card: this.uidNovo };
          this.aviso = resultado.mensagem || 'Cartão atualizado com sucesso.';
          this.snackBar.open('Cartão RFID atualizado.', 'OK', {
            duration: 3500,
          });
        },
        error: (error) => {
          this.salvandoCartao = false;
          this.erro =
            error.error?.detail || 'Não foi possível cadastrar o novo cartão.';
        },
      });
  }

  async iniciarWebcam(): Promise<void> {
    this.fotoCapturada = null;
    this.fotoPreviewUrl = null;
    this.erro = '';
    await this.webcam.iniciarWebcam(() => this.videoElement);
  }

  pararWebcam(): void {
    this.webcam.pararWebcam();
  }

  async capturarFoto(): Promise<void> {
    if (!this.webcam.capturaPronta()) return;
    const captura = await this.webcam.capturarFrameComPreview();
    if (!captura) {
      this.erro = 'Não foi possível capturar a imagem da webcam.';
      return;
    }

    this.fotoCapturada = captura.blob;
    this.fotoPreviewUrl = captura.previewUrl;
    this.pararWebcam();
    this.aviso = 'Captura pronta para cadastrar a biometria.';
  }

  selecionarImagem(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !file.type.startsWith('image/')) {
      this.erro = 'Selecione um arquivo de imagem válido.';
      return;
    }

    this.pararWebcam();
    this.fotoCapturada = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.fotoPreviewUrl = String(reader.result ?? '');
    };
    reader.readAsDataURL(file);
    this.erro = '';
    this.aviso = 'Imagem selecionada. Confirme o cadastro da biometria.';
  }

  salvarBiometria(): void {
    if (!this.fotoCapturada) {
      this.erro = 'Capture ou selecione uma imagem antes de cadastrar.';
      return;
    }

    this.salvandoBiometria = true;
    this.erro = '';
    this.aviso = '';

    this.api
      .cadastrarBiometria(this.usuario.user_id, this.fotoCapturada)
      .subscribe({
        next: (resultado) => {
          this.salvandoBiometria = false;
          this.alterado = true;
          this.usuario = {
            ...this.usuario,
            vetor_facial: Array.from(
              { length: resultado.vector_length },
              () => 0,
            ),
          };
          this.fotoCapturada = null;
          this.fotoPreviewUrl = null;
          this.aviso =
            `Biometria cadastrada com sucesso (${resultado.vector_length} dimensões).`;
          this.snackBar.open('Biometria facial atualizada.', 'OK', {
            duration: 3500,
          });
        },
        error: (error) => {
          this.salvandoBiometria = false;
          this.erro =
            error.error?.detail || 'Não foi possível cadastrar a biometria.';
        },
      });
  }

  fechar(): void {
    this.dialogRef.close({ atualizado: this.alterado });
  }

  private normalizarUid(uid: string): string {
    return uid.replace(/[\s:-]/g, '').toUpperCase();
  }
}
