import { Component, inject, OnInit } from '@angular/core';
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
export class CadastrarPage implements OnInit {
  private formBuilder = inject(FormBuilder);
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  cameraOpened = false;
  submitted = false;
  saving = false;
  usingFallbackVector = false;
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
  private vetorFacial: number[] | null = null;

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

    if (!this.vetorFacial) {
      this.vetorFacial = this.gerarVetorFacialFallback();
      this.usingFallbackVector = true;
    }

    this.saving = true;
    const { nome, uid_card, ativo } = this.form.getRawValue();
    this.api.criarUsuario({
      nome,
      uid_card: this.normalizarUid(uid_card),
      vetor_facial: this.vetorFacial,
      ativo,
      permissoes: this.selectedLocalIds.map((local_id) => ({
        local_id,
        horario_inicio: this.horarioInicio,
        horario_fim: this.horarioFim,
        dias_semana: this.diasSelecionados,
      })),
    }).subscribe({
      next: (usuario) => {
        this.saving = false;
        this.successMessage = this.usingFallbackVector
          ? `Usuário ${usuario.nome} criado com sucesso (ID ${usuario.user_id}). Atenção: vetor facial aleatório de teste.`
          : `Usuário ${usuario.nome} criado com sucesso (ID ${usuario.user_id}).`;
        this.snackBar.open(this.successMessage, 'Fechar', { duration: 6000 });
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
    this.form.reset({ nome: '', uid_card: '', ativo: true });
    this.cameraOpened = false;
    this.submitted = false;
    this.saving = false;
    this.usingFallbackVector = false;
    this.successMessage = '';
    this.errorMessage = '';
    this.vetorFacial = null;
    this.selectedLocalIds = [];
    this.fotoPreviewUrl = null;
  }

  openCamera(): void {
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
      this.errorMessage = '';
    };
    reader.readAsDataURL(file);
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

  private gerarVetorFacialFallback(): number[] {
    return Array.from({ length: 128 }, () => Number((Math.random() * 2 - 1).toFixed(6)));
  }

  hasError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!control && control.hasError(error) && (control.touched || this.submitted);
  }
}
