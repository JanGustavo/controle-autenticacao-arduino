import { Injectable, signal } from '@angular/core';

export interface UserSession {
  admin_id?: number;
  name: string;
  email: string;
  foto_url?: string | null;
}

function decodificarPayloadJwt(token: string): Record<string, unknown> {
  const payloadBase64Url = token.split('.')[1];
  const payloadBase64 = payloadBase64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(payloadBase64Url.length / 4) * 4, '=');

  return JSON.parse(atob(payloadBase64));
}

function isTokenValido(token: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const partes = token.split('.');
  if (partes.length !== 3) return false;

  try {
    const payload = decodificarPayloadJwt(token);

    if (!payload['sub']) return false;
    if (payload['exp'] && typeof payload['exp'] === 'number') {
      const agoraEmSegundos = Math.floor(Date.now() / 1000);
      if (payload['exp'] < agoraEmSegundos) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function extrairUserDoToken(token: string | null): UserSession | null {
  if (!token || !isTokenValido(token)) return null;
  try {
    const payload = decodificarPayloadJwt(token);
    const admin_id = payload['sub'] ? Number(payload['sub']) : undefined;
    const email =
      typeof payload['email'] === 'string'
        ? payload['email']
        : 'admin@ardlock.local';
    const name =
      typeof payload['nome'] === 'string'
        ? payload['nome']
        : email.split('@')[0];
    const foto_url =
      typeof payload['foto_url'] === 'string' ? payload['foto_url'] : null;
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

  getToken(): string | null {
    const token = localStorage.getItem('adm_token');

    if (!isTokenValido(token)) {
      return null;
    }

    return token;
  }

  isLoggedIn(): boolean {
    return this.getToken() !== null && this.userSession() !== null;
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
