import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';

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

  darkMode = signal<boolean>(false);

  ngOnInit(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.darkMode.set(true);
      document.body.classList.add('dark-mode');
    }
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get userDisplay(): { name: string; email: string } {
    return this.authService.userSession() || { name: 'Administrador', email: 'admin@ardlock.local' };
  }

  get avatarInitial(): string {
    const name = this.userDisplay.name;
    return name ? name.trim().charAt(0).toUpperCase() : 'A';
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


