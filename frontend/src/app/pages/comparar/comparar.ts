import { Component, inject, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-comparar-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatSnackBarModule, RouterLink],
  templateUrl: './comparar.html',
  styleUrl: './comparar.scss',
})
export class CompararPage implements OnDestroy {
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;

  webcamAtiva = signal(false);
  scanning = signal(false);
  similaridade = signal(0);
  aprovado = signal(false);
  usuarioEncontrado = signal<string | null>(null);
  fotoPreviewUrl: string | null = null;
  stream: MediaStream | null = null;

  async iniciarWebcam(): Promise<void> {
    this.resetar();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
      });
      this.webcamAtiva.set(true);
      setTimeout(() => {
        if (this.videoElement?.nativeElement) {
          this.videoElement.nativeElement.srcObject = this.stream;
        }
      }, 50);
    } catch {
      this.snackBar.open('Erro ao acessar a webcam.', 'Fechar', { duration: 4000 });
    }
  }

  pararWebcam(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.webcamAtiva.set(false);
    this.scanning.set(false);
  }

  capturarEComparar(): void {
    if (!this.videoElement?.nativeElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.fotoPreviewUrl = canvas.toDataURL('image/jpeg', 0.95);

    canvas.toBlob((blob) => {
      if (!blob) return;

      const formData = new FormData();
      formData.append('file', blob, 'comparacao.jpg');

      this.scanning.set(true);

      this.api.testarBiometria(formData).subscribe({
        next: (res: any) => {
          this.scanning.set(false);
          this.pararWebcam();

          if (res.status === 'COMPARADO') {
            this.similaridade.set(res.similaridade);
            this.aprovado.set(res.aprovado);
            this.usuarioEncontrado.set(res.usuario || 'Usuário Desconhecido');
          } else {
            this.snackBar.open(res.mensagem || 'Nenhum cadastro para comparar.', 'Fechar', { duration: 4000 });
          }
        },
        error: (err) => {
          this.scanning.set(false);
          this.pararWebcam();
          this.snackBar.open(err.error?.detail || 'Erro ao comparar biometria.', 'Fechar', { duration: 4000 });
        },
      });
    }, 'image/jpeg', 0.95);
  }

  resetar(): void {
    this.pararWebcam();
    this.fotoPreviewUrl = null;
    this.similaridade.set(0);
    this.aprovado.set(false);
    this.usuarioEncontrado.set(null);
  }

  ngOnDestroy(): void {
    this.pararWebcam();
  }
}