import PDFDocument from 'pdfkit';
import { prisma } from '../index.js';

interface QuoteData {
  id: string;
  quoteNumber: string;
  customer: {
    name: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    metalType?: string | null;
    metalKarat?: number | null;
    metalGrams?: number;
    labourHours?: number;
  }[];
  subtotal: number;
  markupPct: number;
  markupAmt: number;
  discount: number;
  totalZar: number;
  notes?: string | null;
  validUntil?: Date | null;
  createdAt: Date;
  status: string;
}

interface CompanySettings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_vat: string;
  currency_symbol: string;
  quote_terms: string;
}

// Get company settings from database
async function getCompanySettings(): Promise<CompanySettings> {
  const settings = await prisma.setting.findMany();
  const settingsMap: Record<string, string> = {};
  settings.forEach(s => {
    settingsMap[s.key] = s.value;
  });

  return {
    company_name: settingsMap.company_name || 'My Jewellery Business',
    company_address: settingsMap.company_address || '',
    company_phone: settingsMap.company_phone || '',
    company_email: settingsMap.company_email || '',
    company_vat: settingsMap.company_vat || '',
    currency_symbol: settingsMap.currency_symbol || 'R',
    quote_terms: settingsMap.quote_terms || 'Payment due within 30 days of acceptance.',
  };
}

// Format currency
function formatCurrency(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format date
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Generate PDF quote
export async function generateQuotePDF(quoteId: string): Promise<Buffer> {
  // Fetch quote data
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      customer: true,
      items: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!quote) {
    throw new Error('Quote not found');
  }

  const settings = await getCompanySettings();
  const { currency_symbol } = settings;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Quote ${quote.quoteNumber}`,
          Author: settings.company_name,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Colors
      const primaryColor = '#1a365d';
      const secondaryColor = '#4a5568';
      const lightGray = '#e2e8f0';

      // Header
      doc.fontSize(24)
        .fillColor(primaryColor)
        .text(settings.company_name, 50, 50);

      // Company details
      doc.fontSize(10)
        .fillColor(secondaryColor);
      
      let yPos = 80;
      if (settings.company_address) {
        doc.text(settings.company_address, 50, yPos);
        yPos += 15;
      }
      if (settings.company_phone) {
        doc.text(`Tel: ${settings.company_phone}`, 50, yPos);
        yPos += 15;
      }
      if (settings.company_email) {
        doc.text(`Email: ${settings.company_email}`, 50, yPos);
        yPos += 15;
      }
      if (settings.company_vat) {
        doc.text(`VAT: ${settings.company_vat}`, 50, yPos);
        yPos += 15;
      }

      // Quote title and number
      doc.fontSize(20)
        .fillColor(primaryColor)
        .text('QUOTATION', 400, 50, { align: 'right' });
      
      doc.fontSize(12)
        .fillColor(secondaryColor)
        .text(`#${quote.quoteNumber}`, 400, 75, { align: 'right' });

      // Quote details box
      const detailsY = 100;
      doc.fontSize(10)
        .text(`Date: ${formatDate(quote.createdAt)}`, 400, detailsY, { align: 'right' });
      
      if (quote.validUntil) {
        doc.text(`Valid Until: ${formatDate(quote.validUntil)}`, 400, detailsY + 15, { align: 'right' });
      }
      
      doc.text(`Status: ${quote.status}`, 400, detailsY + 30, { align: 'right' });

      // Customer details
      const customerY = Math.max(yPos + 20, 160);
      doc.fontSize(12)
        .fillColor(primaryColor)
        .text('BILL TO:', 50, customerY);
      
      doc.fontSize(11)
        .fillColor('#000000')
        .text(quote.customer.name, 50, customerY + 20);
      
      let custY = customerY + 35;
      if (quote.customer.company) {
        doc.fontSize(10)
          .fillColor(secondaryColor)
          .text(quote.customer.company, 50, custY);
        custY += 15;
      }
      if (quote.customer.email) {
        doc.text(quote.customer.email, 50, custY);
        custY += 15;
      }
      if (quote.customer.phone) {
        doc.text(quote.customer.phone, 50, custY);
        custY += 15;
      }
      if (quote.customer.address) {
        doc.text(quote.customer.address, 50, custY);
        custY += 15;
      }

      // Items table
      const tableTop = Math.max(custY + 30, 280);
      const tableLeft = 50;
      const tableWidth = 495;
      
      // Table header
      doc.rect(tableLeft, tableTop, tableWidth, 25)
        .fill(primaryColor);
      
      doc.fontSize(10)
        .fillColor('#ffffff')
        .text('Description', tableLeft + 10, tableTop + 8)
        .text('Qty', tableLeft + 280, tableTop + 8, { width: 40, align: 'center' })
        .text('Unit Price', tableLeft + 330, tableTop + 8, { width: 70, align: 'right' })
        .text('Total', tableLeft + 410, tableTop + 8, { width: 75, align: 'right' });

      // Table rows
      let rowY = tableTop + 25;
      let isAlternate = false;

      for (const item of quote.items) {
        const rowHeight = 25;
        
        // Alternate row background
        if (isAlternate) {
          doc.rect(tableLeft, rowY, tableWidth, rowHeight)
            .fill('#f7fafc');
        }
        
        doc.fillColor('#000000')
          .fontSize(9)
          .text(item.description, tableLeft + 10, rowY + 8, { width: 260 })
          .text(String(item.quantity), tableLeft + 280, rowY + 8, { width: 40, align: 'center' })
          .text(formatCurrency(Number(item.unitPrice), currency_symbol), tableLeft + 330, rowY + 8, { width: 70, align: 'right' })
          .text(formatCurrency(Number(item.lineTotal), currency_symbol), tableLeft + 410, rowY + 8, { width: 75, align: 'right' });

        rowY += rowHeight;
        isAlternate = !isAlternate;
      }

      // Table bottom line
      doc.moveTo(tableLeft, rowY)
        .lineTo(tableLeft + tableWidth, rowY)
        .stroke(lightGray);

      // Totals section
      const totalsX = 350;
      const totalsWidth = 195;
      rowY += 20;

      // Subtotal
      doc.fontSize(10)
        .fillColor(secondaryColor)
        .text('Subtotal:', totalsX, rowY)
        .fillColor('#000000')
        .text(formatCurrency(Number(quote.subtotal), currency_symbol), totalsX + 80, rowY, { width: totalsWidth - 80, align: 'right' });
      rowY += 20;

      // Markup
      if (Number(quote.markupPct) > 0) {
        doc.fillColor(secondaryColor)
          .text(`Markup (${Number(quote.markupPct)}%):`, totalsX, rowY)
          .fillColor('#000000')
          .text(formatCurrency(Number(quote.markupAmt), currency_symbol), totalsX + 80, rowY, { width: totalsWidth - 80, align: 'right' });
        rowY += 20;
      }

      // Discount
      if (Number(quote.discount) > 0) {
        doc.fillColor(secondaryColor)
          .text('Discount:', totalsX, rowY)
          .fillColor('#000000')
          .text(`-${formatCurrency(Number(quote.discount), currency_symbol)}`, totalsX + 80, rowY, { width: totalsWidth - 80, align: 'right' });
        rowY += 20;
      }

      // Total line
      doc.moveTo(totalsX, rowY)
        .lineTo(totalsX + totalsWidth, rowY)
        .stroke(primaryColor);
      rowY += 10;

      // Grand total
      doc.fontSize(14)
        .fillColor(primaryColor)
        .text('TOTAL:', totalsX, rowY)
        .text(formatCurrency(Number(quote.totalZar), currency_symbol), totalsX + 80, rowY, { width: totalsWidth - 80, align: 'right' });
      rowY += 40;

      // Notes
      if (quote.notes) {
        doc.fontSize(10)
          .fillColor(primaryColor)
          .text('Notes:', 50, rowY);
        doc.fontSize(9)
          .fillColor(secondaryColor)
          .text(quote.notes, 50, rowY + 15, { width: 495 });
        rowY += 50;
      }

      // Terms and conditions
      if (settings.quote_terms) {
        doc.fontSize(10)
          .fillColor(primaryColor)
          .text('Terms & Conditions:', 50, rowY);
        doc.fontSize(9)
          .fillColor(secondaryColor)
          .text(settings.quote_terms, 50, rowY + 15, { width: 495 });
      }

      // Footer
      const pageHeight = doc.page.height;
      doc.fontSize(8)
        .fillColor(secondaryColor)
        .text(
          `Generated on ${formatDate(new Date())} | ${settings.company_name}`,
          50,
          pageHeight - 50,
          { align: 'center', width: 495 }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Add PDF route to quotes
export async function getQuotePDFBuffer(quoteId: string): Promise<Buffer> {
  return generateQuotePDF(quoteId);
}