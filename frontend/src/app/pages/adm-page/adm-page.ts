import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { ApiService, AdmPageResponse } from '../../services/api.service';

@Component({
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterLink,
  ],
  selector: 'app-adm-page',
  styleUrl: './adm-page.scss',
  templateUrl: './adm-page.html',
})
export class AdmPage implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;

  dados = signal<AdmPageResponse | null>(null);
  carregando = signal(true);
  erro = signal<string | null>(null);
  webcamAtiva = signal(false);
  webcamErro = signal('');
  stream: MediaStream | null = null;
  scanning = signal(false);
  capturaPronta = signal(false);
  sucesso = signal(false);
  similaridade = signal(0);
  aprovado = signal(false);

  ngOnInit(): void {
    this.api.getAdmPage().subscribe({
      next: (res) => {
        this.dados.set(res);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível conectar ao servidor.');
        this.carregando.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.pararWebcam();
  }

  async iniciarWebcam(): Promise<void> {
    this.webcamErro.set('');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
      });
      this.webcamAtiva.set(true);
      setTimeout(() => {
        if (this.videoElement?.nativeElement) {
          this.videoElement.nativeElement.srcObject = this.stream;
          this.capturaPronta.set(true);
        }
      }, 50);
    } catch (err) {
      this.webcamAtiva.set(false);
      this.webcamErro.set('Erro ao acessar a webcam. Verifique se a câmera está conectada e com permissão concedida.');
    }
  }

  pararWebcam(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.webcamAtiva.set(false);
    this.scanning.set(false);
    this.capturaPronta.set(false);
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

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const formData = new FormData();
        formData.append('file', blob, 'biometria_teste.jpg');

        this.scanning.set(true);

        this.api.testarBiometria(formData).subscribe({
          next: (res: { status: string; similaridade: number; aprovado: boolean; mensagem?: string }) => {
            this.scanning.set(false);

            if (res.status === 'COMPARADO') {
              this.similaridade.set(res.similaridade);
              this.aprovado.set(res.aprovado);
              this.sucesso.set(true);

              const msg = res.aprovado
                ? 'Aprovado! Similaridade: ' + res.similaridade + '% (mínimo 70%)'
                : 'Negado. Similaridade: ' + res.similaridade + '% (mínimo 70%)';
              this.snackBar.open(msg, 'Fechar', { duration: 4000 });
            } else if (res.status === 'SEM_REGISTROS') {
              this.snackBar.open(res.mensagem || 'Nenhum usuário com biometria cadastrado.', 'Fechar', { duration: 4000 });
            } else {
              this.snackBar.open('Erro na comparação facial.', 'Fechar', { duration: 4000 });
            }
          },
          error: (err: any) => {
            this.scanning.set(false);
            this.snackBar.open(err.error?.detail || 'Erro ao testar biometria.', 'Fechar', { duration: 4000 });
          }
        });
      },
      'image/jpeg',
      0.95
    );
  }

  reset(): void {
    this.pararWebcam();
    this.similaridade.set(0);
    this.aprovado.set(false);
    this.sucesso.set(false);
  }
}