# Arquitetura — Sistema de Gestão do Léo

## Visão

Substituir o reprocessamento de PDFs/fotos a cada conversa com IA por uma
interface de agente conectada a uma fonte de dados permanente: Supabase para
dados estruturados, Google Drive para os arquivos originais. O agente
consulta em vez de reler documentos.

```
                 ┌──────────────────────┐
   Documento  ──▶│  Ingestão (OCR)       │──▶ Google Drive (arquivo original)
  (foto/PDF)      │  [planejado]          │──▶ Supabase (dados extraídos)
                 └──────────────────────┘

   Agente IA  ◀───consulta SQL/REST─────── Supabase
   (chat)     ◀───link do arquivo──────── Drive (via drive_file_url)
```

## Estado atual

O schema Postgres está aplicado no projeto Supabase existente
(`rafaluzfestivus's Project`), isolado num schema próprio, **`leo`**, para
não misturar com as tabelas de negócio já em produção nesse projeto
(`public.Proposta`, `public.clients`, etc). A ingestão automática (OCR +
upload para o Drive) descrita abaixo **não está implementada** — é o
próximo passo.

Para consultar via API REST/PostgREST, o schema `leo` precisa ser
adicionado em *Settings > API > Exposed schemas* no dashboard do Supabase —
isso não é controlável por migration SQL.

## Modelo de dados

| Tabela | Propósito |
|---|---|
| `pets` | Entidade raiz. Hoje uma linha (Léo), mantida relacional em vez de hardcoded para dar um dono estável a todas as outras tabelas. |
| `documents` | Um registro por arquivo original (foto/PDF) enviado ao Drive. Guarda `drive_file_id`/`drive_file_url`, o texto bruto do OCR e o status do processamento. É a âncora do "zero retrabalho": o OCR roda uma vez por documento, e os registros abaixo apontam para ele em vez de reler os bytes. |
| `health_records` | Vacinas, exames e medicações — eventos datados com validade (`application_date`, `expiration_date`, lote, CRMV). |
| `medical_history` | Histórico pregresso: diagnósticos, sintomas, alergias, cirurgias, hábitos. Separada de `health_records` porque são fatos narrativos/históricos, não eventos recorrentes com validade. |
| `reminders` | Uma linha por alerta agendado (ex.: 30/7/0 dias antes do vencimento de um `health_record`). Linhas são geradas por um job futuro, não digitadas à mão. |
| `assistance_dog_profile` | Vínculos legais do cão de assistência: laudo (Focinho Urbano), profissional responsável, CRMV/CRM, CID-10. Um perfil por pet. |
| `assistance_dog_tasks` | Tarefas treinadas (Lap, Across, Touch, ...). Tabela separada porque um perfil tem várias tarefas. |

Todas as tabelas têm `created_at`/`updated_at` (trigger `set_updated_at`) e
RLS habilitado sem policies (ver "Modelo de autenticação/propriedade"
abaixo) — só a `service_role` acessa.

## Fluxo de ingestão (planejado, não implementado)

Não há provedor de OCR externo. O próprio agente de IA lê o documento
diretamente (leitura multimodal de PDF/imagem, ou `read_file_content` do
Google Drive) e extrai os campos — sem chamar nenhuma API de OCR separada.
Isso é suficiente para o volume baixo de um único pet; ver "Provedor de
OCR" (resolvido) mais abaixo.

1. Documento novo (foto/PDF) chega ao agente.
2. O agente lê o conteúdo e extrai datas, lote, validade, CRMV e
   observações.
3. Arquivo original é renomeado (padrão em "Convenção de nomes de
   arquivo") e enviado à subpasta correta no Google Drive.
4. Um registro é criado em `documents` com o link do Drive; `ocr_raw_text`
   guarda o texto que o agente leu e `ocr_status` vira `processed`.
5. Os dados extraídos viram linhas em `health_records` ou `medical_history`,
   referenciando `document_id`.
6. Se o registro tiver `expiration_date`, o scheduler gera linhas em
   `reminders` para os offsets configurados (ex.: 30, 7, 0 dias antes).

## Fluxo de lembretes (planejado, não implementado)

Canal: **notificação push**, entregue pelo próprio agente de IA (sem
WhatsApp/e-mail/serviço externo). Mecanismo: uma **Routine diária**
(trigger agendado do Claude Code Remote, tipo cron) dispara uma sessão do
agente que:

1. Escaneia `health_records` por `expiration_date` próxima.
2. Garante que existem linhas em `reminders` para os offsets configurados
   (30/7/0 dias), evitando duplicatas.
3. Para linhas com `alert_date = hoje` e `status = 'pending'`, envia uma
   notificação push e marca `status = 'sent'`.

Não depende de `pg_cron` nem de Edge Function — a Routine já é o
agendador. Criar essa Routine fica para quando existirem `health_records`
de verdade para monitorar (hoje as tabelas estão vazias); ativá-la agora
seria uma rotina diária sem nada para checar.

## Estrutura de pastas no Google Drive

Os documentos do Léo já viviam soltos numa pasta raiz "Leo"
(`19mphRK1ZB-WkkrP07YGPMsWclw0U5Y6N`). Foram criadas subpastas por
categoria, espelhando o `document_type` de `leo.documents` (mais uma
categoria de viagem/seguros, que não tem equivalente no enum ainda):

| Subpasta | `document_type` correspondente | ID |
|---|---|---|
| `01_Vacinacao` | `carteira_vacinacao` | `1fPCL1D1FpSPArvrIGUeV2HEE_5143016` |
| `02_Exames` | `exame` | `1oyy8MC0Ziuin7E03U0oiItDEdD9mIJbV` |
| `03_Laudos` | `laudo` | `1mhdz2NLY2est4GEEF2Y7y11XhBAPwUPv` |
| `04_Receitas` | `receita` | `1aXwlpPQ90Hxb9waYpXV8PP8vXY016Sle` |
| `05_Viagem_Seguros` | `outro` (candidato a virar categoria própria) | `1c5KiBG9Hb3XYGBFZ4UVxPg3yDQCNyif7` |
| `06_Outros` | `outro` | `17IT18jcZK4BxW6NJQYPjEME_OsZExWUA` |

Os 10 arquivos que já estavam soltos na raiz da pasta "Leo" não têm nomes
no padrão do projeto (ver "Convenção de nomes de arquivo" abaixo) e não
foram classificados nas subpastas. Em vez disso, serão retirados da pasta
principal pelo usuário e reaproveitados como massa de teste do pipeline de
ingestão (OCR + renomeação automática) quando ele existir.

### Convenção de nomes de arquivo

Todo arquivo processado pelo pipeline de ingestão é renomeado para:

```
AAAA-MM-DD_Pet_tipo_descricao-curta.ext
```

- **`AAAA-MM-DD`**: data do evento extraída do documento (data de aplicação
  da vacina, data do exame, data de emissão do laudo/apólice) — não a data
  do upload. Se o OCR não conseguir extrair uma data, usa a data do upload
  e registra essa ressalva em `documents.notes`.
- **`Pet`**: nome do pet sem acento (`Leo`), capitalizado.
- **`tipo`**: slug minúsculo alinhado à subpasta de destino —
  `vacina`, `exame`, `laudo`, `receita`, `viagem`, `seguro` ou `outro`.
- **`descricao-curta`**: slug ascii em minúsculas, palavras separadas por
  hífen, até ~30 caracteres (ex.: `antirrabica`, `hemograma-completo`,
  `cvi-ue`, `seguro-saude`).
- **`.ext`**: extensão original, minúscula.
- Caracteres permitidos: `[a-z0-9-_.]`. Acentos são transliterados
  (`á`→`a`, `ç`→`c`), espaços viram hífen.
- Colisão de nome no mesmo destino: acrescenta `-2`, `-3`, ... antes da
  extensão.

Exemplos, com a subpasta de destino:

| Nome final | Subpasta |
|---|---|
| `2026-08-03_Leo_vacina_antirrabica.pdf` | `01_Vacinacao` |
| `2026-06-01_Leo_exame_hemograma-completo.pdf` | `02_Exames` |
| `2026-07-15_Leo_laudo_focinho-urbano.pdf` | `03_Laudos` |
| `2026-05-10_Leo_receita_apoquel.pdf` | `04_Receitas` |
| `2026-08-05_Leo_viagem_cvi-ue.pdf` | `05_Viagem_Seguros` |
| `2026-08-05_Leo_seguro_saude.pdf` | `05_Viagem_Seguros` |
| `2026-08-05_Leo_outro_declaracao.jpeg` | `06_Outros` |

## Modelo de autenticação/propriedade

Não existe login de usuário final: o único operador acessa `leo.*`
exclusivamente através do agente de IA, autenticado com a `service_role`
key do Supabase — que ignora RLS por design. Não há tabela de guardiões
nem app com login.

Por isso o RLS fica **habilitado, mas sem nenhuma policy**, em todas as
tabelas: isso nega acesso por padrão para os papéis `anon` e
`authenticated`, e as `GRANT`s desses dois papéis no schema `leo` foram
revogadas (ver
`supabase/migrations/20260806000000_lockdown_rls_single_operator.sql`).
Mesmo que alguém crie uma conta no projeto Supabase algum dia, ela não
enxerga nada em `leo.*`. Um advisor `rls_enabled_no_policy` aparece para
essas tabelas — é o comportamento esperado, não uma falha.

Se um dia existir um app/painel com múltiplas pessoas logando (família,
dog walker, veterinário), essa decisão precisa ser revisitada: aí sim
entra Supabase Auth de verdade e uma tabela de guardiões vinculando
`user_id` a `pet_id`, com policies por linha.

## Provedor de OCR

Não há provedor externo. O agente de IA lê o documento diretamente
(multimodal) em vez de chamar uma API de OCR/Document AI dedicada — sem
custo extra, sem credenciais adicionais, adequado ao volume baixo de um
único pet. Reavaliar se o volume de documentos crescer muito ou se a
letra manuscrita de algum documento for difícil demais para leitura
direta.

## Painel web (dashboard)

Complementa o agente de IA com uma página de leitura rápida, sem precisar
abrir uma conversa. Código em `web/` (Next.js App Router), deployado na
Vercel: **https://vetleo.vercel.app**.

- **Dados**: Server Component (`web/app/page.js`) consulta `leo.*` direto
  com a `service_role` key (`web/lib/supabase.js`), lida só no servidor —
  a chave nunca chega ao browser. Sem fetch client-side, então não existe
  caminho via chave `anon` que vazasse dado médico contornando a senha.
- **Proteção**: senha compartilhada própria (`web/proxy.js` +
  `web/app/login`, `web/app/api/login`), não a proteção nativa da Vercel.
  O token deste ambiente não tem permissão para alterar configurações do
  projeto (`update_project_deployment_protection` retornou 403 — falta de
  permissão e/ou recurso exclusivo do plano Pro), então a senha foi
  implementada em código: cookie httpOnly comparado a
  `sha256(DASHBOARD_PASSWORD)`. **Fecha por padrão**: se
  `DASHBOARD_PASSWORD` não estiver configurada, a página responde 503 para
  todo mundo em vez de deixar todo mundo entrar.
- **Variáveis de ambiente** (Project Settings > Environment Variables na
  Vercel — não configuráveis por aqui, mesma limitação de permissão):
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DASHBOARD_PASSWORD`.
- **Projeto Vercel**: `vetleo`, na equipe "rafaluzfestivus' projects" —
  mesma equipe que hospeda os sites de negócio (preventivasur, quimera,
  etc). Assim como no Supabase, os dados do Léo ficam isolados (schema
  próprio, sem overlap de projeto), mas o *projeto* Vercel em si convive
  com projetos de negócio na mesma equipe.

## Decisões em aberto

Nenhuma no momento — todas as decisões de fundação (auth, OCR, canal de
lembrete, pastas, nomenclatura) foram tomadas. Os itens que restam são de
implementação: montar o fluxo de ingestão de verdade e criar a Routine de
lembretes quando houver `health_records` para monitorar.

## Como reaplicar o schema

```bash
supabase link --project-ref xexsxiutjqzkqoclvwpu
supabase db push
```

Ou aplique `supabase/migrations/20260805120000_initial_schema.sql` via MCP
(`apply_migration`).
