import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { ApiService, LocalResponse, PermissaoCreateRequest } from '../../services/api.service';
import { SpeechService } from '../../services/speech.service';
import { WebcamService } from '../../services/webcam.service';

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

  cameraOpened = false;
  scanning = false;
  submitted = false;
  saving = false;
  lendoRfidMock = false;
  successMessage = '';
  errorMessage = '';
  locaisPermissao: LocalPermissaoItem[] = [];
  locaisCarregando = true;
  locaisErro = '';
  fotoPreviewUrl: string | null = null;
  private fotoCapturada: Blob | File | null = null;

  form = this.formBuilder.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
    uid_card: ['', [Validators.maxLength(100)]],
    ativo: [true],
  });

  async ngOnInit(): Promise<void> {
    this.api.getLocais().subscribe({
      next: (locais) => {
        this.locaisPermissao = locais.map((local) => ({
          local_id: local.local_id,
          nome_local: local.nome,
          identificador: local.identificador_dispositivo,
          selecionado: false,
          horario_inicio: '08:00',
          horario_fim: '18:00',
          dias_semana: [1, 2, 3, 4, 5], // Padrão Seg-Sex
        }));
        this.locaisCarregando = false;
      },
      error: () => {
        this.locaisCarregando = false;
        this.locaisErro = 'Não foi possível carregar os locais disponíveis.';
      },
    });

    await this.webcam.carregarModelos();
  }

  ngOnDestroy(): void {
    this.pararWebcam();
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

  capturarRfidMock(): void {
    if (this.lendoRfidMock) return;

    this.lendoRfidMock = true;
    this.speech.falar('Aproxime o cartão do leitor.');

    setTimeout(() => {
      // Simula leitura de cartão RFID (4 bytes hexadecimais padrão Mifare Classic / RC522)
      const bytes = Array.from({ length: 4 }, () =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, '0')
          .toUpperCase()
      );
      const uidMock = bytes.join(':');

      this.form.patchValue({ uid_card: uidMock });
      this.form.get('uid_card')?.markAsDirty();
      this.form.get('uid_card')?.markAsTouched();
      this.lendoRfidMock = false;

      this.snackBar.open(`Cartão RFID lido: ${uidMock}`, 'OK', { duration: 3500 });
      this.speech.falar('Cartão identificado.');
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

    const locaisSelecionados = this.locaisPermissao.filter((item) => item.selecionado);

    if (!locaisSelecionados.length) {
      this.errorMessage = 'Selecione pelo menos um local e configure seu horário de acesso.';
      return;
    }

    if (!this.fotoCapturada) {
      this.errorMessage = 'Conclua a captura facial antes de criar o usuário.';
      return;
    }

    this.saving = true;
    const { nome, uid_card, ativo } = this.form.getRawValue();

    const permissoesPayload: PermissaoCreateRequest[] = locaisSelecionados.map((item) => ({
      local_id: item.local_id,
      horario_inicio: item.horario_inicio,
      horario_fim: item.horario_fim,
      dias_semana: item.dias_semana,
    }));

    this.api.criarUsuario({
      nome,
      uid_card: this.normalizarUid(uid_card),
      vetor_facial: null,
      ativo,
      permissoes: permissoesPayload,
    }).subscribe({
      next: (usuario) => {
        this.api.cadastrarBiometria(usuario.user_id, this.fotoCapturada!).subscribe({
          next: ({ vector_length }) => {
            this.saving = false;
            this.successMessage = `Usuário ${usuario.nome} criado com sucesso (${locaisSelecionados.length} permissões e vetor facial de ${vector_length} dims).`;
            this.snackBar.open(this.successMessage, 'Fechar', { duration: 6000 });
            this.speech.falar('Usuário cadastrado com sucesso.');
          },
          error: (error) => {
            this.saving = false;
            this.errorMessage = error.error?.detail || 'Usuário criado, mas não foi possível cadastrar a biometria.';
            this.snackBar.open(this.errorMessage, 'Fechar', { duration: 6000 });
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