CREATE TABLE IF NOT EXISTS product_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES production_lines(id),
  code text NOT NULL,
  name text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (line_id, code)
);

CREATE TABLE IF NOT EXISTS process_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  time_type text NOT NULL CHECK (time_type IN ('manual', 'machine_automatic')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  break_seconds integer NOT NULL DEFAULT 0 CHECK (break_seconds >= 0),
  meeting_seconds integer NOT NULL DEFAULT 0 CHECK (meeting_seconds >= 0),
  setup_seconds integer NOT NULL DEFAULT 0 CHECK (setup_seconds >= 0),
  other_stop_seconds integer NOT NULL DEFAULT 0 CHECK (other_stop_seconds >= 0),
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE shift_templates ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS time_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_number text NOT NULL UNIQUE,
  model_id uuid NOT NULL REFERENCES product_models(id),
  line_id uuid NOT NULL REFERENCES production_lines(id),
  process_element_id uuid NOT NULL REFERENCES process_elements(id),
  revision integer NOT NULL CHECK (revision > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'superseded')),
  performance_rating_pct numeric(6,2) NOT NULL DEFAULT 100 CHECK (performance_rating_pct > 0),
  allowance_pct numeric(6,2) NOT NULL DEFAULT 10 CHECK (allowance_pct >= 0 AND allowance_pct < 100),
  justification text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by text REFERENCES "user"(id),
  created_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, line_id, process_element_id, revision)
);

CREATE TABLE IF NOT EXISTS cycle_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_study_id uuid NOT NULL REFERENCES time_studies(id) ON DELETE CASCADE,
  cycle_number integer NOT NULL CHECK (cycle_number > 0),
  observed_seconds numeric(10,2) NOT NULL CHECK (observed_seconds > 0),
  is_excluded boolean NOT NULL DEFAULT false,
  exclusion_reason text,
  UNIQUE (time_study_id, cycle_number),
  CHECK (NOT is_excluded OR length(trim(exclusion_reason)) > 0)
);

CREATE TABLE IF NOT EXISTS standard_time_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_study_id uuid NOT NULL UNIQUE REFERENCES time_studies(id),
  model_id uuid NOT NULL REFERENCES product_models(id),
  line_id uuid NOT NULL REFERENCES production_lines(id),
  process_element_id uuid NOT NULL REFERENCES process_elements(id),
  revision integer NOT NULL,
  average_cycle_seconds numeric(10,2) NOT NULL,
  normal_time_seconds numeric(10,2) NOT NULL,
  standard_time_seconds numeric(10,2) NOT NULL,
  valid_cycle_count integer NOT NULL CHECK (valid_cycle_count >= 30),
  effective_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  approved_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, line_id, process_element_id, revision)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_current_standard_time
ON standard_time_revisions (model_id, line_id, process_element_id)
WHERE superseded_at IS NULL;

CREATE TABLE IF NOT EXISTS motion_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_number text NOT NULL UNIQUE,
  name text NOT NULL,
  model_id uuid NOT NULL REFERENCES product_models(id),
  line_id uuid NOT NULL REFERENCES production_lines(id),
  station_id uuid NOT NULL REFERENCES stations(id),
  observed_at date NOT NULL DEFAULT current_date,
  note text,
  created_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS motion_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motion_study_id uuid NOT NULL REFERENCES motion_studies(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence > 0),
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('walking', 'searching', 'picking', 'holding', 'inspection', 'machine_time', 'waiting', 'transportation')),
  value_class text NOT NULL CHECK (value_class IN ('va', 'nva', 'nnva')),
  observed_seconds numeric(10,2) NOT NULL CHECK (observed_seconds > 0),
  UNIQUE (motion_study_id, sequence)
);

CREATE TABLE IF NOT EXISTS line_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  model_id uuid NOT NULL REFERENCES product_models(id),
  line_id uuid NOT NULL REFERENCES production_lines(id),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, line_id, revision)
);

CREATE TABLE IF NOT EXISTS line_balance_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_balance_id uuid NOT NULL REFERENCES line_balances(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES stations(id),
  standard_time_revision_id uuid NOT NULL REFERENCES standard_time_revisions(id),
  UNIQUE (line_balance_id, standard_time_revision_id)
);

CREATE TABLE IF NOT EXISTS capacity_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_number text NOT NULL UNIQUE,
  name text NOT NULL,
  line_balance_id uuid NOT NULL REFERENCES line_balances(id),
  shift_template_id uuid NOT NULL REFERENCES shift_templates(id),
  target_quantity integer NOT NULL CHECK (target_quantity > 0),
  shift_seconds integer NOT NULL CHECK (shift_seconds > 0),
  break_seconds integer NOT NULL DEFAULT 0 CHECK (break_seconds >= 0),
  meeting_seconds integer NOT NULL DEFAULT 0 CHECK (meeting_seconds >= 0),
  setup_seconds integer NOT NULL DEFAULT 0 CHECK (setup_seconds >= 0),
  planned_downtime_seconds integer NOT NULL DEFAULT 0 CHECK (planned_downtime_seconds >= 0),
  available_time_seconds integer NOT NULL CHECK (available_time_seconds > 0),
  takt_time_seconds numeric(10,2) NOT NULL,
  bottleneck_cycle_seconds numeric(10,2) NOT NULL,
  bottleneck_station_id uuid NOT NULL REFERENCES stations(id),
  theoretical_capacity integer NOT NULL,
  theoretical_manpower integer NOT NULL,
  units_per_hour numeric(10,2) NOT NULL CHECK (units_per_hour > 0),
  loading_pct numeric(8,2) NOT NULL CHECK (loading_pct >= 0),
  time_utilization_pct numeric(6,2) NOT NULL CHECK (time_utilization_pct > 0 AND time_utilization_pct <= 100),
  line_efficiency_pct numeric(6,2) NOT NULL,
  balance_loss_pct numeric(6,2) NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  approved_by text REFERENCES "user"(id),
  approved_at timestamptz,
  created_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE capacity_scenarios ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE capacity_scenarios ADD COLUMN IF NOT EXISTS approved_by text REFERENCES "user"(id);
ALTER TABLE capacity_scenarios ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE capacity_scenarios ADD COLUMN IF NOT EXISTS shift_seconds integer;
ALTER TABLE capacity_scenarios ADD COLUMN IF NOT EXISTS break_seconds integer;
ALTER TABLE capacity_scenarios ADD COLUMN IF NOT EXISTS meeting_seconds integer;
ALTER TABLE capacity_scenarios ADD COLUMN IF NOT EXISTS setup_seconds integer;
ALTER TABLE capacity_scenarios ADD COLUMN IF NOT EXISTS planned_downtime_seconds integer;
ALTER TABLE capacity_scenarios ADD COLUMN IF NOT EXISTS units_per_hour numeric(10,2);
ALTER TABLE capacity_scenarios ADD COLUMN IF NOT EXISTS loading_pct numeric(8,2);
ALTER TABLE capacity_scenarios ADD COLUMN IF NOT EXISTS time_utilization_pct numeric(6,2);

UPDATE capacity_scenarios cs SET
  shift_seconds = st.duration_seconds,
  break_seconds = st.break_seconds,
  meeting_seconds = st.meeting_seconds,
  setup_seconds = st.setup_seconds,
  planned_downtime_seconds = st.other_stop_seconds,
  units_per_hour = round(3600 / cs.bottleneck_cycle_seconds, 2),
  loading_pct = round(cs.target_quantity * cs.bottleneck_cycle_seconds / cs.available_time_seconds * 100, 2),
  time_utilization_pct = round(cs.available_time_seconds::numeric / st.duration_seconds * 100, 2)
FROM shift_templates st
WHERE cs.shift_template_id = st.id AND cs.shift_seconds IS NULL;

ALTER TABLE capacity_scenarios ALTER COLUMN shift_seconds SET NOT NULL;
ALTER TABLE capacity_scenarios ALTER COLUMN break_seconds SET NOT NULL;
ALTER TABLE capacity_scenarios ALTER COLUMN meeting_seconds SET NOT NULL;
ALTER TABLE capacity_scenarios ALTER COLUMN setup_seconds SET NOT NULL;
ALTER TABLE capacity_scenarios ALTER COLUMN planned_downtime_seconds SET NOT NULL;
ALTER TABLE capacity_scenarios ALTER COLUMN units_per_hour SET NOT NULL;
ALTER TABLE capacity_scenarios ALTER COLUMN loading_pct SET NOT NULL;
ALTER TABLE capacity_scenarios ALTER COLUMN time_utilization_pct SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE capacity_scenarios
    ADD CONSTRAINT capacity_scenarios_status_check
    CHECK (status IN ('draft', 'submitted', 'approved'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL REFERENCES "user"(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_created_at_idx ON activities (created_at DESC);
CREATE INDEX IF NOT EXISTS time_studies_status_idx ON time_studies (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS motion_studies_created_at_idx ON motion_studies (created_at DESC);

UPDATE "user"
SET username = lower(split_part(email, '@', 1))
WHERE username IS NULL;
