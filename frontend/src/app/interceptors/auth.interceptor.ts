import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

const PUBLIC_AUTH_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  const isPublicAuthRequest = PUBLIC_AUTH_PATHS.some((path) =>
    req.url.includes(path)
  );

  const request =
    token && !isPublicAuthRequest
      ? req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        })
      : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isPublicAuthRequest) {
        authService.clearToken();

        if (router.url !== '/login') {
          void router.navigate(['/login']);
        }
      }

      return throwError(() => error);
    })
  );
};
