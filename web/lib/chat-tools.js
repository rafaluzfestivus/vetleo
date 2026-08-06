import { TABLES, TABLE_NAMES } from './db-schema';

export const TOOLS = [
  {
    name: 'query_records',
    description:
      'Consulta linhas de uma tabela do schema leo. Use antes de inserir algo, para checar o que já existe (ex: achar o pet_id do Léo).',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: TABLE_NAMES },
        filters: {
          type: 'object',
          description: 'Pares coluna: valor para filtrar por igualdade exata. Opcional.',
        },
        limit: { type: 'integer', description: 'Máximo de linhas. Padrão 50.' },
      },
      required: ['table'],
    },
  },
  {
    name: 'insert_record',
    description:
      'Insere uma ou mais linhas numa tabela do schema leo. Para documentos com várias entradas (ex: carteira de vacinação com N vacinas), passe todas de uma vez em "values" como uma lista -- não faça uma chamada por linha.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: TABLE_NAMES },
        values: {
          description: 'Um objeto de coluna:valor para inserir uma linha, ou uma lista de objetos para inserir várias linhas de uma vez.',
          oneOf: [
            { type: 'object' },
            { type: 'array', items: { type: 'object' } },
          ],
        },
      },
      required: ['table', 'values'],
    },
  },
  {
    name: 'update_record',
    description: 'Atualiza uma linha existente de uma tabela do schema leo pelo id (uuid).',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: TABLE_NAMES },
        id: { type: 'string', description: 'uuid da linha a atualizar.' },
        values: { type: 'object', description: 'Pares coluna: valor a atualizar.' },
      },
      required: ['table', 'id', 'values'],
    },
  },
];

export async function executeTool(supabase, name, input) {
  const table = input?.table;
  const tableInfo = TABLES[table];
  if (!tableInfo) {
    return { error: `Tabela desconhecida ou não permitida: ${table}` };
  }

  if (name === 'query_records') {
    let query = supabase
      .from(table)
      .select('*')
      .limit(Number.isInteger(input.limit) ? input.limit : 50);
    if (input.filters && typeof input.filters === 'object') {
      for (const [column, value] of Object.entries(input.filters)) {
        query = query.eq(column, value);
      }
    }
    const { data, error } = await query;
    if (error) return { error: error.message };
    return { data };
  }

  if (name === 'insert_record') {
    const isBatch = Array.isArray(input.values);
    const rows = isBatch ? input.values : [input.values ?? {}];
    if (rows.length === 0) {
      return { error: 'values não pode ser uma lista vazia.' };
    }
    const disallowed = [...new Set(rows.flatMap((row) => Object.keys(row ?? {})))].filter(
      (key) => !tableInfo.insertable.includes(key)
    );
    if (disallowed.length > 0) {
      return { error: `Colunas não permitidas para insert em "${table}": ${disallowed.join(', ')}` };
    }
    const { data, error } = await supabase.from(table).insert(rows).select();
    if (error) return { error: error.message };
    return { data: isBatch ? data : data[0] };
  }

  if (name === 'update_record') {
    const values = input.values ?? {};
    const disallowed = Object.keys(values).filter((key) => !tableInfo.updatable.includes(key));
    if (disallowed.length > 0) {
      return { error: `Colunas não permitidas para update em "${table}": ${disallowed.join(', ')}` };
    }
    if (!input.id) return { error: 'id é obrigatório para update_record.' };
    const { data, error } = await supabase.from(table).update(values).eq('id', input.id).select().single();
    if (error) return { error: error.message };
    return { data };
  }

  return { error: `Ferramenta desconhecida: ${name}` };
}
