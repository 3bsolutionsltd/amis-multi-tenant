-- migrate:up

-- Timetable slots (SR-F-073: scheduling)
CREATE TABLE app.timetable_slots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES platform.tenants(id),
  -- Context
  programme       text,
  academic_year   text,
  term_number     int         CHECK (term_number BETWEEN 1 AND 4),
  -- Slot details
  day_of_week     text        NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  start_time      time        NOT NULL,
  end_time        time        NOT NULL,
  -- What / Where / Who
  course_id       text        NOT NULL,
  room            text,
  instructor_name text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timetable_end_after_start CHECK (end_time > start_time)
);

ALTER TABLE app.timetable_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY timetable_slots_tenant ON app.timetable_slots
  FOR ALL USING (tenant_id = app.current_tenant_id());

-- Fast lookups by programme + term
CREATE INDEX timetable_slots_prog_term
  ON app.timetable_slots (tenant_id, programme, academic_year, term_number);

-- migrate:down
DROP TABLE IF EXISTS app.timetable_slots;
