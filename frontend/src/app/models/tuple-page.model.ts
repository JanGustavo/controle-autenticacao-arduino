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
  resource?: 'usuarios' | 'permissoes' | 'historico';
}

export const DASHBOARD_MOCK: TuplePageConfig = {
  title: 'Histórico de acesso',
  subtitle: 'Consulte tentativas, resultados e motivos de recusa.',
  icon: 'dashboard',
  accentColor: 'blue',
  resource: 'historico',
  columns: [
    { key: 'usuario_id', label: 'Usuário' },
    { key: 'local_id', label: 'Local' },
    { key: 'uid_card_lido', label: 'Cartão RFID' },
    { key: 'data_hora', label: 'Data / Hora' },
    { key: 'autorizado', label: 'Resultado' },
    { key: 'percentual_similaridade', label: 'Similaridade' },
    { key: 'motivo_recusa', label: 'Motivo Recusa' },
  ],
  rows: [],
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
    {
      coluna: 'uid_card',
      tipo: 'VARCHAR(100)',
      valor_mock: 'A1:B2:C3:D4',
      obrigatorio: 'Não (Único)',
    },
    {
      coluna: 'vetor_facial',
      tipo: 'JSONB',
      valor_mock: '[0.123, 0.456, 0.789]',
      obrigatorio: 'Não',
    },
    { coluna: 'ativo', tipo: 'BOOLEAN', valor_mock: 'true', obrigatorio: 'Sim (Default: true)' },
  ],
};

export const USUARIOS_MOCK: TuplePageConfig = {
  title: 'Usuários',
  subtitle: 'Gerencie dados, cartões e biometria das pessoas cadastradas.',
  icon: 'group',
  accentColor: 'orange',
  resource: 'usuarios',
  columns: [
    { key: 'user_id', label: 'ID' },
    { key: 'nome', label: 'Nome' },
    { key: 'cpf', label: 'CPF' },
    { key: 'tipo_usuario', label: 'Tipo' },
    { key: 'uid_card', label: 'Cartão RFID' },
    { key: 'vetor_facial', label: 'Biometria' },
    { key: 'ativo', label: 'Status' },
    { key: 'criado_em', label: 'Cadastrado em' },
  ],
  rows: [],
};

export const PERMISSOES_MOCK: TuplePageConfig = {
  title: 'Permissões',
  subtitle: 'Defina onde e quando cada pessoa pode acessar.',
  icon: 'schedule',
  accentColor: 'purple',
  resource: 'permissoes',
  columns: [
    { key: 'permissao_id', label: 'ID Permissão' },
    { key: 'usuario_id', label: 'Usuário' },
    { key: 'local_id', label: 'Local' },
    { key: 'horario_inicio', label: 'Horário Início' },
    { key: 'horario_fim', label: 'Horário Fim' },
    { key: 'dias_semana', label: 'Dias Permitidos' },
  ],
  rows: [],
};
