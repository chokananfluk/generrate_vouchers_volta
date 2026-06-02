// ============================================================
// Auth.gs — Authentication & session management
// ============================================================

var SESSION_TTL_HOURS = 24;

// Login: returns session token + user info
function login(email, password) {
  if (!email || !password) throw new Error('Email and password required');

  var rows = dbSelect('users', 'email=eq.' + encodeURIComponent(email) + '&is_active=eq.true');
  if (!rows || rows.length === 0) throw new Error('Invalid credentials');

  var user = rows[0];
  if (!verifyPassword(password, user.password_hash)) throw new Error('Invalid credentials');

  // Create session
  var token = generateToken();
  var expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  dbInsert('sessions', { user_id: user.id, token: token, expires_at: expires });

  // Clean up old sessions for this user
  dbDelete('sessions', 'user_id=eq.' + user.id + '&expires_at=lt.' + new Date().toISOString());

  return {
    token: token,
    expiresAt: expires,
    user: {
      id:         user.id,
      email:      user.email,
      firstName:  user.first_name,
      lastName:   user.last_name,
      role:       user.role,
      department: user.department,
      division:   user.division,
      section:    user.section,
      area:       user.area,
      phone:      user.phone
    }
  };
}

// Validate token, return user object or throw
function requireAuth(token) {
  if (!token) throw new Error('Unauthorized');

  // แยก query แทน PostgREST join (select=*,users(*)) เพราะ join พังใน Supabase ตัวนี้
  // เหมือนที่ getAllBatches/getBatchDetail ทำ — ป้องกัน 401 จาก join error
  var rows = dbSelect('sessions',
    'token=eq.' + token + '&expires_at=gt.' + new Date().toISOString()
  );

  if (!rows || !Array.isArray(rows) || rows.length === 0) throw new Error('Session expired or invalid');
  var session = rows[0];

  var uRows = dbSelect('users', 'id=eq.' + session.user_id);
  var user = (uRows && Array.isArray(uRows) && uRows.length > 0) ? uRows[0] : null;
  if (!user || !user.is_active) throw new Error('Account inactive');

  return {
    id:         user.id,
    email:      user.email,
    firstName:  user.first_name,
    lastName:   user.last_name,
    role:       user.role,
    department: user.department,
    division:   user.division,
    section:    user.section,
    area:       user.area,
    phone:      user.phone
  };
}

function requireAdmin(token) {
  var user = requireAuth(token);
  if (user.role !== 'admin') throw new Error('Admin access required');
  return user;
}

// Logout
function logout(token) {
  if (!token) return;
  dbDelete('sessions', 'token=eq.' + token);
}

// Change password
function changePassword(token, oldPassword, newPassword) {
  var user = requireAuth(token);
  var rows = dbSelect('users', 'id=eq.' + user.id);
  var dbUser = rows[0];
  if (!verifyPassword(oldPassword, dbUser.password_hash)) throw new Error('Current password incorrect');
  var newHash = hashPassword(newPassword);
  dbUpdate('users', 'id=eq.' + user.id, { password_hash: newHash });
  return true;
}

// Admin reset password
function adminResetPassword(adminToken, userId, newPassword) {
  requireAdmin(adminToken);
  var newHash = hashPassword(newPassword);
  dbUpdate('users', 'id=eq.' + userId, { password_hash: newHash });
  return true;
}

// ============================================================
// Forgot / reset password (self-service via emailed token link)
// Token is stored in ScriptProperties (no DB schema change needed)
// ============================================================
var RESET_TTL_MIN = 60;

// Create a reset token for a user, store it, and email the reset link
function issuePasswordReset_(user) {
  var token = generateToken();
  var expires = Date.now() + RESET_TTL_MIN * 60 * 1000;

  PropertiesService.getScriptProperties().setProperty('reset_' + token, JSON.stringify({
    userId:  user.id,
    email:   user.email,
    expires: expires
  }));

  var resetUrl = getAppUrl() + '?page=reset&token=' + token;
  sendPasswordResetEmail(user, resetUrl);
}

// Step 1: user requests a reset link by email
function forgotPassword(email) {
  if (!email) throw new Error('Email required');

  var rows = dbSelect('users', 'email=eq.' + encodeURIComponent(email) + '&is_active=eq.true');
  // Always succeed regardless of whether the email exists (avoid user enumeration)
  if (rows && rows.length > 0) {
    issuePasswordReset_(rows[0]);
  }
  return { ok: true };
}

// Admin triggers a self-service reset link to a user (admin does NOT set the password)
function adminSendPasswordReset(adminToken, userId) {
  requireAdmin(adminToken);
  if (!userId) throw new Error('User ID required');

  var rows = dbSelect('users', 'id=eq.' + userId + '&is_active=eq.true');
  if (!rows || rows.length === 0) throw new Error('User not found');

  var user = rows[0];
  issuePasswordReset_(user);
  return { ok: true, email: user.email };
}

// Step 2: user submits a new password with the token
function resetPassword(token, newPassword) {
  if (!token || !newPassword) throw new Error('Token and new password required');
  if (String(newPassword).length < 6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');

  var props = PropertiesService.getScriptProperties();
  var key   = 'reset_' + token;
  var raw   = props.getProperty(key);
  if (!raw) throw new Error('ลิงก์รีเซ็ตไม่ถูกต้องหรือถูกใช้ไปแล้ว');

  var info;
  try { info = JSON.parse(raw); } catch(_) { throw new Error('ลิงก์รีเซ็ตไม่ถูกต้อง'); }

  if (!info.expires || Date.now() > info.expires) {
    props.deleteProperty(key);
    throw new Error('ลิงก์รีเซ็ตหมดอายุแล้ว กรุณาขอลิงก์ใหม่');
  }

  dbUpdate('users', 'id=eq.' + info.userId, { password_hash: hashPassword(newPassword) });
  props.deleteProperty(key);

  // Invalidate any existing sessions for this user (force re-login everywhere)
  dbDelete('sessions', 'user_id=eq.' + info.userId);

  return { ok: true };
}
