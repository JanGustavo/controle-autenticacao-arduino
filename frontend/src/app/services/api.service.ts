import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE = 'http://localhost:8001/api';

export interface AdmPageResponse {
  message: string;
}

export interface LoginResponse {
  sucesso: boolean;
  token?: string;
  mensagem?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getAdmPage(): Observable<AdmPageResponse> {
    return this.http.get<AdmPageResponse>(`${API_BASE}/adm-page`);
  }

  loginAdm(usuario: string, senha: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_BASE}/auth/login`, { usuario, senha });
  }
}
