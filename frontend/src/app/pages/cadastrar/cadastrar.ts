import { CpfMaskDirective } from '../../directives/cpf-mask.directive';
import {
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import {
  ApiService,
  DispositivoSimplesResponse,
  PermissaoCreateRequest,
  TipoUsuario,
} from '../../services/api.service';
import { SpeechService } from '../../services/speech.service';
import { VisorFacial } from '../../components/visor-facial/visor-facial';
import { WebcamService } from '../../services/webcam.service';
import { OperacaoRfidService } from '../../services/operacao-rfid.service';

export interface LocalPermissaoItem {
  local_id: number;
  nome_local: string;
  selecionado: boolean;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
}

@Component({
  selector: 'app-cadastrar-page',
  standalone: true,
  imports: [
    CpfMaskDirective,
    CommonModule,
    VisorFacial,
    FormsModule,
    MatIconModule,
    MatSnackBarModule,
    ReactiveFormsModule,
    MatDialogModule,
  ],
  templateUrl: './cadastrar.html',
  styleUrl: './cadastrar.scss',
})
export class CadastrarPage implements OnInit, OnDestroy {
  @ViewChild(VisorFacial) visorFacial?: VisorFacial;

  private dialogRef = inject(MatDialogRef<CadastrarPage>);
  private usuarioCriado = false;
  private cdr = inject(ChangeDetectorRef);
  private formBuilder = inject(FormBuilder);
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private speech = inject(SpeechService);
  public webcam = inject(WebcamService);
  public operacoes = inject(OperacaoRfidService);
  /** O cadastro é a operação ativa: leituras não abrem a validação facial. */
  private fecharSessao = this.operacoes.abrirSessao();

  modoTotem = signal(true);
  cameraOpened = false;
  scanning = false;
  submitted = false;
  saving = false;
  lendoRfidMock = false;
  dispositivoRfidSelecionadoId: number | null = null;
  dispositivosCarregando = true;
  dispositivosErro = '';
  successMessage = '';
  errorMessage = '';
  locaisPermissao: LocalPermissaoItem[] = [];
  dispositivosRfid: DispositivoSimplesResponse[] = [];
  locaisCarregando = true;
  locaisErro = '';
  fotoPreviewUrl: string | null = null;
  private fotoCapturada: Blob | File | null = null;

  /** Aguardando o cartão no leitor reservado para este formulário. */
  get aguardandoRfid(): boolean {
    return this.operacoes.capturando();
  }

  get dispositivoRfidSelecionado(): DispositivoSimplesResponse | null {
    if (
      this.dispositivoRfidSelecionadoId === null ||
      this.dispositivoRfidSelecionadoId === undefined
    )
      return null;

    return (
      this.dispositivosRfid.find(
        (dispositivo) =>
          Number(dispositivo.dispositivo_id) === Number(this.dispositivoRfidSelecionadoId),
      ) ?? null
    );
  }

  get identificadorRfidSelecionado(): string {
    return this.dispositivoRfidSelecionado?.identificador ?? '';
  }

  /** Etapas obrigatórias do cadastro, na ordem do formulário, com o estado real de cada uma. */
  get etapas(): { rotulo: string; secao: string; ok: boolean }[] {
    const { nome, cpf, uid_card } = this.form.controls;
    return [
      { rotulo: 'Pessoa', secao: 'secao-pessoa', ok: nome.valid && cpf.valid },
      { rotulo: 'Cartão', secao: 'secao-cartao', ok: !!uid_card.value },
      { rotulo: 'Rosto', secao: 'secao-rosto', ok: !!this.fotoCapturada },
      { rotulo: 'Locais', secao: 'secao-locais', ok: this.locaisPermissao.some((item) => item.selecionado) },
    ];
  }

  /** Rola o formulário até uma seção e leva o foco para o título dela. */
  irPara(secao: string): void {
    const alvo = document.getElementById(secao);
    if (!alvo) return;
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    alvo.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' });
    alvo.focus({ preventScroll: true });
  }

  /** Escolhe o modo de captura facial sem alternar quando já está nele. */
  definirModoTotem(automatico: boolean): void {
    if (this.modoTotem() !== automatico) this.toggleModoTotem();
  }

  form = this.formBuilder.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
    cpf: ['', [Validators.maxLength(14), Validators.pattern(/^$|^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/)]],
    tipo_usuario: ['INTERNO' as TipoUsuario, [Validators.required]],
    uid_card: ['', [Validators.maxLength(100)]],
    ativo: [true],
  });

  async ngOnInit(): Promise<void> {
    this.api.getLocais({ ativo: true }).subscribe({
      next: (locais) => {
        this.locaisPermissao = locais.map((local) => ({
          local_id: local.local_id,
          nome_local: local.nome,
          selecionado: false,
          horario_inicio: '08:00',
          horario_fim: '18:00',
          dias_semana: [2, 3, 4, 5, 6], // Padrão Seg-Sex
        }));
        this.locaisCarregando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.locaisCarregando = false;
        this.cdr.markForCheck();
        this.locaisErro = 'Não foi possível carregar os locais disponíveis.';
      },
    });

    this.api.getDispositivosSimples({ ativo: true }).subscribe({
      next: (dispositivos) => {
        this.dispositivosRfid = dispositivos;
        this.dispositivosCarregando = false;
        this.cdr.markForCheck();
        this.dispositivosErro = '';

        if (
          this.dispositivoRfidSelecionadoId !== null &&
          !dispositivos.some((item) => item.dispositivo_id === this.dispositivoRfidSelecionadoId)
        ) {
          this.dispositivoRfidSelecionadoId = null;
        }
      },
      error: () => {
        this.dispositivosRfid = [];
        this.dispositivosCarregando = false;
        this.cdr.markForCheck();
        this.dispositivosErro = 'Não foi possível carregar os dispositivos RFID ativos.';
      },
    });

    await this.webcam.carregarModelos();
  }

  fechar(): void {
    if (!this.saving) this.dialogRef.close({ criado: this.usuarioCriado });
  }

  ngOnDestroy(): void {
    this.pararWebcam();
    this.speech.parar();
    // Fechar o cadastro cancela a leitura pendente e devolve o leitor ao acesso.
    this.operacoes.cancelarCaptura();
    this.fecharSessao();
  }

  toggleModoTotem(): void {
    this.modoTotem.set(!this.modoTotem());
    this.speech.falar(
      this.modoTotem()
        ? 'Modo totem ativado. Auto-captura habilitada.'
        : 'Modo assistido ativado. Captura manual.',
      true,
    );
    if (this.webcam.webcamAtiva()) {
      void this.iniciarWebcam();
    }
  }

  async iniciarWebcam(): Promise<void> {
    if (this.modoTotem()) {
      this.speech.falar('Centralize o rosto na moldura para cadastro.');
    }
    await this.webcam.iniciarWebcam(
      () => this.visorFacial?.videoElement(),
      this.modoTotem(),
      () => void this.capturarFrameWebcam(),
    );
  }

  pararWebcam(): void {
    this.webcam.pararWebcam();
    this.scanning = false;
  }

  async capturarFrameWebcam(): Promise<void> {
    if (!this.webcam.capturaPronta() && !this.modoTotem()) return;

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
    this.speech.falar('Aproxime o cartão do leitor RFID.');
    this.operacoes
      .capturarCartao(
        this.identificadorRfidSelecionado,
        (uid) => this.aplicarLeituraRfid(uid),
        () => {
          this.errorMessage =
            'O tempo para aproximar o cartão acabou e o leitor voltou ao modo de acesso. Clique em Iniciar leitura para tentar de novo.';
          this.cdr.markForCheck();
        },
      )
      .catch(() => {
        this.speech.parar();
        this.errorMessage =
          'Não foi possível reservar o leitor para a leitura do cartão. Verifique a conexão e tente novamente.';
        this.cdr.markForCheck();
      });
  }

  cancelarLeituraRfid(): void {
    this.operacoes.cancelarCaptura();
    this.speech.parar();
  }

  private aplicarLeituraRfid(uidCard: string): void {
    const uidNormalizado = this.normalizarUid(uidCard);

    this.form.patchValue({ uid_card: uidNormalizado || '' });
    this.form.get('uid_card')?.markAsDirty();
    this.form.get('uid_card')?.markAsTouched();
    this.cdr.markForCheck();

    this.snackBar.open(`Cartão RFID lido: ${uidNormalizado}`, 'Fechar', { duration: 3500 });
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
          .toUpperCase(),
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
      this.irPara('secao-pessoa');
      return;
    }

    if (!this.identificadorRfidSelecionado) {
      this.errorMessage = 'Selecione o dispositivo que fará a leitura do cartão.';
      this.irPara('secao-cartao');
      return;
    }

    const locaisSelecionados = this.locaisPermissao.filter((item) => item.selecionado);

    if (!locaisSelecionados.length) {
      this.errorMessage = 'Selecione pelo menos um local e configure seu horário de acesso.';
      this.irPara('secao-locais');
      return;
    }

    if (!this.fotoCapturada) {
      this.errorMessage = 'Conclua a captura facial antes de cadastrar o usuário.';
      this.irPara('secao-rosto');
      return;
    }

    const { nome, cpf, tipo_usuario, uid_card, ativo } = this.form.getRawValue();
    const uidNormalizado = this.normalizarUid(uid_card);
    const cpfNormalizado = this.normalizarCpf(cpf);

    if (!uidNormalizado) {
      this.errorMessage = 'Faça a leitura do cartão RFID antes de salvar.';
      this.irPara('secao-cartao');
      return;
    }

    this.saving = true;

    const permissoesPayload: PermissaoCreateRequest[] = locaisSelecionados.map((item) => ({
      local_id: item.local_id,
      horario_inicio: item.horario_inicio,
      horario_fim: item.horario_fim,
      dias_semana: item.dias_semana,
    }));

    // Um único endpoint valida a foto e só então grava usuário, cartão e permissões.
    // Se qualquer etapa falhar, a transação do backend é revertida por completo.
    this.api
      .cadastrarUsuarioCompleto(
        {
          nome,
          cpf: cpfNormalizado,
          tipo_usuario,
          uid_card: uidNormalizado,
          vetor_facial: null,
          ativo,
          permissoes: permissoesPayload,
        },
        this.identificadorRfidSelecionado,
        this.fotoCapturada,
      )
      .subscribe({
        next: (usuario) => {
          this.usuarioCriado = true;
          this.saving = false;
          this.cdr.markForCheck();
          const total = locaisSelecionados.length;
          this.successMessage = `Usuário ${usuario.nome} cadastrado com cartão, biometria e ${total} ${total === 1 ? 'permissão' : 'permissões'}.`;
          this.snackBar.open(this.successMessage, 'Fechar', { duration: 6000 });
          this.speech.falar('Usuário cadastrado com sucesso.');
          this.dialogRef.close({ criado: true, mensagem: this.successMessage });
        },
        error: (error) => {
          this.saving = false;
          this.cdr.markForCheck();
          this.errorMessage =
            error.error?.detail ||
            (error.status === 409
              ? 'CPF ou cartão já cadastrado. Nenhum novo usuário foi criado.'
              : 'Não foi possível concluir o cadastro. Nenhum dado parcial foi salvo.');
          this.snackBar.open(this.errorMessage, 'Fechar', { duration: 7000 });
          if (error.status === 400 || error.status === 422) {
            this.irPara(error.status === 400 ? 'secao-rosto' : 'secao-cartao');
          }
        },
      });
  }

  reset(): void {
    this.pararWebcam();
    this.form.reset({ nome: '', cpf: '', tipo_usuario: 'INTERNO', uid_card: '', ativo: true });
    this.cameraOpened = false;
    this.scanning = false;
    this.submitted = false;
    this.saving = false;
    this.cdr.markForCheck();
    this.operacoes.cancelarCaptura();
    this.dispositivoRfidSelecionadoId = null;
    this.successMessage = '';
    this.errorMessage = '';
    this.fotoCapturada = null;
    this.fotoPreviewUrl = null;
    this.locaisPermissao.forEach((item) => {
      item.selecionado = false;
      item.horario_inicio = '08:00';
      item.horario_fim = '18:00';
      item.dias_semana = [2, 3, 4, 5, 6];
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
    // O aviso de "selecione um local" deixa de valer assim que um local é marcado.
    if (item.selecionado && this.errorMessage.startsWith('Selecione pelo menos um local')) {
      this.errorMessage = '';
    }
  }

  toggleDiaLocal(item: LocalPermissaoItem, dia: number): void {
    item.dias_semana = item.dias_semana.includes(dia)
      ? item.dias_semana.filter((d) => d !== dia)
      : [...item.dias_semana, dia].sort();
  }

  private normalizarCpf(cpf: string): string | null {
    const normalizado = cpf.replace(/\D/g, '');
    return normalizado || null;
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
