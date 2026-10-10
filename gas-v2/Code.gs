/**
 * 1122 從神韻看見自律之美 — GAS v2（獨立部署版）
 * 狀態：程式碼範本，未部署。請勿覆蓋舊版在用的 GAS。
 * 建議建立「新的」Apps Script 專案，授權 Google Sheet 後部署 Web App。
 *
 * 安全原則：
 *  - doPost: 寫入 visit / track / register（報名個資不得放在 URL）。
 *  - doGet: 只接受 ping / checkRegistration，且不回傳姓名與電話。
 *  - 前端以 application/x-www-form-urlencoded + mode:no-cors 傳 POST；
 *    再用不可猜測的 clientRecordId 透過 JSONP 確認報名是否成功。
 */

const CAMP1122 = Object.freeze({
  SPREADSHEET_ID: '18wCkJwb4QMUevo8_Ko1NXhjGXNHEuWkTPhK7Gv0d0Aw',
  SIGNUP: '1122親子自律活動報名',
  LEGACY_VISITS: '1122活動進站紀錄',
  EVENTS: '流量紀錄',
  ANALYTICS: '流量分析',
  TIMEZONE: 'Asia/Taipei',
  EVENT_NAMES: ['page_view', 'registration_click', 'form_start', 'registration_success'],
  EVENT_HEADERS: [
    'event_time', 'event_name', 'visitor_id', 'session_id',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
    'utm_term', 'fbclid', 'page_url', 'referrer',
    'device', 'user_agent', 'record_id', 'clientRecordId', 'adSource'
  ],
  REGISTRATION_EXTRA_HEADERS: [
    'clientRecordId', 'visitor_id', 'session_id',
    'utm_source', 'utm_medium', 'utm_campaign',
    'utm_content', 'utm_term', 'fbclid'
  ]
});

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  let result;
  try {
    const action = String(p.action || 'ping');
    if (action === 'ping') {
      result = {ok:true, version:'1122-gas-v2', readOnly:true};
    } else if (action === 'checkRegistration') {
      result = checkRegistration1122_(p);
    } else {
      result = {ok:false, message:'此操作只接受 POST'};
    }
  } catch (err) {
    result = {ok:false, message:'查詢失敗'};
  }
  return respond1122_(result, p.callback);
}

function doPost(e) {
  const p = e && e.parameter ? e.parameter : {};
  let result;
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    const action = String(p.action || '');
    if (['visit', 'track', 'register'].indexOf(action) < 0) {
      throw new Error('不支援的操作');
    }
    locked = lock.tryLock(15000);
    if (!locked) throw new Error('系統忙碌，請稍後確認');
    const ss = SpreadsheetApp.openById(CAMP1122.SPREADSHEET_ID);
    if (action === 'visit') {
      result = visit1122_(ss, p);
    } else if (action === 'track') {
      result = track1122_(ss, p);
    } else {
      result = register1122_(ss, p);
    }
    SpreadsheetApp.flush();
  } catch (err) {
    result = {ok:false, message:err && err.message ? err.message : '伺服器處理失敗'};
  } finally {
    if (locked) lock.releaseLock();
  }
  // POST 回應不得再透過 JSONP 執行，瀏覽器使用匿名編號查詢寫入結果。
  return respond1122_(result, '');
}

function respond1122_(payload, callback) {
  const content = JSON.stringify(payload);
  const cb = String(callback || '');
  if (cb && /^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + content + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(content)
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet1122_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('找不到工作表：' + name);
  return sheet;
}

function trim1122_(value, length) {
  return String(value == null ? '' : value).trim().slice(0, length || 200);
}

function validToken1122_(value) {
  return /^[A-Za-z0-9_-]{12,128}$/.test(String(value || ''));
}

function normalizePhone1122_(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.indexOf('886') === 0) digits = '0' + digits.slice(3);
  if (/^9\d{8}$/.test(digits)) digits = '0' + digits;
  return digits;
}

function checkRegistration1122_(p) {
  const token = trim1122_(p.clientRecordId, 128);
  if (!validToken1122_(token)) return {ok:false, found:false};
  const ss = SpreadsheetApp.openById(CAMP1122.SPREADSHEET_ID);
  const sheet = sheet1122_(ss, CAMP1122.SIGNUP);
  const last = sheet.getLastRow();
  if (last < 2) return {ok:true,found:false};
  const ids = sheet.getRange(2, 14, last - 1, 1).getDisplayValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (ids[i][0] === token) {
      const recordId = sheet.getRange(i + 2, 2).getDisplayValue();
      return {ok:true,found:true,registered:true,record_id:recordId};
    }
  }
  const alias = PropertiesService.getScriptProperties().getProperty('camp1122_alias_' + token);
  if (alias) return {ok:true,found:true,registered:true,duplicate:true,record_id:alias};
  return {ok:true,found:false};
}

function event1122_(ss, p, eventName, recordId) {
  if (CAMP1122.EVENT_NAMES.indexOf(eventName) === -1) {
    throw new Error('不支援的追蹤事件');
  }
  const events = sheet1122_(ss, CAMP1122.EVENTS);
  if (events.getRange(1, 1).getValue() !== 'event_time') {
    throw new Error('流量紀錄標題列不正確');
  }
  const visitorId = trim1122_(p.visitor_id, 128);
  const sessionId = trim1122_(p.session_id, 128);
  if (!validToken1122_(visitorId) || !validToken1122_(sessionId)) {
    // 舊版網站的 visit 沒有 visitor/session 時允許只寫舊版進站表。
    throw new Error('缺少匿名識別碼');
  }
  const row = [
    new Date(), eventName, visitorId, sessionId,
    trim1122_(p.utm_source, 150),
    trim1122_(p.utm_medium, 150),
    trim1122_(p.utm_campaign, 150),
    trim1122_(p.utm_content, 150),
    trim1122_(p.utm_term, 150),
    trim1122_(p.fbclid, 250),
    trim1122_(p.pageUrl || p.page_url, 1000),
    trim1122_(p.referrer, 1000),
    trim1122_(p.device, 30),
    trim1122_(p.userAgent || p.user_agent, 800),
    trim1122_(recordId || p.record_id, 100),
    trim1122_(p.clientRecordId, 128),
    trim1122_(p.adSource, 150)
  ];
  events.appendRow(row);
  refreshAnalytics1122_(ss);
}

function track1122_(ss, p) {
  const name = trim1122_(p.event_name, 50);
  if (name === 'registration_success') {
    // 此事件由 register 寫入，不允許訪客自行宣稱報名成功。
    return {ok:true,serverOwned:true};
  }
  event1122_(ss, p, name, '');
  return {ok:true};
}

function visit1122_(ss, p) {
  const oldSheet = ss.getSheetByName(CAMP1122.LEGACY_VISITS);
  if (oldSheet) {
    oldSheet.appendRow([
      new Date(), trim1122_(p.adSource, 150),
      trim1122_(p.pageUrl, 1000),
      trim1122_(p.referrer, 1000),
      trim1122_(p.userAgent, 800),
      trim1122_(p.screenSize, 50)
    ]);
  }
  if (validToken1122_(p.visitor_id) && validToken1122_(p.session_id)) {
    event1122_(ss, p, 'page_view', '');
  }
  return {ok:true};
}

function nextRecordId1122_(sheet) {
  const prefix = 'CAMP-' + Utilities.formatDate(new Date(), CAMP1122.TIMEZONE, 'yyyyMMdd') + '-';
  const last = sheet.getLastRow();
  let max = 0;
  if (last > 1) {
    const ids = sheet.getRange(2, 2, last - 1, 1).getDisplayValues();
    for (const item of ids) {
      const value = String(item[0] || '');
      if (value.indexOf(prefix) === 0) {
        const n = Number(value.slice(prefix.length));
        if (Number.isInteger(n) && n > max) max = n;
      }
    }
  }
  return prefix + String(max + 1).padStart(3, '0');
}

function register1122_(ss, p) {
  const sheet = sheet1122_(ss, CAMP1122.SIGNUP);
  if (sheet.getRange(1, 1).getValue() !== '報名時間' ||
      sheet.getRange(1, 2).getValue() !== '報名編號') {
    throw new Error('報名資料表結構不符合預期');
  }

  const clientRecordId = trim1122_(p.clientRecordId, 128);
  if (!validToken1122_(clientRecordId)) throw new Error('缺少有效的報名識別碼');
  const parentName = trim1122_(p.parentName, 100);
  const phone = normalizePhone1122_(p.phone);
  const childName = trim1122_(p.childName, 100);
  const grade = trim1122_(p.grade, 30);
  const school = trim1122_(p.school, 150);
  const photoConsent = trim1122_(p.photoConsent, 200);
  const note = trim1122_(p.note, 1000);

  if (!parentName || !childName || !school || !photoConsent) throw new Error('必填資料未完整');
  if (!/^09\d{8}$/.test(phone)) throw new Error('手機格式錯誤');
  if (['國小三年級', '國小四年級', '國小五年級', '國小六年級'].indexOf(grade) < 0) {
    throw new Error('本活動僅接受國小三至六年級');
  }
  // 維持既有 A:M 欄位；在 N:V 擴充，不更動歷史報名資料。
  const oldRow = sheet.getLastRow();
  const records = oldRow > 1 ? sheet.getRange(2, 1, oldRow - 1, 14).getDisplayValues() : [];
  for (const row of records) {
    const storedToken = row[13] || '';
    if (storedToken && storedToken === clientRecordId) {
      return {ok:true,duplicate:true,record_id:row[1],message:'已報名成功'};
    }
    // 同一手機 + 同一孩子無法重複報名，其他孩子仍可個別報名。
    const canceled = /取消/.test(row[2] || '');
    if (!canceled &&
        normalizePhone1122_(row[4]) === phone &&
        (row[5] || '').trim() === childName) {
      // 此次請求對應到舊報名編號，讓 POST 之後的 read-only 查詢仍能確認結果。
      PropertiesService.getScriptProperties().setProperty('camp1122_alias_' + clientRecordId, String(row[1]));
      return {ok:true,duplicate:true,record_id:row[1],message:'此孩子已報名'};
    }
  }

  const recordId = nextRecordId1122_(sheet);
  const extra = CAMP1122.REGISTRATION_EXTRA_HEADERS;
  const existing = sheet.getRange(1, 14, 1, extra.length).getValues()[0];
  if (existing.every(function(value){return !value;})) {
    sheet.getRange(1, 14, 1, extra.length).setValues([extra]);
  } else if (extra.some(function(header,i){return existing[i] !== header;})) {
    throw new Error('報名擴充欄位有衝突，已停止寫入');
  }
  const newRow = sheet.getLastRow() + 1;
  sheet.getRange(newRow, 5).setNumberFormat('@');
  sheet.getRange(newRow, 1, 1, 22).setValues([[
    new Date(), recordId, '已報名', parentName, phone,
    childName, grade, school, photoConsent, note,
    trim1122_(p.adSource, 150), trim1122_(p.pageUrl, 1000), '',
    clientRecordId, trim1122_(p.visitor_id, 128), trim1122_(p.session_id, 128),
    trim1122_(p.utm_source, 150), trim1122_(p.utm_medium, 150),
    trim1122_(p.utm_campaign, 150), trim1122_(p.utm_content, 150),
    trim1122_(p.utm_term, 150), trim1122_(p.fbclid, 250)
  ]]);

  if (validToken1122_(p.visitor_id) && validToken1122_(p.session_id)) {
    event1122_(ss, p, 'registration_success', recordId);
  }
  return {ok:true,record_id:recordId,message:'報名成功！我們已收到您的資料。'};
}

function refreshAnalytics1122_(ss) {
  const sheet = sheet1122_(ss, CAMP1122.EVENTS);
  const stats = sheet1122_(ss, CAMP1122.ANALYTICS);
  const last = sheet.getLastRow();
  const rows = last > 1 ? sheet.getRange(2, 2, last - 1, 3).getDisplayValues() : [];
  const all = {
    page_view:new Set(),
    registration_click:new Set(),
    form_start:new Set(),
    registration_success:new Set()
  };
  for (const row of rows) {
    const eventName = row[0], sessionId = row[2];
    if (sessionId && all[eventName]) all[eventName].add(sessionId);
  }
  const pages = all.page_view;
  const stages = CAMP1122.EVENT_NAMES.map(function(name){
    if (name === 'page_view') return pages.size;
    return Array.from(all[name]).filter(function(id){return pages.has(id);}).length;
  });
  // 明確使用伺服器統計結果，完全避免未進站卻計入轉換造成 200%。
  stats.getRange(2, 2, 4, 1).setValues(stages.map(function(n){return [n];}));
}

/**
 * 部署前可從 Apps Script 編輯器手動執行；
 * 只檢查工作表和標題，不會新增報名資料。
 */
function verify1122Setup() {
  const ss = SpreadsheetApp.openById(CAMP1122.SPREADSHEET_ID);
  const signup = sheet1122_(ss, CAMP1122.SIGNUP);
  const visits = sheet1122_(ss, CAMP1122.LEGACY_VISITS);
  const events = sheet1122_(ss, CAMP1122.EVENTS);
  const analytics = sheet1122_(ss, CAMP1122.ANALYTICS);
  const result = {
    ok: signup.getRange('A1').getValue() === '報名時間' &&
        events.getRange('A1').getValue() === 'event_time',
    signup:signup.getName(), legacyVisits:visits.getName(),
    events:events.getName(), analytics:analytics.getName()
  };
  Logger.log(JSON.stringify(result));
  return result;
}
