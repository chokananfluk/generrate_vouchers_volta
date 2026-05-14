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

// Notify admin that a batch needs approval
function sendAdminApprovalEmail(batchId, user) {
  try {
    var subject = '[Volta Voucher] คำขออนุมัติ Voucher จาก ' + user.firstName + ' ' + user.lastName;
    var html = '<html><head>' + emailStyle_() + '</head><body>' +
      '<div class="wrap">' +
      '<div class="hdr"><h1>Volta Voucher</h1><p>ระบบออก Voucher เติมเงิน</p></div>' +
      '<div class="body">' +
      '<p>มีคำขอสร้าง Voucher รายการใหม่รอการอนุมัติ</p>' +
      '<div class="info-box"><table>' +
      '<tr><td>ผู้ขอ</td><td>' + user.firstName + ' ' + user.lastName + ' (' + user.email + ')</td></tr>' +
      '<tr><td>แผนก/กอง</td><td>' + (user.department || '-') + ' / ' + (user.division || '-') + '</td></tr>' +
      '<tr><td>รหัสคำขอ</td><td>' + batchId + '</td></tr>' +
      '</table></div>' +
      '<p>กรุณาเข้าสู่ระบบเพื่อตรวจสอบและอนุมัติคำขอ</p>' +
      '<a class="btn" href="' + APP_URL + '/admin/vouchers.html#' + batchId + '">ดูคำขอ</a>' +
      '</div>' +
      '<div class="ftr">อีเมลนี้ส่งจากระบบ Volta Voucher อัตโนมัติ</div>' +
      '</div></body></html>';

    MailApp.sendEmail({ to: ADMIN_EMAIL, subject: subject, htmlBody: html });
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
      '<a class="btn" href="' + APP_URL + '/user/vouchers.html#' + batch.id + '">ดูรายละเอียด</a>' +
      '</div>' +
      '<div class="ftr">อีเมลนี้ส่งจากระบบ Volta Voucher อัตโนมัติ</div>' +
      '</div></body></html>';

    MailApp.sendEmail({ to: user.email, subject: subject, htmlBody: html });
  } catch(e) {
    Logger.log('sendUserApprovalEmail error: ' + e.message);
  }
}
