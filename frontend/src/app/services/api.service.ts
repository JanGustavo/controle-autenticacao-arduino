import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE = 'http://localhost:8001/api/v1';

export interface AdmPageResponse {
  message: string;
}

export interface UsuarioResponse {
  user_id: number;
  nome: string;
  uid_card: string | null;
  vetor_facial: number[] | null;
  ativo: boolean;
  criado_em: string;
}

export interface UsuarioCreateRequest {
  nome: string;
  uid_card: string | null;
  vetor_facial: number[] | null;
  ativo: boolean;
  permissoes: PermissaoCreateRequest[];
}

export interface PermissaoCreateRequest {
  local_id: number;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
}

export interface LocalResponse {
  local_id: number;
  nome: string;
  identificador_dispositivo: string;
  ativo: boolean;
  criado_em: string;
}

export interface LocalRequest {
  nome: string;
  identificador_dispositivo: string;
  ativo: boolean;
}

export interface PermissaoResponse {
  permissao_id: number;
  usuario_id: number;
  local_id: number;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
}

export interface PermissaoRequest {
  usuario_id: number;
  local_id: number;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
}

export interface HistoricoAcessoResponse {
  id: number;
  usuario_id: number | null;
  local_id: number | null;
  uid_card_lido: string | null;
  data_hora: string;
  autorizado: boolean;
  percentual_similaridade: number | null;
  motivo_recusa: string | null;
  nome_usuario?: string | null;
  nome_local?: string | null;
}

export interface LoginResponse {
  sucesso: boolean;
  token?: string;
  mensagem?: string;
}

export interface BiometriaResponse {
  message: string;
  vector_length: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getAdmPage(): Observable<AdmPageResponse> {
    return this.http.get<AdmPageResponse>(`${API_BASE}/adm/adm-page`);
  }

  getUsuarios(filtros?: { q?: string; ativo?: boolean }): Observable<UsuarioResponse[]> {
    let params = new HttpParams();
    if (filtros?.q) params = params.set('q', filtros.q);
    if (filtros?.ativo !== undefined && filtros?.ativo !== null) params = params.set('ativo', filtros.ativo);
    return this.http.get<UsuarioResponse[]>(`${API_BASE}/usuarios`, { params });
  }

  getLocais(filtros?: { q?: string; ativo?: boolean }): Observable<LocalResponse[]> {
    let params = new HttpParams();
    if (filtros?.q) params = params.set('q', filtros.q);
    if (filtros?.ativo !== undefined && filtros?.ativo !== null) params = params.set('ativo', filtros.ativo);
    return this.http.get<LocalResponse[]>(`${API_BASE}/locais`, { params });
  }

  criarLocal(local: LocalRequest): Observable<LocalResponse> {
    return this.http.post<LocalResponse>(`${API_BASE}/locais`, local);
  }

  atualizarLocal(id: number, local: Partial<LocalRequest>): Observable<LocalResponse> {
    return this.http.patch<LocalResponse>(`${API_BASE}/locais/${id}`, local);
  }

  deletarLocal(id: number): Observable<{ mensagem: string }> {
    return this.http.delete<{ mensagem: string }>(`${API_BASE}/locais/${id}`);
  }

  getPermissoes(filtros?: { q?: string; usuario_id?: number; local_id?: number }): Observable<PermissaoResponse[]> {
    let params = new HttpParams();
    if (filtros?.q) params = params.set('q', filtros.q);
    if (filtros?.usuario_id) params = params.set('usuario_id', filtros.usuario_id);
    if (filtros?.local_id) params = params.set('local_id', filtros.local_id);
    return this.http.get<PermissaoResponse[]>(`${API_BASE}/permissoes`, { params });
  }

  getHistoricoAcesso(filtros?: { q?: string; usuario_id?: number; local_id?: number; autorizado?: boolean }): Observable<HistoricoAcessoResponse[]> {
    let params = new HttpParams();
    if (filtros?.q) params = params.set('q', filtros.q);
    if (filtros?.usuario_id) params = params.set('usuario_id', filtros.usuario_id);
    if (filtros?.local_id) params = params.set('local_id', filtros.local_id);
    if (filtros?.autorizado !== undefined && filtros?.autorizado !== null) params = params.set('autorizado', filtros.autorizado);
    return this.http.get<HistoricoAcessoResponse[]>(`${API_BASE}/historico-acesso`, { params });
  }

  criarPermissao(permissao: PermissaoRequest): Observable<PermissaoResponse> {
    return this.http.post<PermissaoResponse>(`${API_BASE}/permissoes`, permissao);
  }

  atualizarPermissao(id: number, permissao: Partial<PermissaoRequest>): Observable<PermissaoResponse> {
    return this.http.patch<PermissaoResponse>(`${API_BASE}/permissoes/${id}`, permissao);
  }

  deletarPermissao(id: number): Observable<{ mensagem: string }> {
    return this.http.delete<{ mensagem: string }>(`${API_BASE}/permissoes/${id}`);
  }

  criarUsuario(usuario: UsuarioCreateRequest): Observable<UsuarioResponse> {
    return this.http.post<UsuarioResponse>(`${API_BASE}/usuarios`, usuario);
  }

  cadastrarBiometria(usuarioId: number, foto: File | Blob): Observable<BiometriaResponse> {
    const dados = new FormData();
    const nomeArquivo = foto instanceof File ? foto.name : `biometria_${usuarioId}.jpg`;
    dados.append('file', foto, nomeArquivo);
    return this.http.post<BiometriaResponse>(`${API_BASE}/biometria/cadastrar/${usuarioId}`, dados);
  }

  testarBiometria(foto: FormData): Observable<{
    status: string;
    usuario_id?: number;
    nome?: string;
    similaridade: number;
    aprovado: boolean;
    mensagem: string;
  }> {
    return this.http.post<{
      status: string;
      usuario_id?: number;
      nome?: string;
      similaridade: number;
      aprovado: boolean;
      mensagem: string;
    }>(`${API_BASE}/autenticacao/testar-biometria`, foto);
  }

  loginAdm(usuario: string, senha: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_BASE}/auth/login`, { usuario, senha });
  }
}
