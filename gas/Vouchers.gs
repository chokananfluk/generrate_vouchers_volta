// ============================================================
// Vouchers.gs — Voucher batch & code operations
// ============================================================

// Create a new voucher batch request
function createBatch(token, params) {
  var user = requireAuth(token);

  var valueThb    = parseFloat(params.value_thb);
  var quantity    = parseInt(params.quantity);
  var startDate   = params.start_date   || null;
  var expireDate  = params.expire_date  || null;
  var durationDays = parseInt(params.duration_days) || 0;
  var notes       = params.notes        || '';

  if (!valueThb || valueThb <= 0) throw new Error('Invalid value_thb');
  if (!quantity  || quantity  <= 0) throw new Error('Invalid quantity');

  var valueChar = getValueChar(valueThb);
  var lotNumber = getNextLot(valueChar);

  var batch = dbInsert('voucher_batches', {
    user_id:       user.id,
    value_thb:     valueThb,
    quantity:      quantity,
    start_date:    startDate,
    expire_date:   expireDate,
    duration_days: durationDays,
    notes:         notes,
    status:        'pending_receipt',
    lot_number:    lotNumber,
    value_char:    valueChar
  });

  return Array.isArray(batch) ? batch[0] : batch;
}

// Attach receipt to a batch (move to pending_approval)
function attachReceipt(token, batchId, receiptUrl, receiptFilename) {
  var user = requireAuth(token);
  var batch = getBatchOrThrow_(batchId, user.id);

  if (batch.status !== 'pending_receipt' && batch.status !== 'rejected') {
    throw new Error('Cannot attach receipt in current status: ' + batch.status);
  }

  var updated = dbUpdate('voucher_batches', 'id=eq.' + batchId, {
    receipt_url:      receiptUrl,
    receipt_filename: receiptFilename,
    status:           'pending_approval'
  });

  // Notify admins by email
  sendAdminApprovalEmail(batchId, user);

  return Array.isArray(updated) ? updated[0] : updated;
}

// Cancel a batch (only when pending_receipt or pending_approval)
function cancelBatch(token, batchId) {
  var user = requireAuth(token);
  var batch = getBatchOrThrow_(batchId, user.id);

  if (batch.status !== 'pending_receipt' && batch.status !== 'pending_approval') {
    throw new Error('Cannot cancel in current status: ' + batch.status);
  }

  var updated = dbUpdate('voucher_batches', 'id=eq.' + batchId, { status: 'cancelled' });
  return Array.isArray(updated) ? updated[0] : updated;
}

// Admin: approve batch — generates codes
function approveBatch(adminToken, batchId, adminNotes) {
  var admin = requireAdmin(adminToken);
  var rows = dbSelect('voucher_batches', 'id=eq.' + batchId);
  if (!rows || rows.length === 0) throw new Error('Batch not found');
  var batch = rows[0];

  if (batch.status !== 'pending_approval') {
    throw new Error('Batch is not in pending_approval status');
  }

  // Generate unique codes
  var codes = generateUniqueCodes(batch.value_char, batch.lot_number, batch.quantity);
  var codeRows = codes.map(function(code) {
    return {
      batch_id:      batchId,
      code:          code,
      value_thb:     batch.value_thb,
      expire_date:   batch.expire_date,
      duration_days: batch.duration_days
    };
  });

  // Insert codes in chunks of 500
  var chunkSize = 500;
  for (var i = 0; i < codeRows.length; i += chunkSize) {
    dbInsert('voucher_codes', codeRows.slice(i, i + chunkSize));
  }

  // Update batch status
  dbUpdate('voucher_batches', 'id=eq.' + batchId, {
    status:      'approved',
    admin_notes: adminNotes || '',
    approved_at: new Date().toISOString(),
    approved_by: admin.id
  });

  // Notify user
  var userRows = dbSelect('users', 'id=eq.' + batch.user_id);
  if (userRows && userRows.length > 0) {
    var batchUser = userRows[0];
    sendUserApprovalEmail(batchUser, batch, 'approved');
    dbInsert('notifications', {
      user_id:  batch.user_id,
      batch_id: batchId,
      title:    'คำขอ Voucher ได้รับการอนุมัติ',
      message:  'คำขอสร้าง Voucher จำนวน ' + batch.quantity + ' ใบ มูลค่า ' + batch.value_thb + ' บาท ได้รับการอนุมัติแล้ว',
      type:     'success'
    });
  }

  return { approved: true, codesGenerated: codes.length };
}

// Admin: reject batch
function rejectBatch(adminToken, batchId, adminNotes) {
  var admin = requireAdmin(adminToken);
  var rows = dbSelect('voucher_batches', 'id=eq.' + batchId);
  if (!rows || rows.length === 0) throw new Error('Batch not found');
  var batch = rows[0];

  if (batch.status !== 'pending_approval') {
    throw new Error('Batch is not in pending_approval status');
  }

  dbUpdate('voucher_batches', 'id=eq.' + batchId, {
    status:      'rejected',
    admin_notes: adminNotes || ''
  });

  // Notify user
  var userRows = dbSelect('users', 'id=eq.' + batch.user_id);
  if (userRows && userRows.length > 0) {
    var batchUser = userRows[0];
    sendUserApprovalEmail(batchUser, batch, 'rejected', adminNotes);
    dbInsert('notifications', {
      user_id:  batch.user_id,
      batch_id: batchId,
      title:    'คำขอ Voucher ถูกตีกลับ',
      message:  'คำขอสร้าง Voucher ถูกตีกลับ' + (adminNotes ? ': ' + adminNotes : ' กรุณาแนบใบเสร็จใหม่'),
      type:     'warning'
    });
  }

  return { rejected: true };
}

// Get batches for a user
function getUserBatches(token, filters) {
  var user = requireAuth(token);
  var q = 'voucher_batches?user_id=eq.' + user.id + '&order=created_at.desc';
  if (filters && filters.status) q += '&status=eq.' + filters.status;
  return dbSelect('voucher_batches', q.replace('voucher_batches?', ''));
}

// Get all batches (admin) — แยก user query เพื่อหลีกเลี่ยง PostgREST join issue
function getAllBatches(adminToken, filters) {
  requireAdmin(adminToken);
  var q = 'order=created_at.desc';
  if (filters && filters.status) q += '&status=eq.' + filters.status;

  var batches = dbSelect('voucher_batches', q);
  if (!Array.isArray(batches) || batches.length === 0) return [];

  // รวบรวม unique user_ids
  var userIds = [];
  batches.forEach(function(b) {
    if (b.user_id && userIds.indexOf(b.user_id) === -1) userIds.push(b.user_id);
  });

  // ดึง user info ครั้งเดียว
  var usersMap = {};
  if (userIds.length > 0) {
    var uRows = dbSelect('users',
      'id=in.(' + userIds.join(',') + ')' +
      '&select=id,first_name,last_name,email,department'
    );
    if (Array.isArray(uRows)) {
      uRows.forEach(function(u) { usersMap[u.id] = u; });
    }
  }

  // ฝัง user object เข้า batch แต่ละอัน
  batches.forEach(function(b) {
    b.users = b.user_id ? (usersMap[b.user_id] || null) : null;
  });

  return batches;
}

// Get codes for a batch
function getBatchCodes(token, batchId) {
  var user = requireAuth(token);
  var rows = dbSelect('voucher_batches', 'id=eq.' + batchId + '&select=id,user_id,status');
  if (!rows || rows.length === 0) throw new Error('Batch not found');
  var batch = rows[0];

  // Allow owner or admin
  if (batch.user_id !== user.id && user.role !== 'admin') throw new Error('Access denied');
  if (batch.status !== 'approved') throw new Error('Batch not approved yet');

  return dbSelect('voucher_codes', 'batch_id=eq.' + batchId + '&order=created_at.asc');
}

// Export codes as CSV string
function exportBatchCsv(token, batchId) {
  var codes = getBatchCodes(token, batchId);
  var lines = ['code,value_thb,expire_date,Duration'];
  codes.forEach(function(c) {
    lines.push([c.code, c.value_thb, c.expire_date || '', c.duration_days || 0].join(','));
  });
  return lines.join('\n');
}

// Helper: get batch and verify ownership
function getBatchOrThrow_(batchId, userId) {
  if (!batchId) throw new Error('Batch ID required');
  var rows = dbSelect('voucher_batches', 'id=eq.' + batchId);
  if (!rows || !Array.isArray(rows) || rows.length === 0) throw new Error('Batch not found');
  var batch = rows[0];
  if (!batch || !batch.id) throw new Error('Batch not found');
  if (batch.user_id !== userId) throw new Error('Access denied');
  return batch;
}

// Get single batch detail
function getBatchDetail(token, batchId) {
  var user = requireAuth(token);
  if (!batchId) throw new Error('Batch ID required');

  // Query without JOIN เพื่อหลีกเลี่ยง PostgREST join format issue
  var rows = dbSelect('voucher_batches', 'id=eq.' + batchId);
  if (!rows || !Array.isArray(rows) || rows.length === 0) throw new Error('Batch not found');
  var batch = rows[0];
  if (!batch || !batch.id) throw new Error('Batch not found');
  if (batch.user_id !== user.id && user.role !== 'admin') throw new Error('Access denied');

  // ดึง user info แยกต่างหาก (ปลอดภัยกว่า JOIN)
  if (batch.user_id) {
    var uRows = dbSelect('users',
      'id=eq.' + batch.user_id + '&select=first_name,last_name,email'
    );
    batch.users = (uRows && Array.isArray(uRows) && uRows.length > 0) ? uRows[0] : null;
  }

  return batch;
}
