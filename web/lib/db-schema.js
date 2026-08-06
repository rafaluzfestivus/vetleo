// Allowlist of leo.* tables/columns the chat tool loop is permitted to
// touch. Keeps the model from writing arbitrary columns or reaching
// tables it shouldn't (pets, reminders stay read-only from chat).
export const TABLES = {
  pets: {
    insertable: [],
    updatable: [],
  },
  documents: {
    insertable: ['pet_id', 'document_type', 'original_filename', 'drive_file_id', 'drive_file_url', 'ocr_status', 'ocr_raw_text', 'notes'],
    updatable: ['document_type', 'original_filename', 'drive_file_id', 'drive_file_url', 'ocr_status', 'ocr_raw_text', 'notes'],
  },
  health_records: {
    insertable: ['pet_id', 'document_id', 'record_type', 'name', 'application_date', 'expiration_date', 'batch_lot', 'veterinarian_name', 'veterinarian_crmv', 'dosage', 'notes'],
    updatable: ['document_id', 'record_type', 'name', 'application_date', 'expiration_date', 'batch_lot', 'veterinarian_name', 'veterinarian_crmv', 'dosage', 'notes'],
  },
  medical_history: {
    insertable: ['pet_id', 'document_id', 'category', 'title', 'description', 'event_date', 'is_ongoing'],
    updatable: ['document_id', 'category', 'title', 'description', 'event_date', 'is_ongoing'],
  },
  reminders: {
    insertable: [],
    updatable: [],
  },
  assistance_dog_profile: {
    insertable: ['pet_id', 'legal_status', 'report_document_id', 'issuing_professional_name', 'professional_registry', 'cid10_code', 'cid10_description', 'certification_date', 'notes'],
    updatable: ['legal_status', 'report_document_id', 'issuing_professional_name', 'professional_registry', 'cid10_code', 'cid10_description', 'certification_date', 'notes'],
  },
  assistance_dog_tasks: {
    insertable: ['pet_id', 'task_name', 'description', 'trained_date', 'proficiency_level', 'notes'],
    updatable: ['task_name', 'description', 'trained_date', 'proficiency_level', 'notes'],
  },
};

export const TABLE_NAMES = Object.keys(TABLES);
