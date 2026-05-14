// ============================================================
// Utils.gs — Shared utilities
// ============================================================

// Value character map
var VALUE_CHAR_MAP = {
  1:    'T',
  5:    'V',  // not in spec but reserved
  10:   'A',
  20:   'B',
  50:   'C',
  88:   'G',
  99:   'F',
  100:  'X',
  200:  'D',
  300:  'E',
  500:  'Y',
  1000: 'Z',
  1129: 'H',
  5000: 'W'
};

// Get value char for an amount (O = other)
function getValueChar(amountThb) {
  var amount = parseFloat(amountThb);
  return VALUE_CHAR_MAP[amount] || 'O';
}

// Get next lot number for given value_char (wraps 01-99)
function getNextLot(valueChar) {
  var rows = dbSelect('lot_counters', 'value_char=eq.' + valueChar);
  var current = (rows && rows.length > 0) ? rows[0].last_lot : 0;
  var next = (current >= 99) ? 1 : current + 1;
  dbUpdate('lot_counters', 'value_char=eq.' + valueChar, { last_lot: next });
  return next;
}

// Generate a single unique 16-char voucher code
// Structure: [2 rand][valueChar][3 rand][lot2digits][8 rand]
function generateCode(valueChar, lotNumber) {
  var chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  var lotStr = String(lotNumber).padStart(2, '0');

  function randChars(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  // pos 1-2: random, pos 3: valueChar, pos 4-6: random, pos 7-8: lot, pos 9-16: random
  return randChars(2) + valueChar + randChars(3) + lotStr + randChars(8);
}

// Generate N unique codes (checks DB for duplicates)
function generateUniqueCodes(valueChar, lotNumber, quantity) {
  var codes = [];
  var attempts = 0;
  var maxAttempts = quantity * 20;

  while (codes.length < quantity && attempts < maxAttempts) {
    attempts++;
    var code = generateCode(valueChar, lotNumber);
    if (codes.indexOf(code) !== -1) continue;

    // Check DB
    var existing = dbSelect('voucher_codes', 'code=eq.' + code + '&select=id');
    if (!existing || existing.length === 0) {
      codes.push(code);
    }
  }

  if (codes.length < quantity) {
    throw new Error('Could not generate enough unique codes after ' + maxAttempts + ' attempts');
  }
  return codes;
}

// Simple token generator
function generateToken() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var token = '';
  for (var i = 0; i < 64; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

// bcrypt-style hashing via Utilities.computeDigest (SHA-256 as fallback)
function hashPassword(password) {
  var salt = generateToken().substring(0, 16);
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + password + 'VOLTA_SECRET_PEPPER'
  );
  var hex = bytes.map(function(b){ return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  return salt + ':' + hex;
}

function verifyPassword(password, hash) {
  var parts = hash.split(':');
  if (parts.length !== 2) return false;
  var salt = parts[0];
  var expected = parts[1];
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + password + 'VOLTA_SECRET_PEPPER'
  );
  var actual = bytes.map(function(b){ return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  return actual === expected;
}

// CORS-friendly JSON response
function jsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

function successResponse(data) {
  return jsonResponse({ success: true, data: data });
}

function errorResponse(message, code) {
  return jsonResponse({ success: false, error: message, code: code || 400 });
}
