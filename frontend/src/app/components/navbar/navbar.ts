import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, NavigationEnd } from '@angular/router';

function isTokenValido(token: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const partes = token.split('.');
  if (partes.length !== 3) return false;

  try {
    const payloadJson = atob(partes[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);

    if (!payload.sub) return false;
    if (payload.exp && typeof payload.exp === 'number') {
      const agoraEmSegundos = Math.floor(Date.now() / 1000);
      if (payload.exp < agoraEmSegundos) return false;
    }
    return true;
  } catch {
    return false;
  }
}

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule, RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class NavbarComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  readonly paginaAtual = signal(this.router.url.split('?')[0]);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.paginaAtual.set(event.urlAfterRedirects.split('?')[0]);
        this.menuAberto.set(false);
      }
    });
  }

  linkAtivo(path: string): boolean {
    return (
      this.paginaAtual() === path || (path === '/usuarios' && this.paginaAtual() === '/cadastrar')
    );
  }

  menuAberto = signal(false);
  readonly links = [
    { path: '/adm-page', label: 'Painel', icon: 'space_dashboard' },
    { path: '/usuarios', label: 'Usuários', icon: 'group' },
    { path: '/permissoes', label: 'Permissões', icon: 'schedule' },
    { path: '/validar-acesso', label: 'Validar acesso', icon: 'face' },
    { path: '/dashboard', label: 'Histórico', icon: 'history' },
    { path: '/locais', label: 'Locais', icon: 'location_on' },
    { path: '/dispositivos', label: 'Dispositivos', icon: 'memory' },
    { path: '/administradores', label: 'Administradores', icon: 'admin_panel_settings' },
    { path: '/audit-logs', label: 'Auditoria', icon: 'fact_check' },
  ];

  darkMode = signal<boolean>(false);
  failedUrls = new Set<string>();
  fotoModalUrl = signal<string | null>(null);

  ngOnInit(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.darkMode.set(true);
      document.body.classList.add('dark-mode');
    }
  }

  isLoggedIn(): boolean {
    const session = this.authService.userSession();
    return session !== null && this.authService.isLoggedIn();
  }

  get userDisplay() {
    const session = this.authService.userSession();
    const result = session || {
      admin_id: undefined,
      name: 'Administrador',
      email: 'admin@ardlock.local',
      foto_url: null,
    };
    return result;
  }

  get avatarInitial(): string {
    const name = this.userDisplay.name;
    return name ? name.trim().charAt(0).toUpperCase() : 'A';
  }

  onImgError(url: string | null | undefined): void {
    console.warn('[DEBUG - Navbar] ERRO de carregamento da imagem no header para URL:', url);
    if (url) {
      this.failedUrls.add(url);
    }
  }

  isImgValid(url: string | null | undefined): boolean {
    if (!url) return false;
    return !this.failedUrls.has(url);
  }

  expandirFoto(url: string | null | undefined): void {
    if (url && this.isImgValid(url)) {
      this.fotoModalUrl.set(url);
    }
  }

  fecharFotoModal(): void {
    this.fotoModalUrl.set(null);
  }

  toggleDarkMode(): void {
    const newValue = !this.darkMode();
    this.darkMode.set(newValue);
    if (newValue) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }

  logoff(): void {
    this.authService.clearToken();
    this.router.navigate(['/login']);
  }
}
