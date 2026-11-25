/**
 * Websight swipe game → Google Sheet
 * Paste into the sheet: Extensions → Apps Script. Setup steps are in README.md.
 * One row per game session; the row updates as the player progresses.
 *
 * WhatsApp thank-you (UChat): when a game finishes and the player gave a phone number, a WhatsApp
 * template message is sent once per game. Set these in Project Settings → Script Properties:
 *   UCHAT_API_KEY      your UChat API key (never put it in this code)
 *   UCHAT_TEMPLATE     (optional) template name — default: nexus_pickchamp_thanks
 *   UCHAT_TEMPLATE_LANG  (optional) e.g. ar or en, if the template exists in several languages
 *   UCHAT_HEADER_IMAGE   (optional) header image URL; default: the PickChamp banner
 * Template variables: {{1}} = player's first name, {{2}} = their champion (or favourite project).
 * The result is written to the "WhatsApp" column. To test: run testWhatsApp() with your own number.
 */
const SHEET_NAME = 'Plays';
const HEADERS = ['Session', 'Started', 'Updated', 'Name', 'Phone', 'Email', 'Language', 'Modes',
  'Status', 'Champion', 'Ranking', 'Liked', 'Passed', 'Picks', 'Kiosk', 'Device', 'Score', 'Super liked', 'Badges', 'WhatsApp'];
const UCHAT = 'https://www.uchat.com.au/api';
const DEFAULT_TEMPLATE = 'nexus_pickchamp_thanks';
const DEFAULT_HEADER_IMAGE = 'https://pickchamp.websight.kw/og-image.jpg';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (!d.session) throw new Error('missing session');
    const sh = getSheet_();
    const now = new Date();
    const list = v => (Array.isArray(v) ? v : []).map(String);

    const row = [
      clean_(d.session, 40),
      d.started ? new Date(d.started) : now,
      now,
      clean_(d.name, 80),
      clean_(d.phone, 24),
      clean_(d.email, 120),
      clean_(d.lang, 4),
      list(d.modes).join(' + '),
      clean_(d.status, 20),
      clean_(d.champion, 80),
      clean_(list(d.ranking).join(' > '), 1000),
      clean_(list(d.liked).join(', '), 1000),
      clean_(list(d.passed).join(', '), 1000),
      clean_(list(d.picks).join('\n'), 3000),
      d.kiosk ? 'yes' : '',
      clean_(d.device, 140),
      Number(d.score) || 0,
      clean_(list(d.superliked).join(", "), 200),
      clean_(list(d.badges).join(", "), 200),
    ];

    const waCol = HEADERS.indexOf('WhatsApp') + 1;
    const last = sh.getLastRow();
    const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().flat() : [];
    const i = ids.indexOf(row[0]);
    let rowNum;
    if (i >= 0) {
      rowNum = i + 2;
      row[1] = sh.getRange(rowNum, 2).getValue() || row[1]; // keep original start time
      row.push(sh.getRange(rowNum, waCol).getValue());       // keep WhatsApp status
      sh.getRange(rowNum, 1, 1, row.length).setValues([row]);
    } else {
      row.push('');
      sh.appendRow(row);
      rowNum = sh.getLastRow();
    }
    // WhatsApp thank-you: once per game, after it finishes, only if a phone number was given
    if (d.status === 'finished' && d.phone && !String(row[row.length - 1]).startsWith('sent')) {
      lock.releaseLock();
      let result;
      try { result = 'sent ' + Utilities.formatDate(new Date(), 'Asia/Kuwait', 'yyyy-MM-dd HH:mm') + ' · ' + sendThanks_(d); }
      catch (err) { result = 'error: ' + String(err.message || err).slice(0, 180); }
      sh.getRange(rowNum, waCol).setValue(result);
    }
    if (d.status === 'finished') CacheService.getScriptCache().remove('board'); // leaderboard refreshes right away
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Project leaderboard (GET). Returns totals only — no player names or contacts ever leave the sheet.
 * Points: champion 10 · super like 5 · battle win 3 · like 2. Cached for 60 s.
 */
function doGet() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('board');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);

  const sh = getSheet_();
  const last = sh.getLastRow();
  const stats = {};
  let games = 0;
  const bump = (name, key) => {
    name = String(name || '').replace(/^'/, '').trim();
    if (!name) return;
    const s = stats[name] || (stats[name] = { name: name, champion: 0, superlike: 0, wins: 0, like: 0, battles: 0 });
    s[key]++;
  };
  if (last > 1) {
    const rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
    const col = h => HEADERS.indexOf(h);
    rows.forEach(r => {
      if (String(r[col('Status')]) === 'test' || /zz-test/i.test(String(r[col('Name')]))) return; // skip test rows
      games++;
      bump(r[col('Champion')], 'champion');
      String(r[col('Super liked')] || '').split(',').forEach(n => bump(n, 'superlike'));
      String(r[col('Liked')] || '').split(',').forEach(n => bump(n, 'like'));
      String(r[col('Picks')] || '').split('\n').forEach(line => {
        const m = line.match(/:\s*(.+?)\s+vs\s+(.+?)\s+→\s+(.+)$/);
        if (m) { bump(m[1], 'battles'); bump(m[2], 'battles'); bump(m[3], 'wins'); }
      });
    });
  }
  const projects = Object.keys(stats).map(k => {
    const s = stats[k];
    s.points = s.champion * 10 + s.superlike * 5 + s.wins * 3 + s.like * 2;
    return s;
  }).sort((a, b) => b.points - a.points);
  const out = JSON.stringify({ ok: true, games: games, updated: new Date().toISOString(), projects: projects });
  cache.put('board', out, 60);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  if (sh.getRange(1, HEADERS.length).getValue() !== HEADERS[HEADERS.length - 1]) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);   // older sheets: add new header cells
  }
  sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  return sh;
}

// Trim, cap length, and stop values like "=..." or "+965..." being read as formulas.
function clean_(v, max) {
  let s = v == null ? '' : String(v).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ===================== WhatsApp thank-you via UChat ===================== */

function uchat_(method, path, payload) {
  const key = PropertiesService.getScriptProperties().getProperty('UCHAT_API_KEY');
  if (!key) throw new Error('UCHAT_API_KEY is not set in Script Properties');
  const opts = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + key } };
  if (payload) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(payload); }
  const res = UrlFetchApp.fetch(UCHAT + path, opts);
  const code = res.getResponseCode(), text = res.getContentText();
  let json = {};
  try { json = JSON.parse(text); } catch (e) {}
  if (code >= 300) throw new Error('UChat ' + path + ' → ' + code + ' ' + (json.message || text).slice(0, 140));
  return json;
}

// "+965 5555 1234", "55551234", "0096555551234" → "+96555551234"
function normalizePhone_(raw) {
  let p = String(raw || '').replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (!p.startsWith('+') && p.length === 8) p = '+965' + p;
  if (!p.startsWith('+')) p = '+' + p;
  return p;
}

function findOrCreateSubscriber_(phone, name, email) {
  for (const q of [phone, phone.replace('+', '')]) {
    const found = uchat_('get', '/subscribers?limit=1&phone=' + encodeURIComponent(q));
    if (found.data && found.data.length && found.data[0].user_ns) return found.data[0].user_ns;
  }
  const body = { phone: phone, name: name, first_name: String(name || '').split(' ')[0] };
  if (email) body.email = email;
  const created = uchat_('post', '/subscriber/create', body);
  const ns = created.user_ns || (created.data && created.data.user_ns);
  if (!ns) throw new Error('UChat did not return a subscriber id');
  return ns;
}

// the template's namespace, language, number of {{n}} variables and header type (cached 6 h)
function templateInfo_() {
  const props = PropertiesService.getScriptProperties();
  const name = props.getProperty('UCHAT_TEMPLATE') || DEFAULT_TEMPLATE;
  const lang = props.getProperty('UCHAT_TEMPLATE_LANG') || '';
  const cache = CacheService.getScriptCache(), ck = 'tpl:' + name + ':' + lang;
  const hit = cache.get(ck);
  if (hit) return JSON.parse(hit);
  const list = uchat_('post', '/whatsapp-template/list?limit=100&name=' + encodeURIComponent(name));
  const all = (list.data || []).filter(t => t.name === name);
  const t = all.find(x => !lang || String(x.language).toLowerCase().startsWith(lang.toLowerCase())) || all[0];
  if (!t) throw new Error('Template "' + name + '" not found in UChat');
  const comps = t.components || [];
  const body = comps.find(c => String(c.type).toUpperCase() === 'BODY') || {};
  const header = comps.find(c => String(c.type).toUpperCase() === 'HEADER') || {};
  const vars = (String(body.text || '').match(/{{\s*(\d+)\s*}}/g) || []).map(v => +v.replace(/\D/g, ''));
  const info = { name: t.name, lang: t.language, namespace: t.namespace || '', vars: vars.length ? Math.max.apply(null, vars) : 0,
                 imageHeader: String(header.format || '').toUpperCase() === 'IMAGE' };
  cache.put(ck, JSON.stringify(info), 21600);
  return info;
}

function sendThanks_(d) {
  const phone = normalizePhone_(d.phone);
  if (phone.replace(/\D/g, '').length < 8) throw new Error('phone number too short: ' + d.phone);
  const first = String(d.name || '').trim().split(/\s+/)[0] || (d.lang === 'ar' ? 'صديقنا' : 'friend');
  const list = v => (Array.isArray(v) ? v : []).map(String);
  const champion = d.champion || list(d.superliked)[0] || list(d.liked)[0] || (d.lang === 'ar' ? 'كل التطبيقات 😄' : 'all of them 😄');
  const tpl = templateInfo_();
  const params = {};
  const values = [first, champion];
  for (let n = 1; n <= tpl.vars; n++) params['BODY_{{' + n + '}}'] = values[n - 1] || '-';
  if (tpl.imageHeader) params.HEADER_IMAGE = PropertiesService.getScriptProperties().getProperty('UCHAT_HEADER_IMAGE') || DEFAULT_HEADER_IMAGE;
  const userNs = findOrCreateSubscriber_(phone, d.name, d.email);
  uchat_('post', '/subscriber/send-whatsapp-template', {
    user_ns: userNs,
    content: { namespace: tpl.namespace, name: tpl.name, lang: tpl.lang, params: params },
  });
  return phone;
}

// Run this from the Apps Script editor (select testWhatsApp → Run) after changing the number to yours.
function testWhatsApp() {
  const result = sendThanks_({ name: 'Tony', phone: '+96500000000', champion: 'Riders', lang: 'ar' });
  Logger.log('WhatsApp sent to ' + result);
}
