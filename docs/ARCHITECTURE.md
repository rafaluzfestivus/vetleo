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

Esta é a fundação: apenas o schema Postgres em
`supabase/migrations/20260805120000_initial_schema.sql`. Nada foi aplicado a
um projeto Supabase ainda, e a ingestão automática (OCR + upload para o
Drive) descrita abaixo **não está implementada** — é o próximo passo depois
que o schema for validado.

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

## Decisões em aberto

Estas escolhas não foram feitas ainda e bloqueiam a próxima fase:

- **Projeto Supabase de destino**: criar um projeto novo dedicado, ou usar
  um schema separado (ex.: `leo`) dentro de um projeto existente. O projeto
  atualmente disponível na conta hospeda dados de produção de um negócio
  não relacionado — não deve ser reaproveitado sem decisão explícita.
- **Modelo de autenticação/propriedade**: as políticas de RLS atuais são um
  placeholder (`authenticated_full_access` — qualquer usuário autenticado
  tem acesso total). Precisa de um modelo real antes de ir para produção.
- **Provedor de OCR**: qual serviço extrai texto/datas dos documentos.
- **Convenção de nomes e estrutura de pastas no Google Drive**.
- **Canal de notificação dos lembretes** (WhatsApp, e-mail, push, etc.) e
  mecanismo de agendamento (`pg_cron` vs. automação externa).

## Como aplicar o schema

Depois que o projeto Supabase de destino for decidido:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Ou aplique `supabase/migrations/20260805120000_initial_schema.sql` via MCP
(`apply_migration`) apontando para o projeto correto.
