import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, '../../temp/pincodes.csv');

// Check if the file exists
if (!fs.existsSync(CSV_PATH)) {
  console.error(`CSV file does not exist at: ${CSV_PATH}`);
  console.log('Run the download-pincodes.js script first to download the CSV file.');
  process.exit(1);
}

// Function to parse and examine the CSV
async function examineCSV() {
  const results = [];
  const sampleSize = 5; // Number of sample records to display
  const columnCounts = {};
  let totalRecords = 0;
  
  console.log('Examining CSV structure...');
  
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('headers', (headers) => {
        console.log('\nCSV Headers:');
        console.log(headers);
        
        // Initialize column counts
        headers.forEach(header => {
          columnCounts[header] = {
            nonEmpty: 0,
            empty: 0
          };
        });
      })
      .on('data', (data) => {
        totalRecords++;
        
        // Save sample records
        if (results.length < sampleSize) {
          results.push(data);
        }
        
        // Count non-empty values for each column
        Object.keys(data).forEach(key => {
          if (data[key] && data[key].trim() !== '') {
            columnCounts[key].nonEmpty++;
          } else {
            columnCounts[key].empty++;
          }
        });
      })
      .on('end', () => {
        console.log(`\nTotal records in CSV: ${totalRecords}`);
        
        console.log('\nColumn Statistics:');
        Object.keys(columnCounts).forEach(column => {
          const stats = columnCounts[column];
          const percentFilled = ((stats.nonEmpty / totalRecords) * 100).toFixed(2);
          console.log(`${column}: ${percentFilled}% filled (${stats.nonEmpty} records have values, ${stats.empty} are empty)`);
        });
        
        console.log('\nSample Records:');
        results.forEach((record, index) => {
          console.log(`\nRecord ${index + 1}:`);
          Object.keys(record).forEach(key => {
            console.log(`  ${key}: ${record[key]}`);
          });
        });
        
        resolve();
      })
      .on('error', (error) => {
        console.error('Error parsing CSV:', error.message);
        reject(error);
      });
  });
}

// Run the examination
examineCSV()
  .then(() => console.log('\nExamination completed successfully'))
  .catch(err => {
    console.error('\nExamination failed:', err);
    process.exit(1);
  }); 