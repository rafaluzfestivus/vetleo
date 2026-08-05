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

Fundação do schema de dados. Veja [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
para o modelo de dados completo e as decisões em aberto (projeto Supabase de
destino, modelo de autenticação, provedor de OCR, integração com o Drive).

O schema Postgres vive em
[`supabase/migrations/20260805120000_initial_schema.sql`](supabase/migrations/20260805120000_initial_schema.sql)
e ainda não foi aplicado a nenhum projeto Supabase.
