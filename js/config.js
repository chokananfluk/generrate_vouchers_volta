// ============================================================
// config.js — App-wide configuration
// ============================================================

const CONFIG = {
  // !! Replace with your deployed GAS Web App URL !!
  GAS_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',

  // !! Replace with your Supabase project URL !!
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_ANON_KEY',

  // Storage bucket name for receipts
  STORAGE_BUCKET: 'receipts',

  // Session storage key
  SESSION_KEY: 'volta_session',

  // Preset voucher values (THB)
  PRESET_VALUES: [20, 50, 100, 200, 500, 1000],

  // Value character map (mirrors GAS Utils.gs)
  VALUE_CHARS: {
    1: 'T', 10: 'A', 20: 'B', 50: 'C', 88: 'G',
    99: 'F', 100: 'X', 200: 'D', 300: 'E', 500: 'Y',
    1000: 'Z', 1129: 'H', 5000: 'W'
  },

  STATUS_LABELS: {
    pending_receipt:  'รอแนบใบเสร็จ',
    pending_approval: 'รออนุมัติ',
    approved:         'อนุมัติแล้ว',
    rejected:         'ตีกลับ',
    cancelled:        'ยกเลิก'
  },

  STATUS_COLORS: {
    pending_receipt:  'badge-warning',
    pending_approval: 'badge-info',
    approved:         'badge-success',
    rejected:         'badge-danger',
    cancelled:        'badge-secondary'
  }
};
