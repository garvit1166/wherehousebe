const fs = require('fs').promises;
const path = require('path'); 
const express = require('express');
const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');
const cors = require('cors');

 
const app = express();
const port = 3001;
app.use(express.json());
app.use(cors());

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
 
app.get('/', async (req, res) => {
    try {
        const auth = await authorize();
        const data = await listMajors(auth);
        res.json(data);
    } catch (error) {
        console.error('Error fetching spreadsheet data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/', async (req, res) => {
    try {
        const auth = await authorize();
        const data = await writeData(auth,req.body);
        res.json(data);
        console.log(req.body);
    } catch (error) {
        console.error('Error fetching spreadsheet data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
 
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}
 
async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}
 
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}
 
async function listMajors(auth) {
    const sheets = google.sheets({ version: 'v4', auth });
    const lastRow = await getLastRow(auth);
    const range = `A1:D${lastRow}`;
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: '1K5qQESBZvyJjd4BAWU16QzKjS3Y0RNPQrSE_6F1UYM8',
        range: range,
    });
    const rows = res.data.values;
    if (!rows || rows.length === 0) {
        console.log('No data found.');
        return { error: 'No data found' };
    }
    const data = rows.splice(1).map(row => ({
        Id: row[0],
        Avatar_Name: row[1],
        Performance_Score: row[2]
    }));
    return data;
}


async function writeData(auth,values) {
    const sheets = google.sheets({ version: 'v4', auth });
    
    const resource = {
      values,
    };
  
    try {
      const result = await sheets.spreadsheets.values.append({
        spreadsheetId: '1K5qQESBZvyJjd4BAWU16QzKjS3Y0RNPQrSE_6F1UYM8',
        range: 'A1',
        valueInputOption: 'RAW',
        resource: resource,
      });
  
      console.log(
        '%d cells updated on range: %s',
        result.data.updates.updatedCells,
        result.data.updates.updatedRange
      );
  
      return { success: true };
    } catch (err) {
      console.error('Error writing data:', err);
      return { error: 'Error writing data' };
    }
  }

  async function getLastRow(auth) {
    const sheets = google.sheets({ version: 'v4', auth });
  
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: '1K5qQESBZvyJjd4BAWU16QzKjS3Y0RNPQrSE_6F1UYM8',
        ranges: [],
        
      });
       
      const properties = response.data.sheets[0].properties;
 
          const lastRow = properties.gridProperties.rowCount;
          console.log('Last row with data:', lastRow);
      
      return lastRow;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }




app.listen(port, () => {
    console.log(`Server is listening at http://localhost:${port}`);
});