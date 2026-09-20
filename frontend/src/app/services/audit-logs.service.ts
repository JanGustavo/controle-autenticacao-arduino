import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function limparMetadata(metadata: any): any {
  if (!metadata) return null;
  
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return limparMetadata(parsed);
    } catch {
      return metadata;
    }
  }

  if (typeof metadata === 'object' && metadata !== null) {
    const resultado: Record<string, any> = {};
    for (const key of Object.keys(metadata)) {
      const valor = metadata[key];
      if (typeof valor === 'string' && valor.startsWith('data:')) {
        resultado[key] = '[dados removidos]';
      } else if (typeof valor === 'object' && valor !== null) {
        resultado[key] = limparMetadata(valor);
      } else {
        resultado[key] = valor;
      }
    }
    return resultado;
  }

  return metadata;
}

export interface AuditLog {
  id: number;
  admin_id: number;
  admin_nome: string;
  action: string;
  resource_type: string;
  resource_id: number;
  description: string;
  ip_address: string;
  user_agent: string;
  status: string;
  metadata: any;
  created_at: string;
}

const API_BASE = 'http://localhost:8001/api/v1';

@Injectable({
  providedIn: 'root'
})
export class AuditLogsService {
  private http = inject(HttpClient);

  getAuditLogs(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${API_BASE}/adm/audit-logs`).pipe(
      map((logs) => {
        if (!Array.isArray(logs)) return [];
        return logs.map((log) => ({
          ...log,
          metadata: limparMetadata(log.metadata),
        }));
      })
    );
  }
}