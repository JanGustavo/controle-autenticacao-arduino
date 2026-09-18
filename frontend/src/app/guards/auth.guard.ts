import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

function isTokenValido(token: string): boolean {
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

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('adm_token');

  if (token && isTokenValido(token)) {
    return true;
  }

  localStorage.removeItem('adm_token');
  router.navigate(['/login']);
  return false;
};

