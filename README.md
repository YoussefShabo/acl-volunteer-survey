# Event crew volunteer survey

Start the app with:

```sh
npm install
npm start
```

Then visit `http://localhost:4173/`.

Volunteers can select any number of shifts across October 2, 3, 4, 9, 10, and 11. Open **Organizer view** at the bottom of the page to search responses, review commitments, remove a response, or export all entries as CSV.

## Google Sheets setup

1. Create a Google Sheet and add a tab named `Responses`.
2. Create a Google Cloud service account with the Google Sheets API enabled.
3. Download its JSON key into this folder as `service-account.json`.
4. Share the Google Sheet with the service account email as an Editor.
5. Copy `.env.example` to `.env` and set `GOOGLE_SHEET_ID` to the ID in the Sheet URL.
6. Run `npm start` and open `http://localhost:4173/`.

The backend creates the header row automatically and appends each response to the Sheet. Keep `.env` and `service-account.json` private. Until the Sheet is configured, the browser uses its local fallback storage.

## Vercel deployment

In the Vercel project settings, add these environment variables for Production (and Preview if needed):

- `GOOGLE_SHEET_ID`: the ID from the Google Sheet URL
- `GOOGLE_SHEET_TAB`: `Responses`
- `GOOGLE_SERVICE_ACCOUNT_JSON`: the complete contents of the service-account JSON file

Redeploy after adding the variables. Vercel uses `api/health.js` and `api/responses.js` as serverless functions; do not upload the JSON key into the repository.
