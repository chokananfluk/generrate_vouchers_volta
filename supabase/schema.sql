-- ============================================================
-- Volta Voucher - Supabase Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  department    VARCHAR(100),   -- แผนก
  division      VARCHAR(100),   -- กอง
  section       VARCHAR(100),   -- ฝ่าย
  area          VARCHAR(100),   -- สายงาน/เขตพื้นที่
  role          VARCHAR(20)  DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active     BOOLEAN      DEFAULT true,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
-- SESSIONS TABLE (GAS-based auth tokens)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LOT COUNTERS (global counter per value type)
-- ============================================================
CREATE TABLE IF NOT EXISTS lot_counters (
  value_char CHAR(1) PRIMARY KEY,
  last_lot   INTEGER DEFAULT 0
);

INSERT INTO lot_counters (value_char, last_lot) VALUES
  ('T', 0), ('X', 0), ('Y', 0), ('Z', 0),
  ('A', 0), ('B', 0), ('C', 0), ('D', 0),
  ('E', 0), ('W', 0), ('F', 0), ('G', 0),
  ('H', 0), ('O', 0)
ON CONFLICT (value_char) DO NOTHING;

-- ============================================================
-- VOUCHER BATCHES (คำขอสร้าง voucher)
-- ============================================================
CREATE TABLE IF NOT EXISTS voucher_batches (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID         REFERENCES users(id) ON DELETE CASCADE,
  value_thb        DECIMAL(10,2) NOT NULL,
  quantity         INTEGER       NOT NULL CHECK (quantity > 0),
  start_date       DATE,
  expire_date      DATE,
  duration_days    INTEGER       DEFAULT 0,
  status           VARCHAR(50)   DEFAULT 'pending_receipt'
                   CHECK (status IN (
                     'pending_receipt',   -- รอแนบใบเสร็จ
                     'pending_approval',  -- รออนุมัติ
                     'approved',          -- อนุมัติ
                     'rejected',          -- ตีกลับ
                     'cancelled'          -- ยกเลิก
                   )),
  receipt_url      TEXT,
  receipt_filename VARCHAR(255),
  lot_number       INTEGER       NOT NULL DEFAULT 1,
  value_char       CHAR(1)       NOT NULL DEFAULT 'O',
  notes            TEXT,           -- หมายเหตุจาก user
  admin_notes      TEXT,           -- หมายเหตุจาก admin
  approved_at      TIMESTAMPTZ,
  approved_by      UUID         REFERENCES users(id),
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================
-- VOUCHER CODES (รหัส voucher แต่ละใบ)
-- ============================================================
CREATE TABLE IF NOT EXISTS voucher_codes (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id     UUID         REFERENCES voucher_batches(id) ON DELETE CASCADE,
  code         VARCHAR(16)  UNIQUE NOT NULL,
  value_thb    DECIMAL(10,2) NOT NULL,
  expire_date  DATE,
  duration_days INTEGER     DEFAULT 0,
  is_used      BOOLEAN      DEFAULT false,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  batch_id   UUID        REFERENCES voucher_batches(id) ON DELETE SET NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  type       VARCHAR(50)  DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read    BOOLEAN      DEFAULT false,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_token        ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user         ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_batches_user          ON voucher_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_batches_status        ON voucher_batches(status);
CREATE INDEX IF NOT EXISTS idx_codes_batch           ON voucher_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_codes_code            ON voucher_codes(code);
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id, is_read);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_batches_updated_at
  BEFORE UPDATE ON voucher_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DEFAULT ADMIN USER (change password after first login!)
-- password: Admin@1234  (bcrypt hash below is placeholder - generate real hash in GAS)
-- ============================================================
-- INSERT INTO users (email, password_hash, first_name, last_name, role)
-- VALUES ('admin@volta.com', '<bcrypt_hash_here>', 'Admin', 'Volta', 'admin');
