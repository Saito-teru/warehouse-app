ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS current_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS qr_png_base64 TEXT;

CREATE INDEX IF NOT EXISTS idx_equipment_name ON equipment (name);
