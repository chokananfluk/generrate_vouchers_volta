// ============================================================
// Email.gs — Email notifications via GAS MailApp
// ============================================================

var ADMIN_EMAIL = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || 'admin@volta.com';
var APP_URL     = PropertiesService.getScriptProperties().getProperty('APP_URL')     || 'https://your-app-url.com';

function emailStyle_() {
  return '<style>' +
    'body{font-family:Arial,sans-serif;background:#f8f8f8;margin:0;padding:0}' +
    '.wrap{max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}' +
    '.hdr{background:linear-gradient(135deg,#B000D4,#7A2CFF);padding:32px 24px;text-align:center}' +
    '.hdr h1{color:#fff;margin:0;font-size:24px}' +
    '.hdr p{color:rgba(255,255,255,.85);margin:4px 0 0;font-size:13px}' +
    '.body{padding:28px 24px}' +
    '.body p{color:#444;line-height:1.6;margin:8px 0}' +
    '.info-box{background:#f4f0ff;border-left:4px solid #B000D4;border-radius:6px;padding:16px;margin:16px 0}' +
    '.info-box table{width:100%;border-collapse:collapse}' +
    '.info-box td{padding:4px 8px;color:#333;font-size:14px}' +
    '.info-box td:first-child{font-weight:600;color:#7E00A8;width:45%}' +
    '.btn{display:inline-block;background:linear-gradient(135deg,#B000D4,#7A2CFF);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:16px 0}' +
    '.ftr{background:#f4f0ff;padding:16px 24px;text-align:center;color:#888;font-size:12px}' +
    '</style>';
}

// Notify ALL active admins that a batch needs approval
// batch param (optional) — if passed, includes value/quantity/notes in email
function sendAdminApprovalEmail(batchId, user, batch) {
  try {
    // ดึง email ของ admin ทุกคนที่ active อยู่ในระบบ
    var adminRows   = dbSelect('users', 'role=eq.admin&is_active=eq.true&select=email');
    var adminEmails = (adminRows || []).map(function(a) { return a.email; }).join(',');
    if (!adminEmails) adminEmails = ADMIN_EMAIL; // fallback ถ้าหาไม่เจอ
    if (!adminEmails) return;

    var subject = '[Volta Voucher] คำขออนุมัติ Voucher จาก ' + user.firstName + ' ' + user.lastName;

    // รายละเอียด batch (ถ้ามี)
    var batchRows = batch ? null :
      (function(){ var r = dbSelect('voucher_batches','id=eq.'+batchId+'&select=value_thb,quantity,notes'); return r && r[0]; })();
    var b = batch || batchRows || {};
    var valueThb  = b.value_thb  || '-';
    var quantity  = b.quantity   || '-';
    var notes     = b.notes      || '-';
    var totalVal  = (b.value_thb && b.quantity) ? (parseFloat(b.value_thb) * parseInt(b.quantity)).toLocaleString() + ' บาท' : '-';

    var html = '<html><head>' + emailStyle_() + '</head><body>' +
      '<div class="wrap">' +
      '<div class="hdr"><h1>Volta Voucher</h1><p>ระบบออก Voucher เติมเงิน</p></div>' +
      '<div class="body">' +
      '<p>มีคำขอสร้าง Voucher รายการใหม่รอการอนุมัติ กรุณาตรวจสอบและดำเนินการ</p>' +
      '<div class="info-box"><table>' +
      '<tr><td>ผู้ขอ</td><td><strong>' + user.firstName + ' ' + user.lastName + '</strong> (' + user.email + ')</td></tr>' +
      '<tr><td>แผนก / กอง</td><td>' + (user.department || '-') + ' / ' + (user.division || '-') + '</td></tr>' +
      '<tr><td>มูลค่า/ใบ</td><td><strong>' + valueThb + ' บาท</strong></td></tr>' +
      '<tr><td>จำนวน</td><td><strong>' + quantity + ' ใบ</strong></td></tr>' +
      '<tr><td>มูลค่ารวม</td><td style="color:#B000D4;font-weight:700">' + totalVal + '</td></tr>' +
      '<tr><td>หมายเหตุ</td><td>' + notes + '</td></tr>' +
      '</table></div>' +
      '<div style="text-align:center"><a class="btn" href="' + getAppUrl() + '?page=admin-vouchers#' + batchId + '" style="display:inline-block;background:linear-gradient(135deg,#B000D4,#7A2CFF);color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:16px 0"><span style="color:#ffffff">ตรวจสอบและอนุมัติ</span></a></div>' +
      '</div>' +
      '<div class="ftr">อีเมลนี้ส่งจากระบบ Volta Voucher อัตโนมัติ</div>' +
      '</div></body></html>';

    MailApp.sendEmail({ to: adminEmails, subject: subject, htmlBody: html });
  } catch(e) {
    Logger.log('sendAdminApprovalEmail error: ' + e.message);
  }
}

// Notify user of approval or rejection
function sendUserApprovalEmail(user, batch, status, adminNotes) {
  try {
    var isApproved = status === 'approved';
    var subject = isApproved
      ? '[Volta Voucher] คำขอ Voucher ของคุณได้รับการอนุมัติ'
      : '[Volta Voucher] คำขอ Voucher ถูกตีกลับ';

    var statusTh = isApproved ? 'อนุมัติ ✓' : 'ตีกลับ ✗';
    var statusColor = isApproved ? '#00C853' : '#D50000';
    var bodyMsg = isApproved
      ? 'คำขอสร้าง Voucher ของคุณได้รับการอนุมัติแล้ว สามารถเข้าระบบเพื่อดูและดาวน์โหลด Voucher ได้'
      : 'คำขอสร้าง Voucher ของคุณถูกตีกลับ กรุณาแก้ไขข้อมูลและแนบใบเสร็จใหม่อีกครั้ง';

    var html = '<html><head>' + emailStyle_() + '</head><body>' +
      '<div class="wrap">' +
      '<div class="hdr"><h1>Volta Voucher</h1><p>ระบบออก Voucher เติมเงิน</p></div>' +
      '<div class="body">' +
      '<p>เรียน คุณ' + user.first_name + ' ' + user.last_name + '</p>' +
      '<p>' + bodyMsg + '</p>' +
      '<div class="info-box"><table>' +
      '<tr><td>สถานะ</td><td style="color:' + statusColor + ';font-weight:700">' + statusTh + '</td></tr>' +
      '<tr><td>มูลค่า/ใบ</td><td>' + batch.value_thb + ' บาท</td></tr>' +
      '<tr><td>จำนวน</td><td>' + batch.quantity + ' ใบ</td></tr>' +
      '<tr><td>มูลค่ารวม</td><td>' + (parseFloat(batch.value_thb) * parseInt(batch.quantity)).toLocaleString() + ' บาท</td></tr>' +
      (adminNotes ? '<tr><td>หมายเหตุ Admin</td><td>' + adminNotes + '</td></tr>' : '') +
      '</table></div>' +
      '<a class="btn" href="' + getAppUrl() + '?page=user-vouchers#' + batch.id + '" style="display:inline-block;background:linear-gradient(135deg,#B000D4,#7A2CFF);color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:16px 0"><span style="color:#ffffff">ดูรายละเอียด</span></a>' +
      '</div>' +
      '<div class="ftr">อีเมลนี้ส่งจากระบบ Volta Voucher อัตโนมัติ</div>' +
      '</div></body></html>';

    MailApp.sendEmail({ to: user.email, subject: subject, htmlBody: html });
  } catch(e) {
    Logger.log('sendUserApprovalEmail error: ' + e.message);
  }
}

// Send a password-reset link to a user
function sendPasswordResetEmail(user, resetUrl) {
  try {
    var subject = '[Volta Voucher] รีเซ็ตรหัสผ่านของคุณ';
    var name = (user.first_name || user.firstName || '') + ' ' + (user.last_name || user.lastName || '');

    var html = '<html><head>' + emailStyle_() + '</head><body>' +
      '<div class="wrap">' +
      '<div class="hdr"><h1>Volta Voucher</h1><p>ระบบออก Voucher เติมเงิน</p></div>' +
      '<div class="body">' +
      '<p>เรียน คุณ' + name + '</p>' +
      '<p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีนี้ คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่</p>' +
      '<div style="text-align:center"><a class="btn" href="' + resetUrl + '" style="display:inline-block;background:linear-gradient(135deg,#B000D4,#7A2CFF);color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:16px 0"><span style="color:#ffffff">ตั้งรหัสผ่านใหม่</span></a></div>' +
      '<p style="font-size:13px;color:#888">ลิงก์นี้จะหมดอายุภายใน 60 นาที หากปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:</p>' +
      '<p style="font-size:12px;color:#7E00A8;word-break:break-all">' + resetUrl + '</p>' +
      '<p style="font-size:13px;color:#888">หากคุณไม่ได้เป็นผู้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยต่ออีเมลนี้ รหัสผ่านเดิมจะยังคงใช้งานได้ตามปกติ</p>' +
      '</div>' +
      '<div class="ftr">อีเมลนี้ส่งจากระบบ Volta Voucher อัตโนมัติ</div>' +
      '</div></body></html>';

    MailApp.sendEmail({ to: user.email, subject: subject, htmlBody: html });
  } catch(e) {
    Logger.log('sendPasswordResetEmail error: ' + e.message);
  }
}
