import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { ApiService, LocalResponse } from '../../services/api.service';
import { SpeechService } from '../../services/speech.service';
import { WebcamService } from '../../services/webcam.service';

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
  public webcam = inject(WebcamService);

  cameraOpened = false;
  scanning = false;
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
    this.submitted = false;
    this.saving = false;
    this.successMessage = '';
    this.errorMessage = '';
    this.fotoCapturada = null;
    this.selectedLocalIds = [];
    this.fotoPreviewUrl = null;
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