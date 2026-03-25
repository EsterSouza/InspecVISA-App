-- ============================================================
-- Migration 001 — Multi-Tenant SaaS (Card 1.1)
-- InspecVISA — C&C Consultoria Sanitária
-- ============================================================

-- ─── 1. NOVAS TABELAS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'consultant', 'client')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS tenant_checklist_access (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  checklist_type   TEXT NOT NULL CHECK (checklist_type IN ('estetica', 'ilpi', 'alimentos')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, checklist_type)
);

-- ─── 2. ALTER — clients ──────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS city       TEXT,
  ADD COLUMN IF NOT EXISTS state      TEXT;

-- ─── 3. ALTER — inspections ──────────────────────────────────

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS tenant_id            UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS accompanist_name     TEXT,
  ADD COLUMN IF NOT EXISTS accompanist_role     TEXT,
  ADD COLUMN IF NOT EXISTS ilpi_capacity        INTEGER,
  ADD COLUMN IF NOT EXISTS residents_total      INTEGER,
  ADD COLUMN IF NOT EXISTS residents_male       INTEGER,
  ADD COLUMN IF NOT EXISTS residents_female     INTEGER,
  ADD COLUMN IF NOT EXISTS dependency_level_1   INTEGER,
  ADD COLUMN IF NOT EXISTS dependency_level_2   INTEGER,
  ADD COLUMN IF NOT EXISTS dependency_level_3   INTEGER,
  ADD COLUMN IF NOT EXISTS signature_data_url   TEXT;

-- ─── 4. ALTER — responses ────────────────────────────────────

ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS responsible  TEXT,
  ADD COLUMN IF NOT EXISTS deadline     TEXT;

-- ─── 5. ALTER — schedules ────────────────────────────────────

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- ─── 6. ALTER — photos ───────────────────────────────────────

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS data_url   TEXT;  -- armazenamento local base64 / volume path

-- ─── 7. ÍNDICES ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id   ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id     ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id        ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inspections_tenant_id    ON inspections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_responses_tenant_id      ON responses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_tenant_id      ON schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_photos_tenant_id         ON photos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tca_tenant_id            ON tenant_checklist_access(tenant_id);
