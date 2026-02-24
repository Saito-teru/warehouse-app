-- sql/projects_patch.sql（完全版）
-- projects（案件） + project_items（案件-機材）を追加
-- 既存の equipment テーブルを参照する前提

BEGIN;

-- 1) projects（案件）
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,

  title TEXT NOT NULL,                -- 表示名：案件名
  client_name TEXT,                   -- 表示名：クライアント
  venue TEXT,                         -- 表示名：会場名

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed', 'cancelled')), -- 表示：仮/確定/キャンセル

  usage_start_at TIMESTAMPTZ NOT NULL, -- 表示名：開始日時
  usage_end_at   TIMESTAMPTZ NOT NULL, -- 表示名：終了日時

  shipping_date DATE,                 -- 表示名：発送日
  return_due_date DATE,               -- 表示名：返却予定

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (usage_end_at > usage_start_at)
);

-- 2) project_items（案件で使う機材と数量）
CREATE TABLE IF NOT EXISTS project_items (
  id SERIAL PRIMARY KEY,

  project_id INTEGER NOT NULL
    REFERENCES projects(id) ON DELETE CASCADE,

  equipment_id INTEGER NOT NULL
    REFERENCES equipment(id) ON DELETE RESTRICT,

  quantity INTEGER NOT NULL CHECK (quantity > 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 同一案件で同じ機材が複数行にならないようにする
  UNIQUE (project_id, equipment_id)
);

-- 3) インデックス（検索・不足計算が重くならないため）
CREATE INDEX IF NOT EXISTS idx_projects_usage_start ON projects (usage_start_at);
CREATE INDEX IF NOT EXISTS idx_projects_usage_end   ON projects (usage_end_at);
CREATE INDEX IF NOT EXISTS idx_projects_status      ON projects (status);

CREATE INDEX IF NOT EXISTS idx_project_items_project ON project_items (project_id);
CREATE INDEX IF NOT EXISTS idx_project_items_equipment ON project_items (equipment_id);

COMMIT;
