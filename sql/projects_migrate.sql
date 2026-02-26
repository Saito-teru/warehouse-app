-- sql/projects_migrate.sql（完全版・修正版）
-- 既存の projects / project_items があっても壊さずに
-- usage_start_at / usage_end_at を揃える移行SQL

BEGIN;

-- 1) 列名ズレを吸収（存在する旧名 → 新名へリネーム）
DO $$
BEGIN
  -- usage_start_at が無く、旧名がある場合はリネーム
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='projects' AND column_name='usage_start_at'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='projects' AND column_name='usage_start'
    ) THEN
      EXECUTE 'ALTER TABLE projects RENAME COLUMN usage_start TO usage_start_at';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='projects' AND column_name='usage_start_time'
    ) THEN
      EXECUTE 'ALTER TABLE projects RENAME COLUMN usage_start_time TO usage_start_at';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='projects' AND column_name='usage_start_datetime'
    ) THEN
      EXECUTE 'ALTER TABLE projects RENAME COLUMN usage_start_datetime TO usage_start_at';
    END IF;
  END IF;

  -- usage_end_at が無く、旧名がある場合はリネーム
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='projects' AND column_name='usage_end_at'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='projects' AND column_name='usage_end'
    ) THEN
      EXECUTE 'ALTER TABLE projects RENAME COLUMN usage_end TO usage_end_at';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='projects' AND column_name='usage_end_time'
    ) THEN
      EXECUTE 'ALTER TABLE projects RENAME COLUMN usage_end_time TO usage_end_at';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='projects' AND column_name='usage_end_datetime'
    ) THEN
      EXECUTE 'ALTER TABLE projects RENAME COLUMN usage_end_datetime TO usage_end_at';
    END IF;
  END IF;
END $$;

-- 2) 最終的に必要な列が無ければ追加（既存データがあっても安全）
ALTER TABLE projects ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS venue TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS usage_start_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS usage_end_at TIMESTAMPTZ;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS shipping_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS return_due_date DATE;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- 3) 既定値・NULL埋め（壊さない範囲で寄せる）
ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'draft';
UPDATE projects SET status = 'draft' WHERE status IS NULL;

UPDATE projects SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE projects ALTER COLUMN created_at SET DEFAULT NOW();

-- ※ usage_start_at / usage_end_at の NOT NULL 制約はまだ付けない
-- （既存データにNULLがある可能性があるため。画面入力が整った段階で付ける）

-- 4) project_items 側（存在している前提だが、足りない列があれば追加）
ALTER TABLE project_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
UPDATE project_items SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE project_items ALTER COLUMN created_at SET DEFAULT NOW();

-- 5) インデックス（列が揃ったので作成）
CREATE INDEX IF NOT EXISTS idx_projects_usage_start ON projects (usage_start_at);
CREATE INDEX IF NOT EXISTS idx_projects_usage_end   ON projects (usage_end_at);
CREATE INDEX IF NOT EXISTS idx_projects_status      ON projects (status);

CREATE INDEX IF NOT EXISTS idx_project_items_project   ON project_items (project_id);
CREATE INDEX IF NOT EXISTS idx_project_items_equipment ON project_items (equipment_id);

COMMIT;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='projects'
ORDER BY column_name;

