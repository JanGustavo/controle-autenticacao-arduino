import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import * as faceapi from '@vladmandic/face-api';
import { ApiService, LocalResponse } from '../../services/api.service';
import { SpeechService } from '../../services/speech.service';

type EstadoEnquadramento = 'ok' | 'sem_rosto' | 'sorriso' | null;

@Component({
  selector: 'app-cadastrar-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
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

  stream: MediaStream | null = null;
  webcamAtiva = false;
  webcamErro = '';
  cameraOpened = false;
  scanning = false;
  capturaPronta = signal(false);
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

  // Status visual para a webcam
  statusValidacao = signal<string>('Centralize o rosto');
  tipoStatus = signal<'info' | 'warn' | 'success'>('info');

  private intervalValidacao: ReturnType<typeof setInterval> | null = null;
  private modelosCarregados = false;
  private ultimoEstadoEnquadramento: EstadoEnquadramento = null;
  private processandoDeteccao = false;

  form = this.formBuilder.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
    uid_card: ['', [Validators.maxLength(100)]],
    ativo: [true],
  });

  async ngOnInit(): Promise<void> {
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

    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceExpressionNet.loadFromUri('/models');
      this.modelosCarregados = true;
    } catch (e) {
      console.warn('Não foi possível carregar os modelos locais do face-api:', e);
    }
  }

  ngOnDestroy(): void {
    this.pararWebcam();
  }

  async iniciarWebcam(): Promise<void> {
    this.webcamErro = '';
    this.statusValidacao.set('Centralize o rosto');
    this.tipoStatus.set('info');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
      });
      this.webcamAtiva = true;
      this.speech.falar('Centralize o rosto e mantenha uma expressão séria.');

      setTimeout(() => {
        if (this.videoElement?.nativeElement) {
          this.videoElement.nativeElement.srcObject = this.stream;
          this.iniciarLoopValidacao();
        }
      }, 100);
    } catch (err) {
      this.webcamAtiva = false;
      this.webcamErro = 'Erro ao acessar a webcam. Verifique as permissões.';
      this.speech.falar('Erro ao acessar a câmera.');
    }
  }

  private iniciarLoopValidacao(): void {
    this.pararLoopValidacao();
    this.ultimoEstadoEnquadramento = null;

    this.intervalValidacao = setInterval(async () => {
      if (this.processandoDeteccao) return;
      if (!this.webcamAtiva || !this.videoElement?.nativeElement || !this.modelosCarregados) {
        return;
      }

      const video = this.videoElement.nativeElement;
      if (video.paused || video.ended || !video.videoWidth) return;

      this.processandoDeteccao = true;
      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
          .withFaceExpressions();

        if (!detection) {
          this.capturaPronta.set(false);
          this.statusValidacao.set('Rosto não detectado');
          this.tipoStatus.set('warn');

          if (this.ultimoEstadoEnquadramento !== 'sem_rosto') {
            this.speech.falar('Rosto não detectado. Centralize-se na câmera.');
            this.ultimoEstadoEnquadramento = 'sem_rosto';
          }
          return;
        }

        const ehSorriso = detection.expressions.happy > 0.6;

        if (ehSorriso) {
          this.capturaPronta.set(false);
          this.statusValidacao.set('Sorriso detectado! Fique sério');
          this.tipoStatus.set('warn');

          if (this.ultimoEstadoEnquadramento !== 'sorriso') {
            this.speech.falar('Por favor, mantenha uma expressão neutra e fique sério.');
            this.ultimoEstadoEnquadramento = 'sorriso';
          }
        } else {
          this.capturaPronta.set(true);
          this.statusValidacao.set('Rosto enquadrado - Pronto!');
          this.tipoStatus.set('success');
          this.ultimoEstadoEnquadramento = 'ok';
        }
      } finally {
        this.processandoDeteccao = false;
      }
    }, 500);
  }

  private pararLoopValidacao(): void {
    if (this.intervalValidacao) {
      clearInterval(this.intervalValidacao);
      this.intervalValidacao = null;
    }
  }

  pararWebcam(): void {
    this.pararLoopValidacao();
    this.speech.parar();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.webcamAtiva = false;
    this.scanning = false;
    this.capturaPronta.set(false);
  }

  capturarFrameWebcam(): void {
    if (!this.videoElement?.nativeElement || !this.capturaPronta()) return;

    this.pararLoopValidacao();

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
        this.errorMessage = '';
        this.pararWebcam();
        this.speech.falar('Foto capturada com sucesso.');
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
            this.successMessage = `Usuário ${usuario.nome} criado com sucesso (vetor facial de ${vector_length} dimensões).`;
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
    this.capturaPronta.set(false);
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
      this.capturaPronta.set(true);
      this.errorMessage = '';
    };
    this.fotoCapturada = file;
    reader.readAsDataURL(file);
  }

  onScanFinished(event: AnimationEvent): void {
    if (event.animationName !== 'scan-line') return;
    this.scanning = false;
    this.capturaPronta.set(true);
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