export interface TupleColumn {
  key: string;
  label: string;
}

export interface TupleRow {
  [key: string]: any;
}

export interface TuplePageConfig {
  title: string;
  subtitle: string;
  icon: string;
  accentColor: 'blue' | 'green' | 'orange' | 'purple';
  columns: TupleColumn[];
  rows: TupleRow[];
}

export const DASHBOARD_MOCK: TuplePageConfig = {
  title: 'Dashboard / Logs',
  subtitle: 'Métricas e histórico de acessos',
  icon: 'dashboard',
  accentColor: 'blue',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'timestamp', label: 'Data / Hora' },
    { key: 'user', label: 'Usuário' },
    { key: 'event', label: 'Evento' },
    { key: 'status', label: 'Status' },
  ],
  rows: [
    { id: '#1001', timestamp: '2026-09-02 10:14:02', user: 'João Silva', event: 'Acesso Liberado (RFID)', status: 'Sucesso' },
    { id: '#1002', timestamp: '2026-09-02 10:20:45', user: 'Maria Souza', event: 'Senha Incorreta', status: 'Negado' },
    { id: '#1003', timestamp: '2026-09-02 11:05:12', user: 'Carlos Lima', event: 'Acesso Liberado (Biometria)', status: 'Sucesso' },
    { id: '#1004', timestamp: '2026-09-02 11:30:00', user: 'Desconhecido', event: 'Tag Não Cadastrada', status: 'Alerta' },
    { id: '#1005', timestamp: '2026-09-02 12:15:22', user: 'Ana Oliveira', event: 'Acesso Liberado (RFID)', status: 'Sucesso' },
  ],
};

export const CADASTRAR_MOCK: TuplePageConfig = {
  title: 'Cadastrar Usuário',
  subtitle: 'Novas credenciais de acesso',
  icon: 'person_add',
  accentColor: 'green',
  columns: [
    { key: 'field', label: 'Campo' },
    { key: 'value', label: 'Valor Mock' },
    { key: 'type', label: 'Tipo' },
    { key: 'required', label: 'Obrigatório' },
  ],
  rows: [
    { field: 'Nome Completo', value: 'Gabriel Santos', type: 'Texto', required: 'Sim' },
    { field: 'Documento / CPF', value: '123.456.789-00', type: 'Texto', required: 'Sim' },
    { field: 'Código Tag RFID', value: 'E2:00:41:B8', type: 'Hex / Sensor', required: 'Sim' },
    { field: 'Nível de Permissão', value: 'Operador Padrão', type: 'Seleção', required: 'Sim' },
    { field: 'Senha PIN', value: '****', type: 'Numérico', required: 'Não' },
  ],
};

export const USUARIOS_MOCK: TuplePageConfig = {
  title: 'Usuários',
  subtitle: 'Gerenciar cadastros do sistema',
  icon: 'group',
  accentColor: 'orange',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'E-mail' },
    { key: 'role', label: 'Função' },
    { key: 'status', label: 'Status' },
  ],
  rows: [
    { id: 'USR-01', name: 'Ana Oliveira', email: 'ana@empresa.com', role: 'Administrador', status: 'Ativo' },
    { id: 'USR-02', name: 'Bruno Costa', email: 'bruno@empresa.com', role: 'Operador', status: 'Ativo' },
    { id: 'USR-03', name: 'Carla Dias', email: 'carla@empresa.com', role: 'Visitante', status: 'Inativo' },
    { id: 'USR-04', name: 'Daniel Alves', email: 'daniel@empresa.com', role: 'Operador', status: 'Ativo' },
    { id: 'USR-05', name: 'Eduarda Ramos', email: 'eduarda@empresa.com', role: 'Supervisora', status: 'Ativo' },
  ],
};

export const PERMISSOES_MOCK: TuplePageConfig = {
  title: 'Permissões',
  subtitle: 'Janelas e regras de acesso',
  icon: 'schedule',
  accentColor: 'purple',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'group', label: 'Grupo / Porta' },
    { key: 'timeRange', label: 'Horário Liberado' },
    { key: 'days', label: 'Dias de Acesso' },
    { key: 'status', label: 'Status' },
  ],
  rows: [
    { id: 'PERM-01', group: 'Portaria Principal', timeRange: '00:00 - 23:59', days: 'Seg - Dom', status: 'Ativo' },
    { id: 'PERM-02', group: 'Laboratório Arduino', timeRange: '08:00 - 18:00', days: 'Seg - Sex', status: 'Ativo' },
    { id: 'PERM-03', group: 'Servidores / TI', timeRange: '24h Restrito', days: 'Administradores', status: 'Ativo' },
    { id: 'PERM-04', group: 'Estac. Visitantes', timeRange: '07:00 - 20:00', days: 'Seg - Sáb', status: 'Pendente' },
  ],
};
