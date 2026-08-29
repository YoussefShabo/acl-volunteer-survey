const fs = require('node:fs');
const path = require('node:path');

const sheetId = process.env.GOOGLE_SHEET_ID;
const sheetTab = process.env.GOOGLE_SHEET_TAB || 'Responses';
let sheets;

function getCredentials() {
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      const value = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();
      if (value.startsWith('{')) return JSON.parse(value);
      if (fs.existsSync(path.resolve(value))) return JSON.parse(fs.readFileSync(path.resolve(value), 'utf8'));
    }
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    if (email && privateKey) return { client_email: email, private_key: privateKey.replace(/\\n/g, '\n') };
    const file = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || './service-account.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error('Invalid Google Sheets credentials:', error.message);
  }
  return null;
}
function isConfigured() {
  return Boolean(sheetId && getCredentials());
}
async function getSheets() {
  if (sheets) return sheets;
  const { google } = require('googleapis');
  const credentials = getCredentials();
  if (!sheetId || !credentials) throw new Error('Google Sheets environment variables are not configured.');
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.update({ spreadsheetId: sheetId, range: `${sheetTab}!A1:F1`, valueInputOption: 'RAW', requestBody: { values: [['ID', 'Name', 'Email', 'Selected shifts', 'Note', 'Submitted']] } });
  return sheets;
}
async function listResponses() {
  const client = await getSheets();
  const result = await client.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${sheetTab}!A2:F` });
  return (result.data.values || []).filter((row) => row[0]).map((row) => ({ id: row[0], name: row[1] || '', email: row[2] || '', shifts: row[3] ? row[3].split(';').map((shift) => shift.trim()) : [], note: row[4] || '', submittedAt: row[5] || '' }));
}
async function appendResponse(response) {
  const client = await getSheets();
  await client.spreadsheets.values.append({ spreadsheetId: sheetId, range: `${sheetTab}!A:F`, valueInputOption: 'USER_ENTERED', requestBody: { values: [[response.id, response.name, response.email, response.shifts.join('; '), response.note, response.submittedAt]] } });
}
module.exports = { appendResponse, isConfigured, listResponses };
