-- migrate:up

CREATE TABLE IF NOT EXISTS app.student_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  student_id      UUID NOT NULL REFERENCES app.students(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL DEFAULT 'other'
                    CHECK (document_type IN ('photo','id_card','birth_certificate','academic_certificate','medical','recommendation','other')),
  file_name       TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  file_data       TEXT NOT NULL,   -- base64-encoded file contents
  file_size_kb    INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app.student_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_documents_tenant ON app.student_documents
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE INDEX idx_student_documents_tenant_student
  ON app.student_documents (tenant_id, student_id);

-- migrate:down

DROP TABLE IF EXISTS app.student_documents;
