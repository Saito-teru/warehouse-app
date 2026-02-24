-- sql/projects_fix_nullable.sql（完全版：空OK対象を増やす）
-- 目的：
-- project-new.html では入力していない列があるため、NOT NULL だと INSERT が 500 になる。
-- 「存在する列だけ」NOT NULL を外す/既定値を付ける。

BEGIN;

-- status は既定値を付ける
ALTER TABLE projects
  ALTER COLUMN status SET DEFAULT 'draft';

UPDATE projects
SET status = 'draft'
WHERE status IS NULL;

DO $$
BEGIN
  -- shipping_type：空OK + 既定値 carry
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='projects' AND column_name='shipping_type'
  ) THEN
    EXECUTE 'ALTER TABLE projects ALTER COLUMN shipping_type DROP NOT NULL';
    EXECUTE 'ALTER TABLE projects ALTER COLUMN shipping_type SET DEFAULT ''carry''';
    EXECUTE 'UPDATE projects SET shipping_type = ''carry'' WHERE shipping_type IS NULL';
  END IF;

  -- person_in_charge：空OK
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='projects' AND column_name='person_in_charge'
  ) THEN
    EXECUTE 'ALTER TABLE projects ALTER COLUMN person_in_charge DROP NOT NULL';
  END IF;

  -- arrival_date：空OK
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='projects' AND column_name='arrival_date'
  ) THEN
    EXECUTE 'ALTER TABLE projects ALTER COLUMN arrival_date DROP NOT NULL';
  END IF;

  -- shipping_date：空OK（画面で未入力でも作成できるようにする）
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='projects' AND column_name='shipping_date'
  ) THEN
    EXECUTE 'ALTER TABLE projects ALTER COLUMN shipping_date DROP NOT NULL';
  END IF;

  -- return_due_date：空OK（画面で未入力でも作成できるようにする）
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='projects' AND column_name='return_due_date'
  ) THEN
    EXECUTE 'ALTER TABLE projects ALTER COLUMN return_due_date DROP NOT NULL';
  END IF;

  -- client_name / venue：空OK（念のため）
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='projects' AND column_name='client_name'
  ) THEN
    EXECUTE 'ALTER TABLE projects ALTER COLUMN client_name DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='projects' AND column_name='venue'
  ) THEN
    EXECUTE 'ALTER TABLE projects ALTER COLUMN venue DROP NOT NULL';
  END IF;

END $$;

COMMIT;


