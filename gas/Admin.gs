// ============================================================
// Admin.gs — User & admin management operations
// ============================================================

// List all users
function listUsers(adminToken, filters) {
  requireAdmin(adminToken);
  var q = 'order=created_at.desc';
  if (filters && filters.role)      q += '&role=eq.'      + filters.role;
  if (filters && filters.is_active !== undefined) {
    q += '&is_active=eq.' + filters.is_active;
  }
  var users = dbSelect('users', q);
  // Strip password_hash from response
  return (users || []).map(function(u) {
    delete u.password_hash;
    return u;
  });
}

// Create a new user (admin only)
function createUser(adminToken, params) {
  requireAdmin(adminToken);

  var required = ['email', 'password', 'first_name', 'last_name'];
  required.forEach(function(f) {
    if (!params[f]) throw new Error('Missing field: ' + f);
  });

  // Check duplicate email
  var existing = dbSelect('users', 'email=eq.' + encodeURIComponent(params.email));
  if (existing && existing.length > 0) throw new Error('Email already exists');

  var result = dbInsert('users', {
    email:         params.email,
    password_hash: hashPassword(params.password),
    first_name:    params.first_name,
    last_name:     params.last_name,
    phone:         params.phone         || null,
    department:    params.department    || null,
    division:      params.division      || null,
    section:       params.section       || null,
    area:          params.area          || null,
    role:          params.role          || 'user',
    is_active:     true
  });

  var user = Array.isArray(result) ? result[0] : result;
  delete user.password_hash;
  return user;
}

// Update user (admin or self)
function updateUser(token, userId, params) {
  var caller = requireAuth(token);

  // Only admin can change role or update other users
  if (caller.id !== userId && caller.role !== 'admin') throw new Error('Access denied');
  if (params.role && caller.role !== 'admin') throw new Error('Cannot change role');

  var allowed = ['first_name', 'last_name', 'phone', 'department', 'division', 'section', 'area'];
  if (caller.role === 'admin') allowed.push('role', 'is_active');

  var data = {};
  allowed.forEach(function(f) { if (params[f] !== undefined) data[f] = params[f]; });

  var result = dbUpdate('users', 'id=eq.' + userId, data);
  var user = Array.isArray(result) ? result[0] : result;
  if (user) delete user.password_hash;
  return user;
}

// Soft delete (deactivate) user
function deactivateUser(adminToken, userId) {
  requireAdmin(adminToken);
  return dbUpdate('users', 'id=eq.' + userId, { is_active: false });
}

// Reactivate user
function activateUser(adminToken, userId) {
  requireAdmin(adminToken);
  return dbUpdate('users', 'id=eq.' + userId, { is_active: true });
}

// Get dashboard stats for admin
function getAdminStats(adminToken) {
  requireAdmin(adminToken);

  var allBatches  = dbSelect('voucher_batches', 'select=status,quantity,value_thb,user_id') || [];
  var allUsers    = dbSelect('users', 'select=id,role&is_active=eq.true') || [];
  var allCodes    = dbSelect('voucher_codes', 'select=id') || [];

  var totalValue = allBatches
    .filter(function(b) { return b.status === 'approved'; })
    .reduce(function(sum, b) { return sum + parseFloat(b.value_thb) * parseInt(b.quantity); }, 0);

  var statusCounts = {};
  allBatches.forEach(function(b) { statusCounts[b.status] = (statusCounts[b.status] || 0) + 1; });

  return {
    totalUsers:    allUsers.filter(function(u) { return u.role === 'user'; }).length,
    totalAdmins:   allUsers.filter(function(u) { return u.role === 'admin'; }).length,
    totalBatches:  allBatches.length,
    totalCodes:    allCodes.length,
    totalValue:    totalValue,
    statusCounts:  statusCounts
  };
}

// Get dashboard stats for user
function getUserStats(token) {
  var user = requireAuth(token);
  var batches = dbSelect('voucher_batches',
    'user_id=eq.' + user.id + '&select=status,quantity,value_thb'
  ) || [];

  var totalValue = batches
    .filter(function(b) { return b.status === 'approved'; })
    .reduce(function(sum, b) { return sum + parseFloat(b.value_thb) * parseInt(b.quantity); }, 0);

  var statusCounts = {};
  batches.forEach(function(b) { statusCounts[b.status] = (statusCounts[b.status] || 0) + 1; });

  var totalCodes = 0;
  batches.filter(function(b) { return b.status === 'approved'; })
    .forEach(function(b) { totalCodes += parseInt(b.quantity); });

  return {
    totalBatches: batches.length,
    totalCodes:   totalCodes,
    totalValue:   totalValue,
    statusCounts: statusCounts
  };
}

// Get & mark notifications
function getNotifications(token) {
  var user = requireAuth(token);
  return dbSelect('notifications',
    'user_id=eq.' + user.id + '&order=created_at.desc&limit=50'
  ) || [];
}

function markNotificationRead(token, notificationId) {
  var user = requireAuth(token);
  return dbUpdate('notifications', 'id=eq.' + notificationId + '&user_id=eq.' + user.id, { is_read: true });
}

function markAllNotificationsRead(token) {
  var user = requireAuth(token);
  return dbUpdate('notifications', 'user_id=eq.' + user.id + '&is_read=eq.false', { is_read: true });
}
