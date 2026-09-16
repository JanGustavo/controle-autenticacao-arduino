import { Injectable, signal } from '@angular/core';

export interface UserSession {
  admin_id?: number;
  name: string;
  email: string;
  foto_url?: string | null;
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
    const admin_id = payload.sub ? Number(payload.sub) : undefined;
    const email = payload.email || 'admin@ardlock.local';
    const name = payload.nome || email.split('@')[0];
    const foto_url = payload.foto_url || null;
    return { admin_id, name, email, foto_url };
  } catch {
    return null;
  }
}

function carregarSessaoInicial(): UserSession | null {
  const token = localStorage.getItem('adm_token');
  const sessaoToken = extrairUserDoToken(token);
  console.log('[DEBUG - AuthService] Sessao do token:', sessaoToken);
  if (!sessaoToken) return null;

  const overrideSalvo = localStorage.getItem('adm_user_session');
  if (overrideSalvo) {
    try {
      const parsed = JSON.parse(overrideSalvo);
      console.log('[DEBUG - AuthService] Override salvo em localStorage:', parsed);
      if (parsed) {
        return { ...sessaoToken, ...parsed };
      }
    } catch {
      // Ignora JSON inválido
    }
  }
  return sessaoToken;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Signal reativo com o estado da sessão do usuário
  userSession = signal<UserSession | null>(carregarSessaoInicial());

  isLoggedIn(): boolean {
    const token = localStorage.getItem('adm_token');
    return isTokenValido(token) && this.userSession() !== null;
  }

  setToken(token: string): void {
    console.log('[DEBUG - AuthService] setToken chamado');
    localStorage.setItem('adm_token', token);
    localStorage.removeItem('adm_user_session');
    this.userSession.set(extrairUserDoToken(token));
  }

  updateUserSession(dadosNovos: Partial<UserSession>): void {
    console.log('[DEBUG - AuthService] updateUserSession chamado com:', dadosNovos);
    const atual = this.userSession();
    const nova: UserSession = {
      admin_id: dadosNovos.admin_id !== undefined ? dadosNovos.admin_id : atual?.admin_id,
      name: dadosNovos.name !== undefined ? dadosNovos.name : (atual?.name || 'Administrador'),
      email: dadosNovos.email !== undefined ? dadosNovos.email : (atual?.email || 'admin@ardlock.local'),
      foto_url: dadosNovos.foto_url !== undefined ? dadosNovos.foto_url : atual?.foto_url,
    };
    console.log('[DEBUG - AuthService] Nova sessão reativa definida:', nova);
    this.userSession.set(nova);
    localStorage.setItem('adm_user_session', JSON.stringify(nova));
  }

  clearToken(): void {
    console.log('[DEBUG - AuthService] clearToken chamado');
    localStorage.removeItem('adm_token');
    localStorage.removeItem('adm_user_session');
    this.userSession.set(null);
  }
}
