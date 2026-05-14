// ============================================================
// api.js — GAS API wrapper + Supabase Storage upload
// ============================================================

const API = {

  // Call GAS endpoint
  async call(action, body = {}) {
    const session = Auth.getSession();
    const payload = { action, ...body };
    if (session) payload.token = session.token;

    const res = await fetch(CONFIG.GAS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) {
      if (data.code === 401) {
        Auth.clearSession();
        window.location.href = rootPath() + 'index.html';
        return;
      }
      throw new Error(data.error || 'Unknown error');
    }
    return data.data;
  },

  // Auth
  login:  (email, pw)     => API.call('login',  { email, password: pw }),
  logout: ()              => API.call('logout'),

  // Vouchers
  createBatch:    (p)     => API.call('createBatch',   p),
  attachReceipt:  (p)     => API.call('attachReceipt', p),
  cancelBatch:    (id)    => API.call('cancelBatch',   { batch_id: id }),
  getUserBatches: (f)     => API.call('getUserBatches', f || {}),
  getBatchDetail: (id)    => API.call('getBatchDetail', { batch_id: id }),
  getBatchCodes:  (id)    => API.call('getBatchCodes',  { batch_id: id }),

  // Admin vouchers
  getAllBatches:  (f)      => API.call('getAllBatches',  f || {}),
  approveBatch:  (id, n)  => API.call('approveBatch',  { batch_id: id, admin_notes: n }),
  rejectBatch:   (id, n)  => API.call('rejectBatch',   { batch_id: id, admin_notes: n }),

  // Users
  listUsers:       (f)    => API.call('listUsers',        f || {}),
  createUser:      (p)    => API.call('createUser',       p),
  updateUser:      (id,p) => API.call('updateUser',       { user_id: id, ...p }),
  deactivateUser:  (id)   => API.call('deactivateUser',   { user_id: id }),
  activateUser:    (id)   => API.call('activateUser',     { user_id: id }),

  // Stats
  getAdminStats:  ()      => API.call('getAdminStats'),
  getUserStats:   ()      => API.call('getUserStats'),

  // Notifications
  getNotifications:        ()   => API.call('getNotifications'),
  markNotificationRead:    (id) => API.call('markNotificationRead',   { notification_id: id }),
  markAllNotificationsRead:()   => API.call('markAllNotificationsRead'),

  // Password
  changePassword:      (old, nw) => API.call('changePassword',      { old_password: old, new_password: nw }),
  adminResetPassword:  (uid, nw) => API.call('adminResetPassword',   { user_id: uid, new_password: nw }),

  // Upload receipt file → Supabase Storage, return URL
  async uploadReceipt(file, batchId) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const b64 = e.target.result.split(',')[1];
          const ext = file.name.split('.').pop();
          const filename = `receipt_${batchId}_${Date.now()}.${ext}`;
          const result = await API.call('uploadReceipt', {
            file_data:    b64,
            filename:     filename,
            content_type: file.type
          });
          resolve(result);
        } catch(err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Download CSV
  async downloadCsv(batchId) {
    const session = Auth.getSession();
    const url = CONFIG.GAS_URL + '?action=exportBatchCsv&batch_id=' + batchId + '&token=' + session.token;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vouchers_' + batchId + '.csv';
    a.click();
  }
};

function rootPath() {
  const p = window.location.pathname;
  if (p.includes('/user/') || p.includes('/admin/')) return '../';
  return '';
}
