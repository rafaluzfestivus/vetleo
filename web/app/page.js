import { getSupabase } from '../lib/supabase';
import { statusFor, formatDate } from '../lib/status';

export const dynamic = 'force-dynamic';

async function loadData() {
  const supabase = getSupabase();
  const [pets, healthRecords, medicalHistory, reminders, assistanceProfile, assistanceTasks, documents] =
    await Promise.all([
      supabase.from('pets').select('*').order('name'),
      supabase.from('health_records').select('*').order('expiration_date', { ascending: true, nullsFirst: false }),
      supabase.from('medical_history').select('*').order('event_date', { ascending: false }),
      supabase.from('reminders').select('*').order('alert_date'),
      supabase.from('assistance_dog_profile').select('*'),
      supabase.from('assistance_dog_tasks').select('*'),
      supabase.from('documents').select('*').order('uploaded_at', { ascending: false }),
    ]);

  const results = { pets, healthRecords, medicalHistory, reminders, assistanceProfile, assistanceTasks, documents };
  for (const [name, result] of Object.entries(results)) {
    if (result.error) throw new Error(`Erro consultando ${name}: ${result.error.message}`);
  }

  return {
    pets: pets.data ?? [],
    healthRecords: healthRecords.data ?? [],
    medicalHistory: medicalHistory.data ?? [],
    reminders: reminders.data ?? [],
    assistanceProfile: assistanceProfile.data ?? [],
    assistanceTasks: assistanceTasks.data ?? [],
    documents: documents.data ?? [],
  };
}

function Badge({ tone, children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

export default async function Page() {
  let data = null;
  let loadError = null;
  try {
    data = await loadData();
  } catch (err) {
    loadError = err.message;
  }

  return (
    <main>
      <h1>🐾 Léo</h1>
      <p className="subtitle">Painel de saúde, documentos e lembretes</p>

      {loadError ? (
        <div className="error-box">
          <strong>Não consegui carregar os dados.</strong>
          <p>{loadError}</p>
        </div>
      ) : (
        <>
          <PetsSection pets={data.pets} />
          <HealthRecordsSection records={data.healthRecords} />
          <RemindersSection reminders={data.reminders} />
          <MedicalHistorySection history={data.medicalHistory} />
          <AssistanceDogSection profile={data.assistanceProfile} tasks={data.assistanceTasks} />
          <DocumentsSection documents={data.documents} />
        </>
      )}
    </main>
  );
}

function PetsSection({ pets }) {
  return (
    <section>
      <h2>Pet</h2>
      {pets.length === 0 && <Empty>Nenhum pet cadastrado ainda.</Empty>}
      {pets.map((pet) => (
        <div className="card" key={pet.id}>
          <div className="card-title">{pet.name}</div>
          <div className="card-meta">
            {pet.breed || pet.species}
            {pet.sex ? ` · ${pet.sex}` : ''}
            {pet.birth_date ? ` · nascido em ${formatDate(pet.birth_date)}` : ''}
          </div>
        </div>
      ))}
    </section>
  );
}

function HealthRecordsSection({ records }) {
  return (
    <section>
      <h2>Vacinas, exames e medicações</h2>
      {records.length === 0 && <Empty>Nenhum registro de saúde cadastrado ainda.</Empty>}
      {records.map((r) => {
        const status = statusFor(r.expiration_date);
        return (
          <div className="card" key={r.id}>
            <div className="card-title">
              {r.name} <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <div className="card-meta">
              {r.record_type} · aplicada em {formatDate(r.application_date)}
              {r.veterinarian_crmv ? ` · CRMV ${r.veterinarian_crmv}` : ''}
              {r.batch_lot ? ` · lote ${r.batch_lot}` : ''}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function RemindersSection({ reminders }) {
  const pending = reminders.filter((r) => r.status === 'pending');
  return (
    <section>
      <h2>Lembretes pendentes</h2>
      {pending.length === 0 && <Empty>Nenhum lembrete pendente.</Empty>}
      {pending.map((r) => (
        <div className="card" key={r.id}>
          <div className="card-title">Alerta em {formatDate(r.alert_date)}</div>
          <div className="card-meta">vencimento: {formatDate(r.due_date)}</div>
        </div>
      ))}
    </section>
  );
}

function MedicalHistorySection({ history }) {
  return (
    <section>
      <h2>Histórico médico</h2>
      {history.length === 0 && <Empty>Nenhum histórico cadastrado ainda.</Empty>}
      {history.map((h) => (
        <div className="card" key={h.id}>
          <div className="card-title">{h.title}</div>
          <div className="card-meta">
            {h.category}
            {h.event_date ? ` · ${formatDate(h.event_date)}` : ''}
            {h.is_ongoing ? ' · em curso' : ''}
          </div>
          {h.description && <p>{h.description}</p>}
        </div>
      ))}
    </section>
  );
}

function AssistanceDogSection({ profile, tasks }) {
  return (
    <section>
      <h2>Cão de assistência</h2>
      {profile.length === 0 && <Empty>Nenhum perfil cadastrado ainda.</Empty>}
      {profile.map((p) => (
        <div className="card" key={p.id}>
          <div className="card-title">{p.legal_status || 'Perfil'}</div>
          <div className="card-meta">
            {p.cid10_code ? `CID-10 ${p.cid10_code}` : ''}
            {p.professional_registry ? ` · ${p.professional_registry}` : ''}
          </div>
        </div>
      ))}
      {tasks.length > 0 && (
        <div className="card">
          <div className="card-title">Tarefas treinadas</div>
          <div className="card-meta">{tasks.map((t) => t.task_name).join(', ')}</div>
        </div>
      )}
    </section>
  );
}

function DocumentsSection({ documents }) {
  return (
    <section>
      <h2>Documentos</h2>
      {documents.length === 0 && <Empty>Nenhum documento cadastrado ainda.</Empty>}
      {documents.map((d) => (
        <div className="card" key={d.id}>
          <div className="card-title">
            {d.drive_file_url ? (
              <a href={d.drive_file_url} target="_blank" rel="noreferrer">
                {d.original_filename}
              </a>
            ) : (
              d.original_filename
            )}
          </div>
          <div className="card-meta">
            {d.document_type} · {d.ocr_status}
          </div>
        </div>
      ))}
    </section>
  );
}
