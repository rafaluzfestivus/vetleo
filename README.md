# vetleo

Infraestrutura de gestão de saúde, logística e documentação do Léo: um
agente de IA com memória relacional permanente, para eliminar o
retrabalho de reprocessar PDFs e fotos a cada conversa.

## Objetivos

- **Zero retrabalho**: consultar vacinas, prazos e exames em milissegundos
  via banco de dados, sem repetir OCR.
- **Organização total de documentos**: arquivos originais (carteira de
  vacinação, laudos, exames) salvos e organizados no Google Drive.
- **Prevenção e proatividade**: nenhuma vacina, medicação ou prazo de
  viagem vence sem aviso prévio.
- **Histórico clínico unificado**: alergias, episódios médicos passados,
  exames e dados do Cão de Assistência Psiquiátrica centralizados.

## Estado atual

Fundação pronta: schema Postgres aplicado (schema `leo`, isolado, RLS
travado para `service_role`), pastas organizadas no Google Drive, e um
painel de leitura em **https://vetleo.vercel.app** (código em
[`web/`](web/)). Veja [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) para
o modelo de dados completo e as decisões tomadas.

O que falta é implementação: o fluxo de ingestão de documentos (OCR +
upload automático) e a Routine diária de lembretes — ambos esperando
`health_records` de verdade para trabalhar em cima.

O schema Postgres vive em [`supabase/migrations/`](supabase/migrations/).
