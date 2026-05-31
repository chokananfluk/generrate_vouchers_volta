// ============================================================
// Database.gs — Supabase REST API client
// ============================================================

var SUPABASE_URL    = PropertiesService.getScriptProperties().getProperty('SUPABASE_URL');
var SUPABASE_KEY    = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY');
var SUPABASE_BUCKET = 'receipts';

function sbHeaders_() {
  return {
    'apikey':        SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation'
  };
}

// Generic REST call
function sbFetch_(method, path, body) {
  var options = {
    method:             method,
    headers:            sbHeaders_(),
    muteHttpExceptions: true
  };
  if (body) options.payload = JSON.stringify(body);

  var url = SUPABASE_URL + '/rest/v1/' + path;
  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  var text = res.getContentText();

  if (code >= 400) {
    throw new Error('Supabase error ' + code + ': ' + text);
  }
  try { return JSON.parse(text); } catch(e) { return text; }
}

// SELECT
function dbSelect(table, filters) {
  var q = table + '?';
  if (filters) q += filters;
  return sbFetch_('GET', q, null);
}

// INSERT
function dbInsert(table, data) {
  return sbFetch_('POST', table, data);
}

// UPDATE (match by eq filter string e.g. "id=eq.abc")
function dbUpdate(table, filter, data) {
  return sbFetch_('PATCH', table + '?' + filter, data);
}

// DELETE
function dbDelete(table, filter) {
  return sbFetch_('DELETE', table + '?' + filter, null);
}

// RPC (stored function)
function dbRpc(funcName, params) {
  var options = {
    method:             'POST',
    headers:            sbHeaders_(),
    payload:            JSON.stringify(params || {}),
    muteHttpExceptions: true
  };
  var res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/' + funcName, options);
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code >= 400) throw new Error('RPC error ' + code + ': ' + text);
  try { return JSON.parse(text); } catch(e) { return text; }
}

// Upload file to Google Drive, return shareable view URL
// (ใช้ Google Drive แทน Supabase Storage เพื่อหลีกเลี่ยงปัญหา RLS)
function dbUploadFile(fileBlob, filename, contentType) {
  // หาหรือสร้าง folder "volta-receipts" ใน Drive
  var folderName  = 'volta-receipts';
  var folderIter  = DriveApp.getFoldersByName(folderName);
  var driveFolder = folderIter.hasNext()
    ? folderIter.next()
    : DriveApp.createFolder(folderName);

  // อัปโหลดไฟล์
  var driveFile = driveFolder.createFile(fileBlob);
  driveFile.setName(filename);

  // ให้ "ทุกคนที่มี link" ดูได้
  driveFile.setSharing(
    DriveApp.Access.ANYONE_WITH_LINK,
    DriveApp.Permission.VIEW
  );

  // คืน link สำหรับดูไฟล์ (admin คลิกดูใบเสร็จได้)
  return 'https://drive.google.com/file/d/' + driveFile.getId() + '/view';
}
