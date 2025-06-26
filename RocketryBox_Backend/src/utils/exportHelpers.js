import { Parser } from 'json2csv';
import xlsx from 'xlsx';
import { logger } from './logger.js';

/**
 * Generate CSV file from data
 * @param {Array} data - Array of objects to convert to CSV
 * @param {String} prefix - Prefix for the filename
 * @returns {Object} - Object with filename, content, and mimeType
 */
export const generateCSV = async (data, prefix = 'export') => {
  try {
    if (!data || !data.length) {
      throw new Error('No data provided for CSV export');
    }

    const fields = Object.keys(data[0]);
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}_${timestamp}.csv`;

    return {
      filename,
      content: csv,
      mimeType: 'text/csv'
    };
  } catch (error) {
    logger.error('Error generating CSV:', error);
    throw error;
  }
};

/**
 * Generate XLSX file from data
 * @param {Array} data - Array of objects to convert to XLSX
 * @param {String} prefix - Prefix for the filename
 * @returns {Object} - Object with filename, content, and mimeType
 */
export const generateXLSX = async (data, prefix = 'export') => {
  try {
    if (!data || !data.length) {
      throw new Error('No data provided for XLSX export');
    }

    // Create workbook and worksheet
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(data);

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    // Generate buffer
    const xlsxBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}_${timestamp}.xlsx`;

    return {
      filename,
      content: xlsxBuffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  } catch (error) {
    logger.error('Error generating XLSX:', error);
    throw error;
  }
};

/**
 * Generate PDF from HTML content
 * @param {String} htmlContent - HTML content to convert to PDF
 * @param {String} prefix - Prefix for the filename
 * @returns {Object} - Object with filename, content, and mimeType
 */
export const generatePDF = async (htmlContent, prefix = 'export') => {
  try {
    if (!htmlContent) {
      throw new Error('No HTML content provided for PDF export');
    }

    // Note: This is a placeholder. For actual implementation, you would need to use
    // a PDF generation library like html-pdf, puppeteer, or similar
    // This is just an interface to match the other export functions

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}_${timestamp}.pdf`;

    // Placeholder - in a real implementation, convert HTML to PDF here
    const pdfBuffer = Buffer.from('PDF content would be here');

    return {
      filename,
      content: pdfBuffer,
      mimeType: 'application/pdf'
    };
  } catch (error) {
    logger.error('Error generating PDF:', error);
    throw error;
  }
};
