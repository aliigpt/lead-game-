// Paste into a Google Sheet: Extensions > Apps Script. Deploy > New deployment >
// Web app, "Execute as: Me", "Who has access: Anyone". Copy the /exec URL into
// LEADS_WEBHOOK_URL. Each signup becomes a row.
function doPost(e) {
  const lead = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(["name", "email", "consent", "ts", "ref"]);
  sheet.appendRow([lead.name, lead.email, lead.consent, lead.ts, lead.ref]);
  return ContentService.createTextOutput("ok");
}
