// ============================================================
// Code.gs — Main GAS Web App entry point (API router)
// ============================================================
// Deploy as: Execute as ME, Access: Anyone
// ============================================================

function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function handleRequest_(e, method) {
  // CORS — return options pre-flight
  var action  = (e.parameter && e.parameter.action)  || '';
  var token   = (e.parameter && e.parameter.token)   || (e.postData && getBodyParam_(e, 'token')) || '';

  try {
    var body = {};
    if (method === 'POST' && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch(_) {}
    }
    // Also accept GET parameters
    if (e.parameter) Object.keys(e.parameter).forEach(function(k) { if (!body[k]) body[k] = e.parameter[k]; });

    token = token || body.token || '';

    var result = route_(action, token, body, e);
    return successResponse(result);

  } catch(err) {
    Logger.log('Error [' + action + ']: ' + err.message + '\n' + err.stack);
    var code = 400;
    if (err.message === 'Unauthorized' || err.message === 'Session expired or invalid') code = 401;
    if (err.message === 'Admin access required')   code = 403;
    if (err.message === 'Batch not found')          code = 404;
    return errorResponse(err.message, code);
  }
}

function getBodyParam_(e, key) {
  try {
    var body = JSON.parse(e.postData.contents);
    return body[key] || '';
  } catch(_) { return ''; }
}

function route_(action, token, body, e) {
  switch(action) {

    // ---- AUTH ----
    case 'login':
      return login(body.email, body.password);

    case 'logout':
      logout(token);
      return { ok: true };

    case 'changePassword':
      return changePassword(token, body.old_password, body.new_password);

    case 'adminResetPassword':
      return adminResetPassword(token, body.user_id, body.new_password);

    // ---- VOUCHER BATCHES ----
    case 'createBatch':
      return createBatch(token, body);

    case 'attachReceipt':
      return attachReceipt(token, body.batch_id, body.receipt_url, body.receipt_filename);

    case 'cancelBatch':
      return cancelBatch(token, body.batch_id);

    case 'approveBatch':
      return approveBatch(token, body.batch_id, body.admin_notes);

    case 'rejectBatch':
      return rejectBatch(token, body.batch_id, body.admin_notes);

    case 'getUserBatches':
      return getUserBatches(token, body);

    case 'getAllBatches':
      return getAllBatches(token, body);

    case 'getBatchDetail':
      return getBatchDetail(token, body.batch_id);

    case 'getBatchCodes':
      return getBatchCodes(token, body.batch_id);

    case 'exportBatchCsv':
      var csv = exportBatchCsv(token, body.batch_id);
      return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);

    // ---- ADMIN USER MANAGEMENT ----
    case 'listUsers':
      return listUsers(token, body);

    case 'createUser':
      return createUser(token, body);

    case 'updateUser':
      return updateUser(token, body.user_id || body.id, body);

    case 'deactivateUser':
      return deactivateUser(token, body.user_id);

    case 'activateUser':
      return activateUser(token, body.user_id);

    // ---- STATS ----
    case 'getAdminStats':
      return getAdminStats(token);

    case 'getUserStats':
      return getUserStats(token);

    // ---- NOTIFICATIONS ----
    case 'getNotifications':
      return getNotifications(token);

    case 'markNotificationRead':
      return markNotificationRead(token, body.notification_id);

    case 'markAllNotificationsRead':
      return markAllNotificationsRead(token);

    // ---- UPLOAD RECEIPT (base64) ----
    case 'uploadReceipt':
      var b64    = body.file_data;
      var fname  = body.filename || ('receipt_' + Date.now() + '.pdf');
      var ctype  = body.content_type || 'application/pdf';
      var blob   = Utilities.newBlob(Utilities.base64Decode(b64), ctype, fname);
      var url    = dbUploadFile(blob, fname, ctype);
      return { url: url, filename: fname };

    default:
      throw new Error('Unknown action: ' + action);
  }
}

// ---- Setup helper (run once manually) ----
function setupAdminUser() {
  var props = PropertiesService.getScriptProperties();
  Logger.log('SUPABASE_URL: ' + props.getProperty('SUPABASE_URL'));

  var hash = hashPassword('Admin@1234');
  var result = dbInsert('users', {
    email:         'admin@volta.com',
    password_hash: hash,
    first_name:    'Admin',
    last_name:     'Volta',
    role:          'admin',
    is_active:     true
  });
  Logger.log('Admin created: ' + JSON.stringify(result));
}
