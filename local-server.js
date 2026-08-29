const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { google } = require('googleapis');

loadEnvFile();
const port = Number(process.env.PORT || 4173);
const sheetId = process.env.GOOGLE_SHEET_ID;
const sheetTab = process.env.GOOGLE_SHEET_TAB || 'Responses';
const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || './service-account.json';
const serviceAccountFile = path.resolve(serviceAccountPath);
const headers = ['ID', 'Name', 'Email', 'Selected shifts', 'Note', 'Submitted'];
let sheets;

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  });
}

function isConfigured() {
  return Boolean(sheetId && fs.existsSync(serviceAccountFile));
}
async function getSheets() {
  if (sheets) return sheets;
  const credentials = JSON.parse(fs.readFileSync(serviceAccountFile, 'utf8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  sheets = google.sheets({ version: 'v4', auth });
  await ensureHeader();
  return sheets;
}
async function ensureHeader() {
  await sheets.spreadsheets.values.update({ spreadsheetId: sheetId, range: `${sheetTab}!A1:F1`, valueInputOption: 'RAW', requestBody: { values: [headers] } });
}
async function readResponses() {
  const client = await getSheets();
  const result = await client.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${sheetTab}!A2:F` });
  return (result.data.values || []).filter((row) => row[0]).map((row) => ({ id: row[0], name: row[1] || '', email: row[2] || '', shifts: row[3] ? row[3].split(';').map((shift) => shift.trim()) : [], note: row[4] || '', submittedAt: row[5] || '' }));
}
async function addResponse(response) {
  const client = await getSheets();
  await client.spreadsheets.values.append({ spreadsheetId: sheetId, range: `${sheetTab}!A:F`, valueInputOption: 'USER_ENTERED', requestBody: { values: [[response.id, response.name, response.email, response.shifts.join('; '), response.note, response.submittedAt]] } });
}
function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}
function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; if (body.length > 100000) reject(new Error('Request too large')); });
    request.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); } });
    request.on('error', reject);
  });
}
const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }); response.end(); return; }
  if (request.url === '/api/health') { sendJson(response, 200, { configured: isConfigured() }); return; }
  if (request.url === '/api/responses' && request.method === 'GET') {
    if (!isConfigured()) { sendJson(response, 503, { error: 'Google Sheets is not configured.' }); return; }
    try { sendJson(response, 200, { responses: await readResponses() }); } catch (error) { console.error(error); sendJson(response, 500, { error: 'Could not read Google Sheet.' }); }
    return;
  }
  if (request.url === '/api/responses' && request.method === 'POST') {
    if (!isConfigured()) { sendJson(response, 503, { error: 'Google Sheets is not configured.' }); return; }
    try { const payload = await parseBody(request); await addResponse(payload); sendJson(response, 201, { ok: true }); } catch (error) { console.error(error); sendJson(response, 500, { error: 'Could not save to Google Sheet.' }); }
    return;
  }
  const filePath = request.url === '/' ? '/index.html' : request.url;
  const safePath = path.normalize(filePath).replace(/^\.\.(\/|\\|$)/, '');
  const fullPath = path.join(__dirname, safePath);
  if (!fullPath.startsWith(__dirname) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) { response.writeHead(404); response.end('Not found'); return; }
  const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.md': 'text/plain' };
  response.writeHead(200, { 'Content-Type': contentTypes[path.extname(fullPath)] || 'application/octet-stream' });
  fs.createReadStream(fullPath).pipe(response);
});
server.listen(port, () => console.log(`Survey running at http://localhost:${port}`));
