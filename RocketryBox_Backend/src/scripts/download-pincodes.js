import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URL for the pincode data CSV
const PINCODE_DATA_URL = 'https://raw.githubusercontent.com/avinashcelestine/Pincodes-data/master/postofficeswithpins.csv';
const CSV_PATH = path.join(__dirname, '../../temp/pincodes.csv');

// Ensure temp directory exists
const tempDir = path.join(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Download the CSV file
async function downloadCSV() {
  try {
    console.log('Downloading pincode data...');
    console.log(`Source URL: ${PINCODE_DATA_URL}`);
    console.log(`Destination: ${CSV_PATH}`);
    
    const response = await axios({
      method: 'GET',
      url: PINCODE_DATA_URL,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(CSV_PATH);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('Download completed successfully!');
        console.log(`File saved to: ${CSV_PATH}`);
        
        // Check file size
        const stats = fs.statSync(CSV_PATH);
        console.log(`File size: ${stats.size} bytes`);
        
        resolve();
      });
      
      writer.on('error', (err) => {
        console.error('Error writing file:', err.message);
        reject(err);
      });
    });
  } catch (error) {
    console.error('Error downloading pincode data:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    throw error;
  }
}

// Run the download function
downloadCSV()
  .then(() => console.log('Script completed successfully'))
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  }); 