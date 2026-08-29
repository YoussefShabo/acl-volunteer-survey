const { appendResponse, isConfigured, listResponses } = require('../lib/sheets');

function validResponse(payload) {
  return payload && typeof payload.name === 'string' && payload.name.trim() && typeof payload.email === 'string' && payload.email.trim() && Array.isArray(payload.shifts) && payload.shifts.length;
}

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (!isConfigured()) return response.status(503).json({ error: 'Google Sheets is not configured.' });
  try {
    if (request.method === 'GET') return response.status(200).json({ responses: await listResponses() });
    if (request.method === 'POST') {
      if (!validResponse(request.body)) return response.status(400).json({ error: 'Name, email, and at least one shift are required.' });
      await appendResponse(request.body);
      return response.status(201).json({ ok: true });
    }
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'Could not access Google Sheet.' });
  }
};
