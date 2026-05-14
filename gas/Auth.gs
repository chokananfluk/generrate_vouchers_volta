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

  var rows = dbSelect('sessions',
    'token=eq.' + token + '&expires_at=gt.' + new Date().toISOString() +
    '&select=*,users(*)'
  );

  if (!rows || rows.length === 0) throw new Error('Session expired or invalid');
  var session = rows[0];
  var user = session.users;
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
