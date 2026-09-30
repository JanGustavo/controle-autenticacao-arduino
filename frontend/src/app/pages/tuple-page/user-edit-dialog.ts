import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  signal,
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
  DispositivoSimplesResponse,
  TipoUsuario,
  UsuarioResponse,
} from '../../services/api.service';
import { SpeechService } from '../../services/speech.service';
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
  @ViewChild('webcamContainer') webcamContainer?: ElementRef<HTMLDivElement>;

  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);
  private speech = inject(SpeechService);
  private dialogRef = inject(
    MatDialogRef<UserEditDialog, UserEditDialogResult>,
  );
  private data = inject<UserEditDialogData>(MAT_DIALOG_DATA);
  private wsLogs = inject(WebSocketLogsService);
  public webcam = inject(WebcamService);

  modoTotem = signal(true);
  usuario: UsuarioResponse = { ...this.data.usuario };
  nome = this.usuario.nome;
  cpf = this.formatarCpf(this.usuario.cpf);
  tipoUsuario: TipoUsuario = this.usuario.tipo_usuario;
  ativo = this.usuario.ativo;

  salvandoDados = false;
  salvandoCartao = false;
  verificandoCartao = false;
  salvandoBiometria = false;

  dispositivos: DispositivoSimplesResponse[] = [];
  dispositivoSelecionadoId: number | null = null;
  carregandoDispositivos = true;
  aguardandoRfid = false;
  uidNovo = this.usuario.uid_card ?? '';
  cartaoDisponivel: boolean | null = this.usuario.uid_card ? true : null;

  fotoCapturada: Blob | File | null = null;
  fotoPreviewUrl: string | null = null;

  aviso = '';
  erro = '';
  alterado = false;

  private wsSubscription: Subscription | null = null;

  get dispositivoSelecionado(): DispositivoSimplesResponse | null {
    if (this.dispositivoSelecionadoId === null || this.dispositivoSelecionadoId === undefined) return null;
    return (
      this.dispositivos.find(
        (item) => Number(item.dispositivo_id) === Number(this.dispositivoSelecionadoId),
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
    this.api.getDispositivosSimples({ ativo: true }).subscribe({
      next: (dispositivos) => {
        this.dispositivos = dispositivos;
        this.carregandoDispositivos = false;
        if (dispositivos.length) {
          this.dispositivoSelecionadoId = dispositivos[0].dispositivo_id;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.carregandoDispositivos = false;
        this.erro = 'Não foi possível carregar os dispositivos RFID.';
        this.cdr.markForCheck();
      },
    });

    this.wsSubscription = this.wsLogs.obterLogsEmTempoReal().subscribe({
      next: (evento) => {
        if (
          evento.type !== 'RFID_LIDO'
          || !this.aguardandoRfid
          || !evento.data.uid_card
        ) {
          return;
        }

        const eventoDisp = (evento.data.identificador_dispositivo || '').trim().toUpperCase();
        const leitorAtual = (this.identificadorDispositivo || '').trim().toUpperCase();

        if (eventoDisp && leitorAtual && eventoDisp !== leitorAtual) {
          return;
        }

        this.uidNovo = this.normalizarUid(evento.data.uid_card);
        this.aguardandoRfid = false;
        this.cdr.detectChanges();
        this.validarUidAtual();
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

    this.erro = '';
    this.aviso = '';

    const cpf = this.normalizarCpf(this.cpf);
    if (cpf !== null && cpf.length !== 11) {
      this.erro = 'CPF deve conter 11 dígitos.';
      return;
    }

    this.salvandoDados = true;

    this.api
      .atualizarUsuario(this.usuario.user_id, {
        nome,
        cpf,
        tipo_usuario: this.tipoUsuario,
        ativo: this.ativo,
      })
      .subscribe({
        next: (usuario) => {
          this.usuario = usuario;
          this.nome = usuario.nome;
          this.cpf = this.formatarCpf(usuario.cpf);
          this.tipoUsuario = usuario.tipo_usuario;
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
    this.cartaoDisponivel = null;
    this.aguardandoRfid = true;
  }

  cancelarLeituraRfid(): void {
    this.aguardandoRfid = false;
    this.aviso = '';
  }

  validarUidAtual(): void {
    const uid = this.normalizarUid(this.uidNovo);

    if (![8, 14, 20].includes(uid.length) || !/^[0-9A-F]+$/.test(uid)) {
      this.cartaoDisponivel = null;
      this.erro = uid
        ? 'UID inválido. Use hexadecimal com 8, 14 ou 20 caracteres.'
        : '';
      return;
    }

    this.verificandoCartao = true;
    this.erro = '';
    this.aviso = 'Verificando se o cartão já possui vínculo...';

    this.api.consultarCartao(uid, this.usuario.user_id).subscribe({
      next: (resultado) => {
        this.verificandoCartao = false;
        this.uidNovo = resultado.uid_card;
        this.cartaoDisponivel = resultado.disponivel_para_usuario;

        if (resultado.disponivel_para_usuario) {
          this.erro = '';
          this.aviso = resultado.mensagem;
          this.cdr.detectChanges();
          return;
        }

        this.aviso = '';
        this.erro = resultado.mensagem;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.verificandoCartao = false;
        this.cartaoDisponivel = null;
        this.aviso = '';
        this.erro =
          error.error?.detail || 'Não foi possível verificar o cartão.';
        this.cdr.detectChanges();
      },
    });
  }

  onUidManualChange(): void {
    this.cartaoDisponivel = null;
    this.aviso = '';
    this.erro = '';
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

    if (this.cartaoDisponivel === false) {
      this.erro = 'Este cartão já pertence a outro usuário.';
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
          this.cartaoDisponivel = true;
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

  toggleModoTotem(): void {
    this.modoTotem.set(!this.modoTotem());
    this.speech.falar(
      this.modoTotem()
        ? 'Modo totem ativado. Auto-captura habilitada.'
        : 'Modo assistido ativado. Captura manual.',
      true
    );
    if (this.webcam.webcamAtiva()) {
      void this.iniciarWebcam();
    }
  }

  obterEstiloOvalDinamico(): { [key: string]: string } {
    const box = this.webcam.faceBox();
    const video = this.videoElement?.nativeElement;
    const container = this.webcamContainer?.nativeElement;

    const larguraFrame = this.webcam.larguraFrameProcessado() || video?.videoWidth || 0;
    const alturaFrame = this.webcam.alturaFrameProcessado() || video?.videoHeight || 0;

    if (!box || !video || !container || !larguraFrame || !alturaFrame) {
      return {};
    }

    const scaleX = container.clientWidth / larguraFrame;
    const scaleY = container.clientHeight / alturaFrame;
    const scaleFactor = 0.85;
    const size = Math.max(box.width * scaleX, box.height * scaleY) * scaleFactor;

    // A prévia é espelhada para navegação natural. A bounding box vem
    // do frame não espelhado, então refletimos o eixo X para coincidir.
    const boxXEspelhado = larguraFrame - box.x - box.width;
    const left = (boxXEspelhado + box.width / 2) * scaleX - size / 2;
    const top = (box.y + box.height / 2) * scaleY - size / 2 - 10;

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${size}px`,
      height: `${size}px`,
      transform: 'none',
    };
  }

  async iniciarWebcam(): Promise<void> {
    this.fotoCapturada = null;
    this.fotoPreviewUrl = null;
    this.erro = '';
    if (this.modoTotem()) {
      this.speech.falar('Centralize o rosto na moldura para atualizar a biometria.');
    }
    await this.webcam.iniciarWebcam(
      () => this.videoElement,
      this.modoTotem(),
      () => void this.capturarFoto()
    );
  }

  pararWebcam(): void {
    this.webcam.pararWebcam();
  }

  async capturarFoto(): Promise<void> {
    if (!this.webcam.capturaPronta() && !this.modoTotem()) return;
    const captura = await this.webcam.capturarFrameComPreview();
    if (!captura) {
      this.erro = 'Não foi possível capturar a imagem da webcam.';
      return;
    }

    this.fotoCapturada = captura.blob;
    this.fotoPreviewUrl = captura.previewUrl;
    this.pararWebcam();
    this.aviso = 'Captura pronta para cadastrar a biometria.';
    this.speech.falar('Foto capturada com sucesso.');
    this.cdr.detectChanges();
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
          this.fotoCapturada = null;
          this.fotoPreviewUrl = null;
          this.aviso =
            `Biometria cadastrada com sucesso (${resultado.vector_length} dimensões).`;
          this.snackBar.open('Biometria facial atualizada.', 'OK', {
            duration: 3500,
          });

          // Recarrega o usuário real para atualizar o estado do modal sem
          // fabricar um vetor placeholder no frontend.
          this.api.getUsuario(this.usuario.user_id).subscribe({
            next: (usuario) => {
              this.usuario = usuario;
            },
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

  private normalizarCpf(cpf: string): string | null {
    const digitos = cpf.replace(/\D/g, '');
    return digitos || null;
  }

  private formatarCpf(cpf: string | null): string {
    if (!cpf) return '';
    const digitos = cpf.replace(/\D/g, '');
    if (digitos.length !== 11) return cpf;
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  private normalizarUid(uid: string): string {
    return uid.replace(/[\s:-]/g, '').toUpperCase();
  }
}
