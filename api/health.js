module.exports = (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({ configured: Boolean(process.env.GOOGLE_SHEET_ID && (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY))) });
};
