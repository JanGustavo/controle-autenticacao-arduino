import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, LocalResponse, PermissaoCreateRequest } from '../../services/api.service';
import { SpeechService } from '../../services/speech.service';
import { WebcamService } from '../../services/webcam.service';
import { WebSocketLogsService } from '../../services/websocket-logs.service';

export interface LocalPermissaoItem {
  local_id: number;
  nome_local: string;
  identificador: string;
  selecionado: boolean;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
}

@Component({
  selector: 'app-cadastrar-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './cadastrar.html',
  styleUrl: './cadastrar.scss',
})
export class CadastrarPage implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;

  private formBuilder = inject(FormBuilder);
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private speech = inject(SpeechService);
  public webcam = inject(WebcamService);
  public wsLogs = inject(WebSocketLogsService);

  cameraOpened = false;
  scanning = false;
  submitted = false;
  saving = false;
  lendoRfidMock = false;
  aguardandoRfid = false;
  identificadorRfidSelecionado = '';
  successMessage = '';
  errorMessage = '';
  locaisPermissao: LocalPermissaoItem[] = [];
  locaisCarregando = true;
  locaisErro = '';
  fotoPreviewUrl: string | null = null;
  private fotoCapturada: Blob | File | null = null;
  private wsSubscription: Subscription | null = null;

  form = this.formBuilder.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
    uid_card: ['', [Validators.maxLength(100)]],
    ativo: [true],
  });

  async ngOnInit(): Promise<void> {
    this.api.getLocais({ ativo: true }).subscribe({
      next: (locais) => {
        this.locaisPermissao = locais.map((local) => ({
          local_id: local.local_id,
          nome_local: local.nome,
          identificador: local.identificador_dispositivo,
          selecionado: false,
          horario_inicio: '08:00',
          horario_fim: '18:00',
          dias_semana: [2, 3, 4, 5, 6], // Padrão Seg-Sex
        }));
        this.locaisCarregando = false;
      },
      error: () => {
        this.locaisCarregando = false;
        this.locaisErro = 'Não foi possível carregar os locais disponíveis.';
      },
    });

    this.wsSubscription = this.wsLogs.obterLogsEmTempoReal().subscribe({
      next: (evento) => {
        if (
          evento.type !== 'RFID_LIDO' ||
          !this.aguardandoRfid ||
          evento.data.identificador_dispositivo !== this.identificadorRfidSelecionado ||
          !evento.data.uid_card
        ) {
          return;
        }

        this.aplicarLeituraRfid(evento.data.uid_card);
      },
    });

    await this.webcam.carregarModelos();
  }

  ngOnDestroy(): void {
    this.pararWebcam();
    this.wsSubscription?.unsubscribe();
  }

  async iniciarWebcam(): Promise<void> {
    await this.webcam.iniciarWebcam(() => this.videoElement);
  }

  pararWebcam(): void {
    this.webcam.pararWebcam();
    this.scanning = false;
  }

  async capturarFrameWebcam(): Promise<void> {
    if (!this.webcam.capturaPronta()) return;

    const res = await this.webcam.capturarFrameComPreview();
    if (!res) return;

    this.fotoCapturada = res.blob;
    this.fotoPreviewUrl = res.previewUrl;
    this.scanning = true;
    this.errorMessage = '';
    this.pararWebcam();
    this.speech.falar('Foto capturada com sucesso.');
  }

  iniciarLeituraRfid(): void {
    if (this.lendoRfidMock || this.aguardandoRfid) return;

    if (!this.identificadorRfidSelecionado) {
      this.errorMessage = 'Selecione o dispositivo que fará a leitura do cartão.';
      return;
    }

    this.errorMessage = '';
    this.aguardandoRfid = true;
    this.speech.falar('Aproxime o cartão do leitor RFID.');
  }

  cancelarLeituraRfid(): void {
    this.aguardandoRfid = false;
    this.speech.parar();
  }

  private aplicarLeituraRfid(uidCard: string): void {
    const uidNormalizado = this.normalizarUid(uidCard);

    this.form.patchValue({ uid_card: uidNormalizado || '' });
    this.form.get('uid_card')?.markAsDirty();
    this.form.get('uid_card')?.markAsTouched();
    this.aguardandoRfid = false;

    this.snackBar.open(
      `Cartão RFID lido: ${uidNormalizado}`,
      'OK',
      { duration: 3500 }
    );
    this.speech.falar('Cartão identificado.');
  }

  capturarRfidMock(): void {
    if (this.lendoRfidMock || !this.identificadorRfidSelecionado) return;

    this.lendoRfidMock = true;
    this.speech.falar('Simulando leitura do cartão.');

    setTimeout(() => {
      const bytes = Array.from({ length: 4 }, () =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, '0')
          .toUpperCase()
      );

      this.aplicarLeituraRfid(bytes.join(''));
      this.lendoRfidMock = false;
    }, 700);
  }

  submit(): void {
    this.submitted = true;
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.identificadorRfidSelecionado) {
      this.errorMessage = 'Selecione o dispositivo que fará a leitura do cartão.';
      return;
    }

    const locaisSelecionados = this.locaisPermissao.filter((item) => item.selecionado);

    if (!locaisSelecionados.length) {
      this.errorMessage = 'Selecione pelo menos um local e configure seu horário de acesso.';
      return;
    }

    if (!this.fotoCapturada) {
      this.errorMessage = 'Conclua a captura facial antes de criar o usuário.';
      return;
    }

    const { nome, uid_card, ativo } = this.form.getRawValue();
    const uidNormalizado = this.normalizarUid(uid_card);

    if (!uidNormalizado) {
      this.errorMessage = 'Faça a leitura do cartão RFID antes de salvar.';
      return;
    }

    this.saving = true;

    const permissoesPayload: PermissaoCreateRequest[] = locaisSelecionados.map((item) => ({
      local_id: item.local_id,
      horario_inicio: item.horario_inicio,
      horario_fim: item.horario_fim,
      dias_semana: item.dias_semana,
    }));

    // O usuário é criado sem o UID. O vínculo do cartão passa pelo endpoint
    // específico de RFID, usando o dispositivo que realizou a leitura.
    this.api.criarUsuario({
      nome,
      uid_card: null,
      vetor_facial: null,
      ativo,
      permissoes: permissoesPayload,
    }).subscribe({
      next: (usuario) => {
        this.api.cadastrarCartao(
          this.identificadorRfidSelecionado,
          uidNormalizado,
          usuario.user_id,
        ).subscribe({
          next: () => {
            this.api.cadastrarBiometria(
              usuario.user_id,
              this.fotoCapturada!
            ).subscribe({
              next: ({ vector_length }) => {
                this.saving = false;
                this.successMessage =
                  `Usuário ${usuario.nome} criado com sucesso (${locaisSelecionados.length} permissões e vetor facial de ${vector_length} dims).`;
                this.snackBar.open(this.successMessage, 'Fechar', { duration: 6000 });
                this.speech.falar('Usuário cadastrado com sucesso.');
              },
              error: (error) => {
                this.saving = false;
                this.errorMessage =
                  error.error?.detail ||
                  'Usuário e cartão foram cadastrados, mas não foi possível cadastrar a biometria.';
                this.snackBar.open(this.errorMessage, 'Fechar', { duration: 7000 });
              },
            });
          },
          error: (error) => {
            this.saving = false;
            this.errorMessage =
              error.status === 400
                ? (error.error?.detail || 'Este cartão já está cadastrado.')
                : 'Usuário criado, mas não foi possível associar o cartão RFID.';
            this.snackBar.open(this.errorMessage, 'Fechar', { duration: 7000 });
          },
        });
      },
      error: (error) => {
        this.saving = false;
        this.errorMessage = error.status === 409
          ? 'Este UID de cartão já está cadastrado.'
          : 'Não foi possível criar o usuário. Verifique se o backend está disponível.';
        this.snackBar.open(this.errorMessage, 'Fechar', { duration: 6000 });
      },
    });
  }

  reset(): void {
    this.pararWebcam();
    this.form.reset({ nome: '', uid_card: '', ativo: true });
    this.cameraOpened = false;
    this.scanning = false;
    this.submitted = false;
    this.saving = false;
    this.aguardandoRfid = false;
    this.identificadorRfidSelecionado = '';
    this.successMessage = '';
    this.errorMessage = '';
    this.fotoCapturada = null;
    this.fotoPreviewUrl = null;
    this.locaisPermissao.forEach((item) => {
      item.selecionado = false;
      item.horario_inicio = '08:00';
      item.horario_fim = '18:00';
      item.dias_semana = [1, 2, 3, 4, 5];
    });
  }

  openFileInput(): void {
    this.pararWebcam();
    document.getElementById('foto-captura')?.click();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      this.errorMessage = 'Selecione um arquivo de imagem válido.';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.fotoPreviewUrl = reader.result as string;
      this.cameraOpened = true;
      this.scanning = true;
      this.webcam.capturaPronta.set(true);
      this.errorMessage = '';
    };
    this.fotoCapturada = file;
    reader.readAsDataURL(file);
  }

  onScanFinished(event: AnimationEvent): void {
    if (event.animationName !== 'scan-line') return;
    this.scanning = false;
    this.webcam.capturaPronta.set(true);
  }

  toggleLocal(item: LocalPermissaoItem): void {
    item.selecionado = !item.selecionado;
  }

  toggleDiaLocal(item: LocalPermissaoItem, dia: number): void {
    item.dias_semana = item.dias_semana.includes(dia)
      ? item.dias_semana.filter((d) => d !== dia)
      : [...item.dias_semana, dia].sort();
  }

  private normalizarUid(uid: string): string | null {
    const normalizado = uid.replace(/[\s:-]/g, '').toUpperCase();
    return normalizado || null;
  }

  hasError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!control && control.hasError(error) && (control.touched || this.submitted);
  }
}