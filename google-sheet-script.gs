/**
 * Websight swipe game → Google Sheet
 * Paste into the sheet: Extensions → Apps Script. Setup steps are in README.md.
 * One row per game session; the row updates as the player progresses.
 */
const SHEET_NAME = 'Plays';
const HEADERS = ['Session', 'Started', 'Updated', 'Name', 'Phone', 'Email', 'Language', 'Modes',
  'Status', 'Champion', 'Ranking', 'Liked', 'Passed', 'Picks', 'Kiosk', 'Device', 'Score', 'Super liked', 'Badges'];

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

    const last = sh.getLastRow();
    const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().flat() : [];
    const i = ids.indexOf(row[0]);
    if (i >= 0) {
      row[1] = sh.getRange(i + 2, 2).getValue() || row[1]; // keep original start time
      sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
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
