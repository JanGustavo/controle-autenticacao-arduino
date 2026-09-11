import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { ApiService, LocalResponse } from '../../services/api.service';

@Component({
  selector: 'app-cadastrar-page',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatIconModule, MatSnackBarModule, ReactiveFormsModule, RouterLink],
  templateUrl: './cadastrar.html',
  styleUrl: './cadastrar.scss',
})
export class CadastrarPage implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;

  private formBuilder = inject(FormBuilder);
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  stream: MediaStream | null = null;
  webcamAtiva = false;
  webcamErro = '';
  cameraOpened = false;
  scanning = false;
  capturaPronta = false;
  submitted = false;
  saving = false;
  successMessage = '';
  errorMessage = '';
  locais: LocalResponse[] = [];
  locaisCarregando = true;
  locaisErro = '';
  selectedLocalIds: number[] = [];
  horarioInicio = '08:00';
  horarioFim = '18:00';
  diasSelecionados = [1, 2, 3, 4, 5];
  fotoPreviewUrl: string | null = null;
  private fotoCapturada: Blob | File | null = null;

  form = this.formBuilder.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
    uid_card: ['', [Validators.maxLength(100)]],
    ativo: [true],
  });

  ngOnInit(): void {
    this.api.getLocais().subscribe({
      next: (locais) => {
        this.locais = locais;
        this.locaisCarregando = false;
      },
      error: () => {
        this.locaisCarregando = false;
        this.locaisErro = 'Não foi possível carregar os locais disponíveis.';
      },
    });
  }

  ngOnDestroy(): void {
    this.pararWebcam();
  }

async iniciarWebcam(): Promise<void> {
  this.webcamErro = '';
  try {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
    });
    this.webcamAtiva = true;
    setTimeout(() => {
      if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.srcObject = this.stream;
        this.capturaPronta = true;
      }
    }, 50);
  } catch (err) {
    this.webcamAtiva = false;
    this.webcamErro = 'Erro ao acessar a webcam. Verifique permissões.';
  }
}

pararWebcam(): void {
  if (this.stream) {
    this.stream.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
  this.webcamAtiva = false;
  this.capturaPronta = false;
}

  capturarFrameWebcam(): void {
    if (!this.videoElement?.nativeElement) {
      return;
    }

    const video = this.videoElement.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.fotoPreviewUrl = canvas.toDataURL('image/jpeg', 0.95);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        this.fotoCapturada = blob;
        this.scanning = true;
        this.capturaPronta = true;
        this.errorMessage = '';
        this.pararWebcam();
      },
      'image/jpeg',
      0.95
    );
  }

  submit(): void {
    this.submitted = true;
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.selectedLocalIds.length) {
      this.errorMessage = 'Selecione pelo menos um local e configure o horário de acesso.';
      return;
    }

    if (!this.fotoCapturada) {
      this.errorMessage = 'Conclua a captura facial antes de criar o usuário.';
      return;
    }

    this.saving = true;
    const { nome, uid_card, ativo } = this.form.getRawValue();
    this.api.criarUsuario({
      nome,
      uid_card: this.normalizarUid(uid_card),
      vetor_facial: null,
      ativo,
      permissoes: this.selectedLocalIds.map((local_id) => ({
        local_id,
        horario_inicio: this.horarioInicio,
        horario_fim: this.horarioFim,
        dias_semana: this.diasSelecionados,
      })),
    }).subscribe({
      next: (usuario) => {
        this.api.cadastrarBiometria(usuario.user_id, this.fotoCapturada!).subscribe({
          next: ({ vector_length }) => {
            this.saving = false;
            this.successMessage = `Usuário ${usuario.nome} criado com sucesso (vetor facial com ${vector_length} números).`;
            this.snackBar.open(this.successMessage, 'Fechar', { duration: 6000 });
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
    this.capturaPronta = false;
    this.submitted = false;
    this.saving = false;
    this.successMessage = '';
    this.errorMessage = '';
    this.fotoCapturada = null;
    this.selectedLocalIds = [];
    this.fotoPreviewUrl = null;
    this.webcamErro = '';
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
      this.capturaPronta = true;
      this.errorMessage = '';
    };
    this.fotoCapturada = file;
    reader.readAsDataURL(file);
  }

  onScanFinished(event: AnimationEvent): void {
    if (event.animationName !== 'scan-line') {
      return;
    }

    this.scanning = false;
    this.capturaPronta = true;
  }

  toggleLocal(localId: number): void {
    this.selectedLocalIds = this.selectedLocalIds.includes(localId)
      ? this.selectedLocalIds.filter((id) => id !== localId)
      : [...this.selectedLocalIds, localId];
  }

  isLocalSelected(localId: number): boolean {
    return this.selectedLocalIds.includes(localId);
  }

  toggleDia(dia: number): void {
    this.diasSelecionados = this.diasSelecionados.includes(dia)
      ? this.diasSelecionados.filter((item) => item !== dia)
      : [...this.diasSelecionados, dia].sort();
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
