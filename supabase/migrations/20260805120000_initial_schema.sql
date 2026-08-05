-- Initial schema for the Leo health/logistics/documentation system.
-- Foundation migration: core tables only. OCR ingestion, Drive sync and the
-- reminder scheduler are not implemented yet -- see docs/ARCHITECTURE.md.
--
-- Lives in its own "leo" schema, isolated from "public" because this
-- project also hosts an unrelated business's production tables there.

create schema if not exists leo;

create extension if not exists "pgcrypto";

create or replace function leo.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql
set search_path = leo, pg_temp;

-- ---------------------------------------------------------------------------
-- pets: root entity. One row today (Leo), kept relational instead of a
-- hardcoded name so every other table has a stable owner to reference.
-- ---------------------------------------------------------------------------
create table leo.pets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text not null default 'canino',
  breed text,
  sex text check (sex in ('macho', 'femea')),
  birth_date date,
  microchip_number text,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger set_updated_at
  before update on leo.pets
  for each row execute function leo.set_updated_at();

-- ---------------------------------------------------------------------------
-- documents: original files (fotos, PDFs) stored in Google Drive. This is
-- the anchor for "zero retrabalho" -- OCR runs once per document, and every
-- structured record below points back to the source file instead of the
-- raw bytes being reprocessed.
-- ---------------------------------------------------------------------------
create table leo.documents (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references leo.pets(id) on delete cascade,
  document_type text not null check (
    document_type in ('carteira_vacinacao', 'laudo', 'exame', 'receita', 'outro')
  ),
  original_filename text not null,
  drive_file_id text,
  drive_file_url text,
  ocr_status text not null default 'pending' check (
    ocr_status in ('pending', 'processed', 'failed')
  ),
  ocr_raw_text text,
  notes text,
  uploaded_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index documents_pet_id_idx on leo.documents(pet_id);

create trigger set_updated_at
  before update on leo.documents
  for each row execute function leo.set_updated_at();

-- ---------------------------------------------------------------------------
-- health_records: vacinas, exames e medicacoes com datas e validades.
-- document_id links back to the source file OCR extracted this from.
-- ---------------------------------------------------------------------------
create table leo.health_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references leo.pets(id) on delete cascade,
  document_id uuid references leo.documents(id) on delete set null,
  record_type text not null check (
    record_type in ('vacina', 'exame', 'medicacao')
  ),
  name text not null,
  application_date date,
  expiration_date date,
  batch_lot text,
  veterinarian_name text,
  veterinarian_crmv text,
  dosage text,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index health_records_pet_id_idx on leo.health_records(pet_id);
create index health_records_expiration_date_idx on leo.health_records(expiration_date);

create trigger set_updated_at
  before update on leo.health_records
  for each row execute function leo.set_updated_at();

-- ---------------------------------------------------------------------------
-- medical_history: contexto pregresso -- diagnosticos, sintomas, alergias,
-- cirurgias e habitos. Distinct from health_records because these are
-- narrative/historical facts, not dated recurring events with validity.
-- ---------------------------------------------------------------------------
create table leo.medical_history (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references leo.pets(id) on delete cascade,
  document_id uuid references leo.documents(id) on delete set null,
  category text not null check (
    category in ('diagnostico', 'sintoma', 'alergia', 'cirurgia', 'habito')
  ),
  title text not null,
  description text,
  event_date date,
  is_ongoing boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index medical_history_pet_id_idx on leo.medical_history(pet_id);

create trigger set_updated_at
  before update on leo.medical_history
  for each row execute function leo.set_updated_at();

-- ---------------------------------------------------------------------------
-- reminders: one row per scheduled alert instance for a health_record
-- (e.g. 30/7/0 days before a vaccine's expiration_date). Rows are meant to
-- be generated by a future scheduler job, not entered by hand.
-- ---------------------------------------------------------------------------
create table leo.reminders (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references leo.pets(id) on delete cascade,
  health_record_id uuid references leo.health_records(id) on delete cascade,
  due_date date not null,
  offset_days integer not null default 0,
  alert_date date not null,
  status text not null default 'pending' check (
    status in ('pending', 'sent', 'dismissed')
  ),
  channel text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index reminders_pet_id_idx on leo.reminders(pet_id);
create index reminders_pending_alert_date_idx on leo.reminders(alert_date) where status = 'pending';

create trigger set_updated_at
  before update on leo.reminders
  for each row execute function leo.set_updated_at();

-- ---------------------------------------------------------------------------
-- assistance_dog_profile: vinculos legais do cao de assistencia --
-- laudo (Focinho Urbano), CRMV/CRM responsavel, CID-10. One profile per pet.
-- ---------------------------------------------------------------------------
create table leo.assistance_dog_profile (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null unique references leo.pets(id) on delete cascade,
  legal_status text,
  report_document_id uuid references leo.documents(id) on delete set null,
  issuing_professional_name text,
  professional_registry text,
  cid10_code text,
  cid10_description text,
  certification_date date,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create trigger set_updated_at
  before update on leo.assistance_dog_profile
  for each row execute function leo.set_updated_at();

-- ---------------------------------------------------------------------------
-- assistance_dog_tasks: tarefas treinadas (Lap, Across, Touch, ...).
-- Separate table because a profile has many tasks.
-- ---------------------------------------------------------------------------
create table leo.assistance_dog_tasks (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references leo.pets(id) on delete cascade,
  task_name text not null,
  description text,
  trained_date date,
  proficiency_level text,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index assistance_dog_tasks_pet_id_idx on leo.assistance_dog_tasks(pet_id);

create trigger set_updated_at
  before update on leo.assistance_dog_tasks
  for each row execute function leo.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security -- placeholder policies.
-- No ownership/guardian model has been decided yet (see docs/ARCHITECTURE.md
-- "Open decisions"). For now RLS is enabled on every table and access is
-- restricted to authenticated users only, blocking anonymous access by
-- default. Replace with per-guardian policies once auth is defined.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'pets', 'documents', 'health_records', 'medical_history',
      'reminders', 'assistance_dog_profile', 'assistance_dog_tasks'
    ])
  loop
    execute format('alter table leo.%I enable row level security', t);
    execute format(
      'create policy "authenticated_full_access" on leo.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- PostgREST access. Grants alone don't expose the schema over the API --
-- "leo" must also be added to Settings > API > Exposed schemas in the
-- Supabase dashboard, which isn't controllable from a SQL migration.
-- ---------------------------------------------------------------------------
grant usage on schema leo to authenticated, service_role;
grant all on all tables in schema leo to authenticated, service_role;
alter default privileges in schema leo grant all on tables to authenticated, service_role;
