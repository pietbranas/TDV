import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as cheerio from 'cheerio';

export interface ParsedRow {
  [key: string]: string | number | null;
}

export interface ParsedData {
  headers: string[];
  rows: ParsedRow[];
  rawText?: string;
  sheetNames?: string[];
}

/**
 * Parse a file based on its type
 */
export async function parseFile(filePath: string, fileType: string): Promise<ParsedData> {
  switch (fileType.toLowerCase()) {
    case 'xlsx':
    case 'xls':
      return parseExcel(filePath);
    case 'csv':
      return parseCsv(filePath);
    case 'pdf':
      return parsePdf(filePath);
    case 'html':
    case 'htm':
      return parseHtml(filePath);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Parse Excel files (.xlsx, .xls)
 */
export function parseExcel(filePath: string): ParsedData {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  
  // Use first sheet by default
  const firstSheet = workbook.Sheets[sheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(firstSheet, { header: 1 });
  
  if (jsonData.length === 0) {
    return { headers: [], rows: [], sheetNames };
  }
  
  // First row as headers
  const headerRow = jsonData[0] as unknown as (string | number)[];
  const headers = headerRow.map((h, i) => String(h || `Column${i + 1}`).trim());
  
  // Rest as data rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < jsonData.length; i++) {
    const rowData = jsonData[i] as unknown as (string | number | null)[];
    if (!rowData || rowData.every(cell => cell === null || cell === undefined || cell === '')) {
      continue; // Skip empty rows
    }
    
    const row: ParsedRow = {};
    headers.forEach((header, idx) => {
      row[header] = rowData[idx] ?? null;
    });
    rows.push(row);
  }
  
  return { headers, rows, sheetNames };
}

/**
 * Parse CSV files
 */
export function parseCsv(filePath: string): ParsedData {
  const workbook = XLSX.readFile(filePath, { type: 'file' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { header: 1 });
  
  if (jsonData.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const headerRow = jsonData[0] as unknown as (string | number)[];
  const headers = headerRow.map((h, i) => String(h || `Column${i + 1}`).trim());
  
  const rows: ParsedRow[] = [];
  for (let i = 1; i < jsonData.length; i++) {
    const rowData = jsonData[i] as unknown as (string | number | null)[];
    if (!rowData || rowData.every(cell => cell === null || cell === undefined || cell === '')) {
      continue;
    }
    
    const row: ParsedRow = {};
    headers.forEach((header, idx) => {
      row[header] = rowData[idx] ?? null;
    });
    rows.push(row);
  }
  
  return { headers, rows };
}

/**
 * Parse PDF files - extract text and try to identify tables
 */
export async function parsePdf(filePath: string, supplierName?: string): Promise<ParsedData> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PDFParse } = require('pdf-parse');
  
  const dataBuffer = fs.readFileSync(filePath);
  const uint8Array = new Uint8Array(dataBuffer);
  const pdfParser = new PDFParse(uint8Array);
  await pdfParser.load();
  
  // Get text using getText() which returns {text: string, pages: [...], total: number}
  const result = await pdfParser.getText();
  const text: string = result.text || '';
  
  // Check if this is a CPM price list
  if (text.includes('DAILY SELLING PRICES') || text.includes('FINE GOLD & ALLOYS')) {
    return parseCpmPriceList(text);
  }
  
  const lines = text.split('\n').filter((line: string) => line.trim());
  
  if (lines.length === 0) {
    return {
      headers: ['Info'],
      rows: [{ Info: 'No text content found in PDF' }],
      rawText: text
    };
  }
  
  // Try to detect table-like structure
  const rows: ParsedRow[] = [];
  const potentialHeaders: string[] = [];
  
  // Look for lines with consistent delimiters (tabs, multiple spaces, or common separators)
  let headerDetected = false;
  
  for (const line of lines) {
    // Try to split by common delimiters
    let cells: string[] = [];
    
    if (line.includes('\t')) {
      cells = line.split('\t').map((c: string) => c.trim()).filter((c: string) => c);
    } else if (line.includes('  ')) {
      // Multiple spaces as delimiter
      cells = line.split(/\s{2,}/).map((c: string) => c.trim()).filter((c: string) => c);
    } else if (line.includes('|')) {
      cells = line.split('|').map((c: string) => c.trim()).filter((c: string) => c);
    }
    
    if (cells.length >= 2) {
      if (!headerDetected) {
        // First row with multiple cells becomes headers
        potentialHeaders.push(...cells);
        headerDetected = true;
      } else {
        const row: ParsedRow = {};
        cells.forEach((cell: string, idx: number) => {
          const header = potentialHeaders[idx] || `Column${idx + 1}`;
          row[header] = cell;
        });
        rows.push(row);
      }
    }
  }
  
  // If no table structure detected, return raw text with line-by-line parsing
  // This ensures we always return data from PDFs
  if (rows.length === 0) {
    const headers = ['Line', 'Content'];
    const textRows: ParsedRow[] = lines.slice(0, 200).map((line: string, idx: number) => ({
      Line: idx + 1,
      Content: line.trim()
    }));
    
    return {
      headers,
      rows: textRows,
      rawText: text
    };
  }
  
  return {
    headers: potentialHeaders,
    rows,
    rawText: text
  };
}

/**
 * Custom parser for CPM Daily Selling Prices PDF
 * This PDF has a specific layout with metal prices
 */
function parseCpmPriceList(text: string): ParsedData {
  const rows: ParsedRow[] = [];
  const headers = ['Category', 'Metal', 'Alloy/Type', 'Price (R/g)', 'Unit'];
  
  // Extract exchange rate and date
  const exchangeMatch = text.match(/R\/\$\s*R\s*([\d,]+)/);
  const exchangeRate = exchangeMatch ? exchangeMatch[1].replace(',', '.') : null;
  
  const dateMatch = text.match(/([A-Za-z]+\s+\d+,\s+\d{4})/);
  const priceDate = dateMatch ? dateMatch[1] : null;
  
  // Add metadata row
  if (exchangeRate || priceDate) {
    rows.push({
      Category: 'Info',
      Metal: 'Exchange Rate',
      'Alloy/Type': `R/$ ${exchangeRate}`,
      'Price (R/g)': null,
      Unit: priceDate || ''
    });
  }
  
  // Gold alloy patterns - match "24ct R 2 637,14" or "18ct Y R R 2 044,84"
  const goldPatterns = [
    { regex: /24ct\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '24ct Fine Gold' },
    { regex: /18ct\s+Y\s+R\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '18ct Yellow/Rose' },
    { regex: /18ct\s+W\s+\(10%\s*Pd\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '18ct White (10% Pd)' },
    { regex: /18ct\s+W\s+\(12%\s*Pd\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '18ct White (12% Pd)' },
    { regex: /18ct\s+W\s+\(12\.5%\s*Pd\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '18ct White (12.5% Pd)' },
    { regex: /18ct\s+W\s+\(13%\s*Pd\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '18ct White (13% Pd)' },
    { regex: /18ct\s+W\s+\(16%\s*Pd\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '18ct White (16% Pd)' },
    { regex: /18ct\s+W\s+\(Pd\/Pt\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '18ct White (Pd/Pt)' },
    { regex: /18ct\s+W\s+\(Ni\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '18ct White (Nickel)' },
    { regex: /14ct\s+Y\s+R\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '14ct Yellow/Rose' },
    { regex: /14ct\s+W\s+\(18\.5%\s*Pd\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '14ct White (18.5% Pd)' },
    { regex: /14ct\s+W\s+\(10%\s*Pd\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '14ct White (10% Pd)' },
    { regex: /14ct\s+W\s+\(Ni\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '14ct White (Nickel)' },
    { regex: /9ct\s+Y\s+R\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '9ct Yellow/Rose' },
    { regex: /9ct\s+W\s+\(19%\s*Pd\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '9ct White (19% Pd)' },
    { regex: /9ct\s+W\s+\(16%\s*Pd\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '9ct White (16% Pd)' },
    { regex: /9ct\s+W\s+\(15%\s*Pd\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '9ct White (15% Pd)' },
    { regex: /9ct\s+W\s+\(10%\s*Pd\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '9ct White (10% Pd)' },
    { regex: /9ct\s+W\s+\(7%\s*Pd\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '9ct White (7% Pd)' },
    { regex: /9ct\s+W\s+\(Ni\s*&\s*Pd\s*Free\)\s+R\s+([\d\s,]+)/g, metal: 'Gold', alloy: '9ct White (Ni & Pd Free)' },
  ];
  
  // Platinum & Palladium patterns
  const platinumPatterns = [
    { regex: /PALLADIUM\s+R\s+([\d\s,]+)/g, metal: 'Palladium', alloy: 'Granules' },
    { regex: /PLATINUM\s+R\s+([\d\s,]+)/g, metal: 'Platinum', alloy: 'Granules' },
    { regex: /PALLADIUM\s+RU\s+R\s+([\d\s,]+)/g, metal: 'Palladium', alloy: 'Bars (RU)' },
    { regex: /PLATINUM\s+CU,\s*RU\s+R\s+([\d\s,]+)/g, metal: 'Platinum', alloy: 'Bars (CU, RU)' },
    { regex: /PLATINUM\s+AU\s+R\s+([\d\s,]+)/g, metal: 'Platinum', alloy: 'Bars (AU)' },
  ];
  
  // Silver patterns
  const silverPatterns = [
    { regex: /FINE,\s*STERLING\s+R\s+([\d\s,]+)/g, metal: 'Silver', alloy: 'Fine/Sterling' },
    { regex: /TARNISH-RESISTANT\s+R\s+([\d\s,]+)/g, metal: 'Silver', alloy: 'Tarnish-Resistant' },
    { regex: /ARGENTIUM\s+R\s+([\d\s,]+)/g, metal: 'Silver', alloy: 'Argentium' },
    { regex: /PLATE\s*-\s*STANDARD\s+R\s+([\d\s,]+)/g, metal: 'Silver', alloy: 'Plate - Standard' },
    { regex: /PLATE\s*-\s*LAZER\s+R\s+([\d\s,]+)/g, metal: 'Silver', alloy: 'Plate - Lazer' },
    { regex: /PLATE\s*-\s*ARGENTIUM\s+R\s+([\d\s,]+)/g, metal: 'Silver', alloy: 'Plate - Argentium' },
    { regex: /WIRE\s*-\s*STANDARD\s+R\s+([\d\s,]+)/g, metal: 'Silver', alloy: 'Wire - Standard' },
    { regex: /WIRE\s*-\s*ARGENTIUM\s+R\s+([\d\s,]+)/g, metal: 'Silver', alloy: 'Wire - Argentium' },
    { regex: /ANODES\s+R\s+([\d\s,]+)/g, metal: 'Silver', alloy: 'Anodes' },
    { regex: /TUBING\s+R\s+([\d\s,]+)/g, metal: 'Silver', alloy: 'Tubing' },
    { regex: /AGE\s+PASTE\s+R\s+([\d\s,]+)/g, metal: 'Silver', alloy: 'Age Paste' },
  ];
  
  // Solder patterns
  const solderPatterns = [
    { regex: /9EMHEE\s+Y\s+R\s+([\d\s,]+)/g, metal: 'Gold Solder', alloy: '9ct Extra Easy Yellow' },
    { regex: /9EM\s+W\s+R\s+([\d\s,]+)/g, metal: 'Gold Solder', alloy: '9ct Easy/Medium White' },
    { regex: /9M\s+R\s+R\s+([\d\s,]+)/g, metal: 'Gold Solder', alloy: '9ct Medium Rose' },
    { regex: /14EMH\s+Y\s+R\s+([\d\s,]+)/g, metal: 'Gold Solder', alloy: '14ct Easy/Medium/Hard Yellow' },
    { regex: /18EMH\s+Y\s+R\s+([\d\s,]+)/g, metal: 'Gold Solder', alloy: '18ct Easy/Medium/Hard Yellow' },
    { regex: /18M\s+R\s+R\s+([\d\s,]+)/g, metal: 'Gold Solder', alloy: '18ct Medium Rose' },
    { regex: /18EM\s+W\s+R\s+([\d\s,]+)/g, metal: 'Gold Solder', alloy: '18ct Easy/Medium White' },
    { regex: /18H\s+W\s+R\s+([\d\s,]+)/g, metal: 'Gold Solder', alloy: '18ct Hard White' },
    { regex: /AG\s+EE,\s*E\s+R\s+([\d\s,]+)/g, metal: 'Silver Solder', alloy: 'Extra Easy/Easy' },
    { regex: /AG\s+M,\s*H\s+R\s+([\d\s,]+)/g, metal: 'Silver Solder', alloy: 'Medium/Hard' },
    { regex: /PD\s+E\s+R\s+([\d\s,]+)/g, metal: 'Palladium Solder', alloy: 'Easy' },
    { regex: /PD\s+H\s+R\s+([\d\s,]+)/g, metal: 'Palladium Solder', alloy: 'Hard' },
  ];
  
  // Platinum solder patterns
  const platinumSolderPatterns = [
    { regex: /960\s+R\s+([\d\s,]+)/g, metal: 'Platinum Solder', alloy: '960' },
    { regex: /1020\s+R\s+([\d\s,]+)/g, metal: 'Platinum Solder', alloy: '1020' },
    { regex: /1200\s+R\s+([\d\s,]+)/g, metal: 'Platinum Solder', alloy: '1200' },
    { regex: /1400\s+R\s+([\d\s,]+)/g, metal: 'Platinum Solder', alloy: '1400' },
    { regex: /1600\s+R\s+([\d\s,]+)/g, metal: 'Platinum Solder', alloy: '1600' },
  ];
  
  const parsePrice = (priceStr: string): number | null => {
    // Remove spaces and convert comma to dot
    const cleaned = priceStr.replace(/\s/g, '').replace(',', '.');
    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
  };
  
  const extractPrices = (patterns: Array<{regex: RegExp, metal: string, alloy: string}>, category: string) => {
    for (const pattern of patterns) {
      // Reset regex lastIndex
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(text);
      if (match) {
        const price = parsePrice(match[1]);
        if (price !== null) {
          rows.push({
            Category: category,
            Metal: pattern.metal,
            'Alloy/Type': pattern.alloy,
            'Price (R/g)': price,
            Unit: 'per gram'
          });
        }
      }
    }
  };
  
  // Extract all prices
  extractPrices(goldPatterns, 'Gold Alloys');
  extractPrices(platinumPatterns, 'Platinum & Palladium');
  extractPrices(silverPatterns, 'Silver');
  extractPrices(solderPatterns, 'Solders');
  extractPrices(platinumSolderPatterns, 'Platinum Solders');
  
  return {
    headers,
    rows,
    rawText: text
  };
}

/**
 * Parse HTML files - extract tables
 */
export function parseHtml(filePath: string): ParsedData {
  const html = fs.readFileSync(filePath, 'utf-8');
  const $ = cheerio.load(html);
  
  // Find all tables
  const tables = $('table');
  
  if (tables.length === 0) {
    // No tables found, try to extract text content
    const text = $('body').text();
    const lines = text.split('\n').filter(line => line.trim());
    
    return {
      headers: ['Line', 'Content'],
      rows: lines.slice(0, 100).map((line, idx) => ({
        Line: idx + 1,
        Content: line.trim()
      })),
      rawText: text
    };
  }
  
  // Parse first table
  const table = tables.first();
  const headers: string[] = [];
  const rows: ParsedRow[] = [];
  
  // Get headers from th elements or first row
  const headerRow = table.find('thead tr').first();
  if (headerRow.length) {
    headerRow.find('th').each((i, el) => {
      headers.push($(el).text().trim() || `Column${i + 1}`);
    });
  }
  
  // If no thead, use first tr
  if (headers.length === 0) {
    const firstRow = table.find('tr').first();
    firstRow.find('td, th').each((i, el) => {
      headers.push($(el).text().trim() || `Column${i + 1}`);
    });
  }
  
  // Get data rows
  const dataRows = headers.length > 0 && table.find('thead').length 
    ? table.find('tbody tr')
    : table.find('tr').slice(1);
  
  dataRows.each((_, tr) => {
    const row: ParsedRow = {};
    $(tr).find('td').each((i, td) => {
      const header = headers[i] || `Column${i + 1}`;
      row[header] = $(td).text().trim();
    });
    
    // Only add non-empty rows
    if (Object.values(row).some(v => v !== null && v !== '')) {
      rows.push(row);
    }
  });
  
  return { headers, rows };
}

/**
 * Convert parsed data to Component format for database storage
 */
export function convertToComponents(
  parsedData: ParsedData,
  resourceId: string,
  supplierId: string,
  category: string
): Array<{
  resourceId: string;
  supplierId: string;
  name: string;
  category: string;
  sku: string | null;
  priceZar: number | null;
  priceUsd: number | null;
  size: string | null;
  quality: string | null;
  unit: string;
  specifications: Record<string, any>;
}> {
  const components: Array<{
    resourceId: string;
    supplierId: string;
    name: string;
    category: string;
    sku: string | null;
    priceZar: number | null;
    priceUsd: number | null;
    size: string | null;
    quality: string | null;
    unit: string;
    specifications: Record<string, any>;
  }> = [];
  
  // Check if this is CPM-style data (has Metal, Alloy/Type, Price (R/g) columns)
  const isCpmData = parsedData.headers.includes('Metal') && 
                    parsedData.headers.includes('Alloy/Type') && 
                    parsedData.headers.includes('Price (R/g)');
  
  if (isCpmData) {
    // Handle CPM price list data specially
    for (const row of parsedData.rows) {
      // Skip info/metadata rows
      if (row['Category'] === 'Info') continue;
      
      const metal = String(row['Metal'] || '');
      const alloyType = String(row['Alloy/Type'] || '');
      const priceValue = row['Price (R/g)'];
      const unit = String(row['Unit'] || 'per gram');
      const categoryValue = String(row['Category'] || '');
      
      if (!metal || !alloyType) continue;
      
      // Create a descriptive name combining metal and alloy
      const name = `${metal} - ${alloyType}`;
      
      // Parse price
      let priceZar: number | null = null;
      if (priceValue !== null && priceValue !== undefined) {
        const priceNum = typeof priceValue === 'number' ? priceValue : parseFloat(String(priceValue).replace(/[^0-9.,]/g, '').replace(',', '.'));
        priceZar = isNaN(priceNum) ? null : priceNum;
      }
      
      // Store all columns as specifications
      const specifications: Record<string, any> = {};
      for (const header of parsedData.headers) {
        if (row[header] !== null && row[header] !== undefined) {
          specifications[header] = row[header];
        }
      }
      
      components.push({
        resourceId,
        supplierId,
        name: name.substring(0, 255),
        category,
        sku: null,
        priceZar,
        priceUsd: null,
        size: null,
        quality: categoryValue || null, // Use the CPM category (Gold Alloys, Silver, etc.) as quality
        unit,
        specifications
      });
    }
    
    return components;
  }
  
  // Generic column name mappings for other file types
  const nameColumns = ['name', 'description', 'item', 'product', 'title', 'content'];
  const skuColumns = ['sku', 'code', 'item code', 'product code', 'ref', 'reference'];
  const priceColumns = ['price', 'cost', 'amount', 'zar', 'rand', 'r', 'price (r/g)', 'price (r)'];
  const priceUsdColumns = ['usd', 'dollar', '$', 'price usd'];
  const sizeColumns = ['size', 'dimension', 'mm', 'ct', 'carat'];
  const qualityColumns = ['quality', 'grade', 'clarity', 'color', 'colour'];
  
  const findColumn = (headers: string[], candidates: string[]): string | null => {
    const lowerHeaders = headers.map(h => h.toLowerCase());
    for (const candidate of candidates) {
      const idx = lowerHeaders.findIndex(h => h.includes(candidate));
      if (idx !== -1) return headers[idx];
    }
    return null;
  };
  
  const nameCol = findColumn(parsedData.headers, nameColumns);
  const skuCol = findColumn(parsedData.headers, skuColumns);
  const priceCol = findColumn(parsedData.headers, priceColumns);
  const priceUsdCol = findColumn(parsedData.headers, priceUsdColumns);
  const sizeCol = findColumn(parsedData.headers, sizeColumns);
  const qualityCol = findColumn(parsedData.headers, qualityColumns);
  
  for (const row of parsedData.rows) {
    // Get name - use first non-empty column if no name column found
    let name = nameCol ? String(row[nameCol] || '') : '';
    if (!name) {
      // Use first column value as name
      const firstCol = parsedData.headers[0];
      name = firstCol ? String(row[firstCol] || '') : '';
    }
    
    if (!name || name === 'null') continue;
    
    // Parse price
    let priceZar: number | null = null;
    if (priceCol && row[priceCol]) {
      const priceStr = String(row[priceCol]).replace(/[^0-9.,]/g, '').replace(',', '.');
      priceZar = parseFloat(priceStr) || null;
    }
    
    let priceUsd: number | null = null;
    if (priceUsdCol && row[priceUsdCol]) {
      const priceStr = String(row[priceUsdCol]).replace(/[^0-9.,]/g, '').replace(',', '.');
      priceUsd = parseFloat(priceStr) || null;
    }
    
    // Store all columns as specifications
    const specifications: Record<string, any> = {};
    for (const header of parsedData.headers) {
      if (row[header] !== null && row[header] !== undefined) {
        specifications[header] = row[header];
      }
    }
    
    components.push({
      resourceId,
      supplierId,
      name: name.substring(0, 255),
      category,
      sku: skuCol ? String(row[skuCol] || '').substring(0, 100) || null : null,
      priceZar,
      priceUsd,
      size: sizeCol ? String(row[sizeCol] || '') || null : null,
      quality: qualityCol ? String(row[qualityCol] || '') || null : null,
      unit: 'each',
      specifications
    });
  }
  
  return components;
}
