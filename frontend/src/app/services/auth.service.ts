import { Injectable, signal } from '@angular/core';

export interface UserSession {
  name: string;
  email: string;
}

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

function extrairUserDoToken(token: string | null): UserSession | null {
  if (!token || !isTokenValido(token)) return null;
  try {
    const payloadJson = atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);
    const email = payload.email || 'admin@ardlock.local';
    const name = payload.nome || email.split('@')[0];
    return { name, email };
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Signal reativo com o estado da sessão do usuário
  userSession = signal<UserSession | null>(extrairUserDoToken(localStorage.getItem('adm_token')));

  isLoggedIn(): boolean {
    const token = localStorage.getItem('adm_token');
    return isTokenValido(token) && this.userSession() !== null;
  }

  setToken(token: string): void {
    localStorage.setItem('adm_token', token);
    this.userSession.set(extrairUserDoToken(token));
  }

  clearToken(): void {
    localStorage.removeItem('adm_token');
    this.userSession.set(null);
  }
}
