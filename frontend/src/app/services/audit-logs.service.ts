import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
    return this.http.get<AuditLog[]>(`${API_BASE}/adm/audit-logs`);
  }
}
