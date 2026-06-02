// ============================================================
// Code.gs — Main GAS Web App entry point
// (page rendering + API router)
// ============================================================
// Deploy as: Execute as ME, Access: Anyone
// ============================================================

// ---- Page name (?page=) → HTML file name ----
var PAGE_FILES_ = {
  'login':           'login',
  'reset':           'reset',
  'admin-dashboard': 'admin_dashboard',
  'admin-vouchers':  'admin_vouchers',
  'admin-users':     'admin_users',
  'user-dashboard':  'user_dashboard',
  'user-vouchers':   'user_vouchers',
  'user-account':    'user_account',
  'help':            'help'
};

function doGet(e) {
  e = e || {};
  var p = e.parameter || {};

  // GET API actions (kept for backward-compat). Normal API uses POST.
  if (p.action) return handleRequest_(e, 'GET');

  // Otherwise serve an HTML page
  return servePage_(p.page || 'login', e);
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

// Render an HTML page by its ?page= name
function servePage_(page, e) {
  var file = PAGE_FILES_[page] || 'login';
  var t = HtmlService.createTemplateFromFile(file);
  // Token passed to the reset page via the email link (?page=reset&token=...)
  t.resetToken = (e && e.parameter && e.parameter.token) ? e.parameter.token : '';
  return t.evaluate()
    .setTitle('Volta Voucher')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Deployed web app URL (/exec) — used by client config + email links
function getAppUrl() {
  return ScriptApp.getService().getUrl();
}

// Include + evaluate an HTML partial (processes <?= ?> scriptlets)
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

// ============================================================
// API ROUTER
// ============================================================
function handleRequest_(e, method) {
  var action  = (e.parameter && e.parameter.action)  || '';
  var token   = (e.parameter && e.parameter.token)   || (e.postData && getBodyParam_(e, 'token')) || '';

  try {
    var body = {};
    if (method === 'POST' && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch(_) {}
    }
    // Also accept GET parameters
    if (e.parameter) Object.keys(e.parameter).forEach(function(k) { if (!body[k]) body[k] = e.parameter[k]; });

    // API calls send action+token in the JSON body (not URL params) — must read here
    action = action || body.action || '';
    token  = token  || body.token  || '';

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

    case 'adminSendPasswordReset':
      return adminSendPasswordReset(token, body.user_id);

    // ---- FORGOT / RESET PASSWORD (no auth) ----
    case 'forgotPassword':
      return forgotPassword(body.email);

    case 'resetPassword':
      return resetPassword(body.token, body.new_password);

    // ---- VOUCHER BATCHES ----
    case 'createBatch':
      return createBatch(token, body);

    case 'adminCreateVoucher':
      return adminCreateVoucher(token, body);

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
      // Return the raw CSV string; the client builds a downloadable file.
      return exportBatchCsv(token, body.batch_id);

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
