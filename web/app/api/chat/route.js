import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { TOOLS, executeTool } from '../../../lib/chat-tools';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-5';
const MAX_TOOL_ROUNDS = 4;
const STORAGE_BUCKET = 'leo-documents';

const SYSTEM_PROMPT = `Você é o assistente do sistema de gestão do Léo (um cão). Você tem acesso de leitura e escrita ao schema "leo" no Supabase através das ferramentas query_records, insert_record e update_record.

Tabelas: pets, documents, health_records, medical_history, reminders, assistance_dog_profile, assistance_dog_tasks.

Regras:
- Léo é (quase sempre) o único pet cadastrado. Se precisar de um pet_id e não souber, consulte "pets" primeiro.
- "pets" e "reminders" são somente leitura por aqui -- não tente inserir ou atualizar essas tabelas.
- Quando o usuário anexar um arquivo (foto/PDF), ele já vem incluído nesta mensagem para você ler diretamente -- não existe OCR externo, a leitura é sua. Extraia datas, lote, validade, CRMV e o que mais for relevante.
- Se um arquivo foi anexado, a mensagem já informa a URL onde ele foi salvo. Use essa URL exata (não invente uma) ao criar um registro em "documents".
- Datas sempre em formato AAAA-MM-DD.
- Não invente dado que não esteja na conversa nem no arquivo anexado -- pergunte se faltar informação necessária.
- Depois de gravar algo, confirme em português, direto, citando o que foi salvo.
- Responda só com texto simples, sem markdown pesado.`;

function toCompactMessages(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant') && typeof entry.text === 'string')
    .map((entry) => ({ role: entry.role, content: [{ type: 'text', text: entry.text }] }));
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada nas variáveis de ambiente.' }, { status: 503 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const message = String(formData.get('message') ?? '');
  const historyRaw = formData.get('history');
  let history = [];
  try {
    history = historyRaw ? JSON.parse(String(historyRaw)) : [];
  } catch {
    return NextResponse.json({ error: 'Histórico inválido.' }, { status: 400 });
  }

  const file = formData.get('file');
  const supabase = getSupabase();

  const userContent = [];
  let fileNote = '';

  if (file && typeof file === 'object' && 'arrayBuffer' in file && file.size > 0) {
    const mediaType = file.type || 'application/octet-stream';
    const isImage = mediaType.startsWith('image/');
    const isPdf = mediaType === 'application/pdf';

    if (!isImage && !isPdf) {
      return NextResponse.json({ error: 'Só aceito imagens ou PDF por enquanto.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const path = `${Date.now()}-${sanitizeFilename(file.name || 'arquivo')}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { contentType: mediaType });
    if (uploadError) {
      return NextResponse.json({ error: `Falha ao enviar arquivo: ${uploadError.message}` }, { status: 500 });
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signError) {
      return NextResponse.json({ error: `Falha ao gerar link do arquivo: ${signError.message}` }, { status: 500 });
    }

    fileNote = `\n\n[Arquivo anexado: "${file.name}", já salvo no Supabase Storage. URL: ${signedData.signedUrl}]`;

    if (isImage) {
      userContent.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } });
    } else {
      userContent.push({ type: 'document', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } });
    }
  }

  userContent.push({ type: 'text', text: `${message}${fileNote}` });

  const messages = [...toCompactMessages(history), { role: 'user', content: userContent }];
  const toolLog = [];
  let finalText = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages,
        }),
      });
    } catch (err) {
      return NextResponse.json({ error: `Falha ao chamar a API da Anthropic: ${err.message}` }, { status: 502 });
    }

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Erro na API da Anthropic (${response.status}): ${errText}` }, { status: 502 });
    }

    const data = await response.json();
    messages.push({ role: 'assistant', content: data.content });

    const toolUses = data.content.filter((block) => block.type === 'tool_use');
    if (toolUses.length === 0) {
      finalText = data.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
      break;
    }

    const toolResults = [];
    for (const toolUse of toolUses) {
      const result = await executeTool(supabase, toolUse.name, toolUse.input);
      toolLog.push({ tool: toolUse.name, input: toolUse.input, result });
      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return NextResponse.json({
    reply: finalText || 'Não consegui terminar essa tarefa em tempo -- tenta de novo ou divide em passos menores.',
    toolLog,
  });
}
