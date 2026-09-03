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
  title: 'Dashboard / Histórico de Acesso',
  subtitle: 'Métricas e log de entradas (historico_acesso)',
  icon: 'dashboard',
  accentColor: 'blue',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'usuario_id', label: 'ID Usuário' },
    { key: 'uid_card_lido', label: 'UID Card Lido' },
    { key: 'data_hora', label: 'Data / Hora' },
    { key: 'autorizado', label: 'Autorizado' },
    { key: 'percentual_similaridade', label: '% Similaridade' },
    { key: 'motivo_recusa', label: 'Motivo Recusa' },
  ],
  rows: [
    { id: 1, usuario_id: 1, uid_card_lido: 'A1:B2:C3:D4', data_hora: '2026-09-02 10:14:02', autorizado: 'Sim', percentual_similaridade: 98.5, motivo_recusa: '-' },
    { id: 2, usuario_id: 2, uid_card_lido: 'E5:F6:G7:H8', data_hora: '2026-09-02 10:20:45', autorizado: 'Não', percentual_similaridade: 42.0, motivo_recusa: 'Facial incompatível' },
    { id: 3, usuario_id: 3, uid_card_lido: '12:34:56:78', data_hora: '2026-09-02 11:05:12', autorizado: 'Sim', percentual_similaridade: 95.1, motivo_recusa: '-' },
    { id: 4, usuario_id: null, uid_card_lido: '99:99:99:99', data_hora: '2026-09-02 11:30:00', autorizado: 'Não', percentual_similaridade: null, motivo_recusa: 'Cartão não cadastrado' },
  ],
};

export const CADASTRAR_MOCK: TuplePageConfig = {
  title: 'Cadastrar Usuário',
  subtitle: 'Novo registro na tabela usuario',
  icon: 'person_add',
  accentColor: 'green',
  columns: [
    { key: 'coluna', label: 'Coluna DB' },
    { key: 'tipo', label: 'Tipo SQL' },
    { key: 'valor_mock', label: 'Exemplo de Entrada' },
    { key: 'obrigatorio', label: 'Obrigatório' },
  ],
  rows: [
    { coluna: 'nome', tipo: 'VARCHAR(255)', valor_mock: 'João Silva', obrigatorio: 'Sim' },
    { coluna: 'uid_card', tipo: 'VARCHAR(100)', valor_mock: 'A1:B2:C3:D4', obrigatorio: 'Não (Único)' },
    { coluna: 'vetor_facial', tipo: 'JSONB', valor_mock: '[0.123, 0.456, 0.789]', obrigatorio: 'Não' },
    { coluna: 'ativo', tipo: 'BOOLEAN', valor_mock: 'true', obrigatorio: 'Sim (Default: true)' },
  ],
};

export const USUARIOS_MOCK: TuplePageConfig = {
  title: 'Usuários',
  subtitle: 'Gerenciar registros da tabela usuario',
  icon: 'group',
  accentColor: 'orange',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'nome', label: 'Nome' },
    { key: 'uid_card', label: 'UID Card' },
    { key: 'vetor_facial', label: 'Vetor Facial' },
    { key: 'ativo', label: 'Ativo' },
    { key: 'criado_em', label: 'Criado Em' },
  ],
  rows: [
    { id: 1, nome: 'João Silva', uid_card: 'A1:B2:C3:D4', vetor_facial: 'Cadastrado (JSONB)', ativo: 'Sim', criado_em: '2026-09-01 08:00:00' },
    { id: 2, nome: 'Maria Souza', uid_card: 'E5:F6:G7:H8', vetor_facial: 'Cadastrado (JSONB)', ativo: 'Sim', criado_em: '2026-09-01 09:15:00' },
    { id: 3, nome: 'Carlos Lima', uid_card: '12:34:56:78', vetor_facial: 'Não Cadastrado', ativo: 'Sim', criado_em: '2026-09-01 10:30:00' },
    { id: 4, nome: 'Ana Oliveira', uid_card: 'AA:BB:CC:DD', vetor_facial: 'Cadastrado (JSONB)', ativo: 'Não', criado_em: '2026-09-02 14:20:00' },
  ],
};

export const PERMISSOES_MOCK: TuplePageConfig = {
  title: 'Permissões',
  subtitle: 'Regras da tabela permissao',
  icon: 'schedule',
  accentColor: 'purple',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'usuario_id', label: 'ID Usuário' },
    { key: 'horario_inicio', label: 'Horário Início' },
    { key: 'horario_fim', label: 'Horário Fim' },
    { key: 'dias_semana', label: 'Dias Semana (INT[])' },
  ],
  rows: [
    { id: 1, usuario_id: 1, horario_inicio: '08:00:00', horario_fim: '18:00:00', dias_semana: '[1, 2, 3, 4, 5]' },
    { id: 2, usuario_id: 2, horario_inicio: '00:00:00', horario_fim: '23:59:59', dias_semana: '[1, 2, 3, 4, 5, 6, 7]' },
    { id: 3, usuario_id: 3, horario_inicio: '07:00:00', horario_fim: '13:00:00', dias_semana: '[1, 2, 3, 4, 5]' },
  ],
};
