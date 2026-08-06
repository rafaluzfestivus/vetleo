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
RLS habilitado.

## Fluxo de ingestão (planejado, não implementado)

1. Documento novo (foto/PDF) chega ao agente.
2. OCR extrai datas, lote, validade, CRMV e observações.
3. Arquivo original é renomeado (padrão a definir) e enviado ao Google Drive.
4. Um registro é criado em `documents` com o link do Drive e o status do OCR.
5. Os dados extraídos viram linhas em `health_records` ou `medical_history`,
   referenciando `document_id`.
6. Se o registro tiver `expiration_date`, o scheduler gera linhas em
   `reminders` para os offsets configurados (ex.: 30, 7, 0 dias antes).

## Fluxo de lembretes (planejado, não implementado)

Um job periódico (candidatos: Supabase Edge Function + `pg_cron`, ou uma
automação externa) deveria:

1. Escanear `health_records` por `expiration_date` próxima.
2. Garantir que existem linhas `reminders` para os offsets configurados,
   evitando duplicatas.
3. Nos dias em que `alert_date = hoje` e `status = 'pending'`, disparar a
   notificação pelo `channel` configurado e marcar `status = 'sent'`.

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

## Decisões em aberto

Estas escolhas não foram feitas ainda e bloqueiam a próxima fase:

- **Modelo de autenticação/propriedade**: as políticas de RLS atuais são um
  placeholder (`authenticated_full_access` — qualquer usuário autenticado
  tem acesso total). Precisa de um modelo real antes de ir para produção.
- **Provedor de OCR**: qual serviço extrai texto/datas dos documentos.
- **Convenção de nomes de arquivo** para documentos ingeridos automaticamente
  (a estrutura de pastas já existe, ver acima).
- **Canal de notificação dos lembretes** (WhatsApp, e-mail, push, etc.) e
  mecanismo de agendamento (`pg_cron` vs. automação externa).

## Como reaplicar o schema

```bash
supabase link --project-ref xexsxiutjqzkqoclvwpu
supabase db push
```

Ou aplique `supabase/migrations/20260805120000_initial_schema.sql` via MCP
(`apply_migration`).
