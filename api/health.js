const { isConfigured } = require('./_sheets');

module.exports = (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({ configured: isConfigured() });
};
