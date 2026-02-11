import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { generateQuotePDF } from '../services/pdfService.js';

const router = Router();

// Generate quote number
async function generateQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.quote.count({
    where: {
      quoteNumber: {
        startsWith: `Q${year}`,
      },
    },
  });
  const number = String(count + 1).padStart(4, '0');
  return `Q${year}-${number}`;
}

// Calculate quote totals
function calculateQuoteTotals(items: { lineTotal: number }[], markupPct: number, discount: number) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const markupAmt = subtotal * (markupPct / 100);
  const totalZar = subtotal + markupAmt - discount;
  return { subtotal, markupAmt, totalZar };
}

// Validation rules
const quoteValidation = [
  body('customerId').notEmpty().withMessage('Customer is required'),
  body('markupPct').optional().isNumeric().withMessage('Markup must be a number'),
  body('discount').optional().isNumeric().withMessage('Discount must be a number'),
  body('notes').optional().trim(),
  body('validUntil').optional().isISO8601().withMessage('Valid until must be a valid date'),
];

const quoteItemValidation = [
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('labourHours').optional().isNumeric().withMessage('Labour hours must be a number'),
  body('labourRate').optional().isNumeric().withMessage('Labour rate must be a number'),
  body('metalType').optional().trim(),
  body('metalKarat').optional().isInt().withMessage('Metal karat must be an integer'),
  body('metalGrams').optional().isNumeric().withMessage('Metal grams must be a number'),
  body('accessories').optional().isArray().withMessage('Accessories must be an array'),
];

// GET /api/quotes - List all quotes with pagination
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const status = req.query.status as string;
    const customerId = req.query.customerId as string;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = req.query.sortOrder as string || 'desc';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (search) {
      where.OR = [
        { quoteNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (status) {
      where.status = status;
    }
    
    if (customerId) {
      where.customerId = customerId;
    }

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: { id: true, name: true, company: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.quote.count({ where }),
    ]);

    res.json({
      quotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List quotes error:', error);
    res.status(500).json({ error: 'Failed to list quotes' });
  }
});

// GET /api/quotes/:id - Get single quote with items
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            item: {
              select: { id: true, sku: true, name: true },
            },
          },
        },
        versions: {
          orderBy: { versionNum: 'desc' },
          take: 10,
          select: {
            id: true,
            versionNum: true,
            changeNotes: true,
            createdAt: true,
          },
        },
      },
    });

    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    res.json({ quote });
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({ error: 'Failed to get quote' });
  }
});

// POST /api/quotes - Create new quote
router.post('/', authenticate, quoteValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { customerId, skuCode, markupPct, discount, notes, validUntil, subtotal, totalZar, quoteData } = req.body;

    // Verify customer exists
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(400).json({ error: 'Customer not found' });
      return;
    }

    // Generate quote number
    const quoteNumber = await generateQuoteNumber();

    // Get default settings
    const defaultMarkup = await prisma.setting.findUnique({ where: { key: 'default_markup_pct' } });
    const finalMarkupPct = markupPct !== undefined ? parseFloat(markupPct) : (defaultMarkup ? parseFloat(defaultMarkup.value) : 30);

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        customerId,
        skuCode: skuCode || null,
        markupPct: finalMarkupPct,
        discount: discount ? parseFloat(discount) : 0,
        subtotal: subtotal ? parseFloat(subtotal) : 0,
        totalZar: totalZar ? parseFloat(totalZar) : 0,
        quoteData: quoteData ? JSON.parse(quoteData) : null,
        notes,
        validUntil: validUntil ? new Date(validUntil) : null,
      },
      include: {
        customer: {
          select: { id: true, name: true, company: true },
        },
      },
    });

    res.status(201).json({
      message: 'Quote created successfully',
      quote,
    });
  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({ error: 'Failed to create quote' });
  }
});

// PUT /api/quotes/:id - Update quote
router.put('/:id', authenticate, quoteValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const { customerId, skuCode, markupPct, discount, notes, validUntil, status, subtotal, totalZar, quoteData } = req.body;

    // Check if quote exists
    const existing = await prisma.quote.findUnique({
      where: { id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    // Create version snapshot before update (skip for minor updates)
    if (existing.version > 0) {
      try {
        await prisma.quoteVersion.create({
          data: {
            quoteId: id,
            versionNum: existing.version,
            snapshotJson: JSON.parse(JSON.stringify(existing)),
            changeNotes: req.body.changeNotes || 'Quote updated',
          },
        });
      } catch (e) {
        // Ignore duplicate version errors
      }
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: {
        customerId: customerId || existing.customerId,
        skuCode: skuCode !== undefined ? skuCode : existing.skuCode,
        markupPct: markupPct !== undefined ? parseFloat(markupPct) : existing.markupPct,
        discount: discount !== undefined ? parseFloat(discount) : existing.discount,
        subtotal: subtotal !== undefined ? parseFloat(subtotal) : existing.subtotal,
        totalZar: totalZar !== undefined ? parseFloat(totalZar) : existing.totalZar,
        quoteData: quoteData ? JSON.parse(quoteData) : existing.quoteData,
        notes: notes !== undefined ? notes : existing.notes,
        validUntil: validUntil ? new Date(validUntil) : existing.validUntil,
        status: status || existing.status,
        version: existing.version + 1,
      },
      include: {
        customer: true,
      },
    });

    res.json({
      message: 'Quote updated successfully',
      quote,
    });
  } catch (error) {
    console.error('Update quote error:', error);
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

// DELETE /api/quotes/:id - Delete quote
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.quote.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    // Delete quote (cascade deletes items and versions)
    await prisma.quote.delete({ where: { id } });

    res.json({ message: 'Quote deleted successfully' });
  } catch (error) {
    console.error('Delete quote error:', error);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

// POST /api/quotes/:id/items - Add item to quote
router.post('/:id/items', authenticate, quoteItemValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const { 
      itemId, description, quantity, labourHours, labourRate, 
      metalType, metalKarat, metalGrams, accessories, notes 
    } = req.body;

    // Check if quote exists
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    // Get default labour rate
    const defaultLabourRate = await prisma.setting.findUnique({ where: { key: 'default_labour_rate' } });
    const finalLabourRate = labourRate !== undefined ? parseFloat(labourRate) : (defaultLabourRate ? parseFloat(defaultLabourRate.value) : 350);

    // Calculate labour total
    const labourHoursNum = labourHours ? parseFloat(labourHours) : 0;
    const labourTotal = labourHoursNum * finalLabourRate;

    // Metal total (manual entry - no auto calculation)
    let metalPrice = 0;
    let metalTotal = 0;

    // Calculate extras total from accessories
    let extrasTotal = 0;
    if (accessories && Array.isArray(accessories)) {
      extrasTotal = accessories.reduce((sum: number, acc: { price?: number }) => sum + (acc.price || 0), 0);
    }

    // Calculate unit price and line total
    const qty = quantity || 1;
    const unitPrice = labourTotal + metalTotal + extrasTotal;
    const lineTotal = unitPrice * qty;

    // Get next sort order
    const maxSortOrder = await prisma.quoteItem.aggregate({
      where: { quoteId: id },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSortOrder._max.sortOrder || 0) + 1;

    const quoteItem = await prisma.quoteItem.create({
      data: {
        quoteId: id,
        itemId: itemId || null,
        description,
        quantity: qty,
        labourHours: labourHoursNum,
        labourRate: finalLabourRate,
        labourTotal,
        metalType: metalType || null,
        metalKarat: metalKarat || null,
        metalGrams: metalGrams ? parseFloat(metalGrams) : 0,
        metalPrice,
        metalTotal,
        accessories: accessories || null,
        extrasTotal,
        unitPrice,
        lineTotal,
        notes: notes || null,
        sortOrder,
      },
    });

    // Update quote totals
    const allItems = await prisma.quoteItem.findMany({ where: { quoteId: id } });
    const totals = calculateQuoteTotals(allItems, Number(quote.markupPct), Number(quote.discount));
    
    await prisma.quote.update({
      where: { id },
      data: {
        subtotal: totals.subtotal,
        markupAmt: totals.markupAmt,
        totalZar: totals.totalZar,
      },
    });

    res.status(201).json({
      message: 'Item added to quote',
      quoteItem,
      quoteTotals: totals,
    });
  } catch (error) {
    console.error('Add quote item error:', error);
    res.status(500).json({ error: 'Failed to add item to quote' });
  }
});

// PUT /api/quotes/:id/items/:itemId - Update quote item
router.put('/:id/items/:itemId', authenticate, quoteItemValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id, itemId } = req.params;
    const { 
      description, quantity, labourHours, labourRate, 
      metalType, metalKarat, metalGrams, accessories, notes 
    } = req.body;

    // Check if quote item exists
    const existing = await prisma.quoteItem.findFirst({
      where: { id: itemId, quoteId: id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Quote item not found' });
      return;
    }

    // Get quote for markup calculation
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    // Calculate labour total
    const labourHoursNum = labourHours !== undefined ? parseFloat(labourHours) : Number(existing.labourHours);
    const finalLabourRate = labourRate !== undefined ? parseFloat(labourRate) : Number(existing.labourRate);
    const labourTotal = labourHoursNum * finalLabourRate;

    // Metal total (manual entry - no auto calculation)
    const finalMetalType = metalType !== undefined ? metalType : existing.metalType;
    const finalMetalKarat = metalKarat !== undefined ? metalKarat : existing.metalKarat;
    const finalMetalGrams = metalGrams !== undefined ? parseFloat(metalGrams) : Number(existing.metalGrams);
    
    let metalPrice = Number(existing.metalPrice);
    let metalTotal = metalPrice * finalMetalGrams;

    // Calculate extras total
    const finalAccessories = accessories !== undefined ? accessories : existing.accessories;
    let extrasTotal = 0;
    if (finalAccessories && Array.isArray(finalAccessories)) {
      extrasTotal = finalAccessories.reduce((sum: number, acc: { price?: number }) => sum + (acc.price || 0), 0);
    }

    // Calculate unit price and line total
    const qty = quantity !== undefined ? quantity : existing.quantity;
    const unitPrice = labourTotal + metalTotal + extrasTotal;
    const lineTotal = unitPrice * qty;

    const quoteItem = await prisma.quoteItem.update({
      where: { id: itemId },
      data: {
        description: description !== undefined ? description : existing.description,
        quantity: qty,
        labourHours: labourHoursNum,
        labourRate: finalLabourRate,
        labourTotal,
        metalType: finalMetalType,
        metalKarat: finalMetalKarat,
        metalGrams: finalMetalGrams,
        metalPrice,
        metalTotal,
        accessories: finalAccessories,
        extrasTotal,
        unitPrice,
        lineTotal,
        notes: notes !== undefined ? notes : existing.notes,
      },
    });

    // Update quote totals
    const allItems = await prisma.quoteItem.findMany({ where: { quoteId: id } });
    const totals = calculateQuoteTotals(allItems, Number(quote.markupPct), Number(quote.discount));
    
    await prisma.quote.update({
      where: { id },
      data: {
        subtotal: totals.subtotal,
        markupAmt: totals.markupAmt,
        totalZar: totals.totalZar,
      },
    });

    res.json({
      message: 'Quote item updated',
      quoteItem,
      quoteTotals: totals,
    });
  } catch (error) {
    console.error('Update quote item error:', error);
    res.status(500).json({ error: 'Failed to update quote item' });
  }
});

// DELETE /api/quotes/:id/items/:itemId - Remove item from quote
router.delete('/:id/items/:itemId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, itemId } = req.params;

    // Check if quote item exists
    const existing = await prisma.quoteItem.findFirst({
      where: { id: itemId, quoteId: id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Quote item not found' });
      return;
    }

    // Get quote for totals update
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    await prisma.quoteItem.delete({ where: { id: itemId } });

    // Update quote totals
    const allItems = await prisma.quoteItem.findMany({ where: { quoteId: id } });
    const totals = calculateQuoteTotals(allItems, Number(quote.markupPct), Number(quote.discount));
    
    await prisma.quote.update({
      where: { id },
      data: {
        subtotal: totals.subtotal,
        markupAmt: totals.markupAmt,
        totalZar: totals.totalZar,
      },
    });

    res.json({
      message: 'Quote item removed',
      quoteTotals: totals,
    });
  } catch (error) {
    console.error('Delete quote item error:', error);
    res.status(500).json({ error: 'Failed to remove quote item' });
  }
});

// PATCH /api/quotes/:id/status - Update quote status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const existing = await prisma.quote.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: { status },
    });

    res.json({
      message: `Quote status updated to ${status}`,
      quote,
    });
  } catch (error) {
    console.error('Update quote status error:', error);
    res.status(500).json({ error: 'Failed to update quote status' });
  }
});

// GET /api/quotes/:id/versions - Get quote version history
router.get('/:id/versions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const versions = await prisma.quoteVersion.findMany({
      where: { quoteId: id },
      orderBy: { versionNum: 'desc' },
    });

    res.json({ versions });
  } catch (error) {
    console.error('Get quote versions error:', error);
    res.status(500).json({ error: 'Failed to get quote versions' });
  }
});

// POST /api/quotes/:id/restore/:versionNum - Restore quote to specific version
router.post('/:id/restore/:versionNum', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, versionNum } = req.params;

    const version = await prisma.quoteVersion.findUnique({
      where: {
        quoteId_versionNum: {
          quoteId: id,
          versionNum: parseInt(versionNum),
        },
      },
    });

    if (!version) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }

    const snapshot = version.snapshotJson as Record<string, unknown>;

    // Get current quote for version increment
    const current = await prisma.quote.findUnique({ where: { id } });
    if (!current) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    // Create version snapshot of current state
    await prisma.quoteVersion.create({
      data: {
        quoteId: id,
        versionNum: current.version,
        snapshotJson: JSON.parse(JSON.stringify(current)),
        changeNotes: `Restored to version ${versionNum}`,
      },
    });

    // Restore quote data
    const quote = await prisma.quote.update({
      where: { id },
      data: {
        markupPct: snapshot.markupPct as number,
        discount: snapshot.discount as number,
        notes: snapshot.notes as string,
        subtotal: snapshot.subtotal as number,
        markupAmt: snapshot.markupAmt as number,
        totalZar: snapshot.totalZar as number,
        version: current.version + 1,
      },
    });

    res.json({
      message: `Quote restored to version ${versionNum}`,
      quote,
    });
  } catch (error) {
    console.error('Restore quote version error:', error);
    res.status(500).json({ error: 'Failed to restore quote version' });
  }
});

// GET /api/quotes/:id/pdf - Generate PDF for quote
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if quote exists
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    // Generate PDF
    const pdfBuffer = await generateQuotePDF(id);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Quote-${quote.quoteNumber}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// POST /api/quotes/:id/duplicate - Duplicate quote
router.post('/:id/duplicate', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const original = await prisma.quote.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!original) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    // Generate new quote number
    const quoteNumber = await generateQuoteNumber();

    // Create new quote
    const newQuote = await prisma.quote.create({
      data: {
        quoteNumber,
        customerId: original.customerId,
        status: 'DRAFT',
        subtotal: original.subtotal,
        markupPct: original.markupPct,
        markupAmt: original.markupAmt,
        discount: original.discount,
        totalZar: original.totalZar,
        notes: original.notes ? `Copy of ${original.quoteNumber}: ${original.notes}` : `Copy of ${original.quoteNumber}`,
        validUntil: null,
      },
    });

    // Duplicate items
    for (const item of original.items) {
      await prisma.quoteItem.create({
        data: {
          quoteId: newQuote.id,
          itemId: item.itemId,
          description: item.description,
          quantity: item.quantity,
          labourHours: item.labourHours,
          labourRate: item.labourRate,
          labourTotal: item.labourTotal,
          metalType: item.metalType,
          metalKarat: item.metalKarat,
          metalGrams: item.metalGrams,
          metalPrice: item.metalPrice,
          metalTotal: item.metalTotal,
          accessories: item.accessories,
          extrasTotal: item.extrasTotal,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          notes: item.notes,
          sortOrder: item.sortOrder,
        },
      });
    }

    const duplicatedQuote = await prisma.quote.findUnique({
      where: { id: newQuote.id },
      include: {
        customer: true,
        items: true,
      },
    });

    res.status(201).json({
      message: 'Quote duplicated successfully',
      quote: duplicatedQuote,
    });
  } catch (error) {
    console.error('Duplicate quote error:', error);
    res.status(500).json({ error: 'Failed to duplicate quote' });
  }
});

export default router;