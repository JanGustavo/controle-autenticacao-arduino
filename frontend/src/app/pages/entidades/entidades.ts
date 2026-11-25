import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

interface Campo {
  nome: string;
  tipo: string;
  icone: string;
  fk?: boolean;
}
interface Entidade {
  chave: string;
  nome: string;
  tipo: string;
  icone: string;
  campos: Campo[];
  relacoes: { tipo: string; alvo: string }[];
}

@Component({
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  selector: 'app-entidades-page',
  templateUrl: './entidades.html',
  styleUrl: './entidades.scss',
})
export class EntidadesPage {
  /** Tabelas do banco, colunas e relações (referência técnica, sem consulta ao servidor). */
  readonly entidades: Entidade[] = [
    {
      chave: 'usuario',
      nome: 'usuario',
      tipo: 'Entidade principal',
      icone: 'person',
      campos: [
        { nome: 'user_id', tipo: 'INTEGER · PK', icone: 'key' },
        { nome: 'nome', tipo: 'VARCHAR(255)', icone: 'badge' },
        { nome: 'cpf', tipo: 'VARCHAR(11) · UNIQUE · opcional', icone: 'fingerprint' },
        { nome: 'tipo_usuario', tipo: 'ENUM · INTERNO | VISITANTE', icone: 'groups' },
        { nome: 'uid_card', tipo: 'VARCHAR(100) · UNIQUE', icone: 'contactless' },
        { nome: 'vetor_facial', tipo: 'JSONB', icone: 'face' },
        { nome: 'ativo', tipo: 'BOOLEAN', icone: 'toggle_on' },
        { nome: 'criado_em', tipo: 'TIMESTAMP', icone: 'calendar_today' },
      ],
      relacoes: [
        { tipo: '1 : N', alvo: 'permissao' },
        { tipo: '1 : N', alvo: 'historico_acesso' },
        { tipo: '1 : N', alvo: 'tentativa_acesso' },
      ],
    },
    {
      chave: 'permissao',
      nome: 'permissao',
      tipo: 'Regra de acesso',
      icone: 'schedule',
      campos: [
        { nome: 'permissao_id', tipo: 'INTEGER · PK', icone: 'key' },
        { nome: 'usuario_id', tipo: 'INT · FK → usuario', icone: 'link', fk: true },
        { nome: 'local_id', tipo: 'INT · FK → local', icone: 'link', fk: true },
        { nome: 'horario_inicio', tipo: 'TIME', icone: 'schedule' },
        { nome: 'horario_fim', tipo: 'TIME', icone: 'schedule' },
        { nome: 'dias_semana', tipo: 'ARRAY', icone: 'date_range' },
      ],
      relacoes: [
        { tipo: 'FK →', alvo: 'usuario' },
        { tipo: 'FK →', alvo: 'local' },
      ],
    },
    {
      chave: 'historico_acesso',
      nome: 'historico_acesso',
      tipo: 'Auditoria de acessos',
      icone: 'history',
      campos: [
        { nome: 'id', tipo: 'INTEGER · PK', icone: 'key' },
        { nome: 'usuario_id', tipo: 'INT · FK → usuario', icone: 'link', fk: true },
        { nome: 'local_id', tipo: 'INT · FK → local', icone: 'link', fk: true },
        { nome: 'dispositivo_id', tipo: 'INT · FK → dispositivo', icone: 'link', fk: true },
        { nome: 'uid_card_lido', tipo: 'VARCHAR(100)', icone: 'contactless' },
        { nome: 'data_hora', tipo: 'TIMESTAMP', icone: 'event' },
        { nome: 'autorizado', tipo: 'BOOLEAN', icone: 'verified' },
        { nome: 'percentual_similaridade', tipo: 'FLOAT', icone: 'percent' },
        { nome: 'motivo_recusa', tipo: 'VARCHAR(255)', icone: 'block' },
      ],
      relacoes: [
        { tipo: 'FK →', alvo: 'usuario' },
        { tipo: 'FK →', alvo: 'local' },
        { tipo: 'FK →', alvo: 'dispositivo' },
      ],
    },
    {
      chave: 'tentativa_acesso',
      nome: 'tentativa_acesso',
      tipo: 'Estado temporário do acesso',
      icone: 'hourglass_top',
      campos: [
        { nome: 'tentativa_id', tipo: 'UUID · PK', icone: 'key' },
        { nome: 'usuario_id', tipo: 'INT · FK → usuario', icone: 'link', fk: true },
        { nome: 'local_id', tipo: 'INT · FK → local', icone: 'link', fk: true },
        { nome: 'dispositivo_id', tipo: 'INT · FK → dispositivo', icone: 'link', fk: true },
        { nome: 'uid_card_lido', tipo: 'VARCHAR(100)', icone: 'contactless' },
        { nome: 'status', tipo: 'VARCHAR(20)', icone: 'flag' },
        { nome: 'criado_em', tipo: 'TIMESTAMP', icone: 'schedule' },
        { nome: 'expira_em', tipo: 'TIMESTAMP', icone: 'timer' },
        { nome: 'concluido_em', tipo: 'TIMESTAMP · opcional', icone: 'done_all' },
        { nome: 'percentual_similaridade', tipo: 'FLOAT', icone: 'percent' },
        { nome: 'motivo_recusa', tipo: 'VARCHAR(255)', icone: 'block' },
      ],
      relacoes: [
        { tipo: 'FK →', alvo: 'usuario' },
        { tipo: 'FK →', alvo: 'local' },
        { tipo: 'FK →', alvo: 'dispositivo' },
      ],
    },
    {
      chave: 'local',
      nome: 'local',
      tipo: 'Ponto de acesso',
      icone: 'location_on',
      campos: [
        { nome: 'local_id', tipo: 'INTEGER · PK', icone: 'key' },
        { nome: 'nome', tipo: 'VARCHAR(255)', icone: 'place' },
        { nome: 'ativo', tipo: 'BOOLEAN', icone: 'toggle_on' },
        { nome: 'criado_em', tipo: 'TIMESTAMP', icone: 'calendar_today' },
      ],
      relacoes: [
        { tipo: '1 : N', alvo: 'dispositivo' },
        { tipo: '1 : N', alvo: 'permissao' },
        { tipo: '1 : N', alvo: 'historico_acesso' },
        { tipo: '1 : N', alvo: 'tentativa_acesso' },
      ],
    },
    {
      chave: 'dispositivo',
      nome: 'dispositivo',
      tipo: 'Controladora física',
      icone: 'memory',
      campos: [
        { nome: 'dispositivo_id', tipo: 'INTEGER · PK', icone: 'key' },
        { nome: 'local_id', tipo: 'INT · FK → local', icone: 'link', fk: true },
        { nome: 'nome', tipo: 'VARCHAR(255)', icone: 'badge' },
        { nome: 'identificador', tipo: 'VARCHAR(100) · UNIQUE', icone: 'fingerprint' },
        { nome: 'ativo', tipo: 'BOOLEAN', icone: 'toggle_on' },
        { nome: 'criado_em', tipo: 'TIMESTAMP', icone: 'calendar_today' },
      ],
      relacoes: [
        { tipo: 'FK →', alvo: 'local' },
        { tipo: '1 : N', alvo: 'tentativa_acesso' },
        { tipo: '1 : N', alvo: 'historico_acesso' },
      ],
    },
    {
      chave: 'administrador',
      nome: 'administrador',
      tipo: 'Acesso ao painel',
      icone: 'admin_panel_settings',
      campos: [
        { nome: 'admin_id', tipo: 'INTEGER · PK', icone: 'key' },
        { nome: 'nome', tipo: 'VARCHAR(255)', icone: 'badge' },
        { nome: 'email', tipo: 'VARCHAR(255)', icone: 'mail' },
        { nome: 'senha_hash', tipo: 'VARCHAR(255)', icone: 'lock' },
        { nome: 'principal', tipo: 'BOOLEAN', icone: 'star' },
        { nome: 'foto_url', tipo: 'TEXT', icone: 'image' },
        { nome: 'ativo', tipo: 'BOOLEAN', icone: 'toggle_on' },
        { nome: 'criado_em', tipo: 'TIMESTAMP', icone: 'calendar_today' },
      ],
      relacoes: [
        { tipo: '1 : N', alvo: 'audit_logs' },
        { tipo: '1 : N', alvo: 'password_reset_token' },
      ],
    },
    {
      chave: 'audit_logs',
      nome: 'audit_logs',
      tipo: 'Logs do sistema',
      icone: 'list_alt',
      campos: [
        { nome: 'id', tipo: 'INTEGER · PK', icone: 'key' },
        { nome: 'admin_id', tipo: 'INT · FK → administrador', icone: 'link', fk: true },
        { nome: 'action', tipo: 'VARCHAR(50)', icone: 'flash_on' },
        { nome: 'resource_type', tipo: 'VARCHAR(50)', icone: 'category' },
        { nome: 'resource_id', tipo: 'VARCHAR(50)', icone: 'fingerprint' },
        { nome: 'description', tipo: 'TEXT', icone: 'description' },
        { nome: 'ip_address', tipo: 'VARCHAR(45)', icone: 'lan' },
        { nome: 'user_agent', tipo: 'TEXT', icone: 'devices' },
        { nome: 'request_id', tipo: 'VARCHAR(50)', icone: 'tag' },
        { nome: 'status', tipo: 'VARCHAR(20)', icone: 'check_circle' },
        { nome: 'metadata', tipo: 'JSONB', icone: 'data_object' },
        { nome: 'created_at', tipo: 'TIMESTAMP', icone: 'calendar_today' },
      ],
      relacoes: [
        { tipo: 'FK →', alvo: 'administrador' },
      ],
    },
    {
      chave: 'password_reset_token',
      nome: 'password_reset_token',
      tipo: 'Segurança',
      icone: 'vpn_key',
      campos: [
        { nome: 'id', tipo: 'INTEGER · PK', icone: 'key' },
        { nome: 'admin_id', tipo: 'INT · FK → administrador', icone: 'link', fk: true },
        { nome: 'token_hash', tipo: 'VARCHAR(64)', icone: 'password' },
        { nome: 'expira_em', tipo: 'TIMESTAMP', icone: 'timer' },
        { nome: 'usado', tipo: 'BOOLEAN', icone: 'check' },
        { nome: 'criado_em', tipo: 'TIMESTAMP', icone: 'calendar_today' },
      ],
      relacoes: [
        { tipo: 'FK →', alvo: 'administrador' },
      ],
    },
  ];

  // Mapeia o estado de expansão de cada entidade
  expandido: Record<string, boolean> = {
    usuario: false,
    permissao: false,
    historico_acesso: false,
    tentativa_acesso: false,
    local: false,
    dispositivo: false,
    administrador: false,
    audit_logs: false,
    password_reset_token: false,
  };

  toggleEntity(nome: string): void {
    this.expandido[nome] = !this.expandido[nome];
  }

  toggleTodos(): void {
    const todosExpandidos = Object.values(this.expandido).every((v) => v);
    Object.keys(this.expandido).forEach((key) => {
      this.expandido[key] = !todosExpandidos;
    });
  }

  get todosExpandidos(): boolean {
    return Object.values(this.expandido).every((v) => v);
  }

  chavePrimaria(campo: Campo): boolean {
    return campo.tipo.includes('PK');
  }
}
