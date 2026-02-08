import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Validation rules
const itemValidation = [
  body('name').trim().notEmpty().withMessage('Item name is required'),
  body('categoryId').notEmpty().withMessage('Category is required'),
  body('sku').optional().trim(),
  body('description').optional().trim(),
  body('basePrice').optional().isNumeric().withMessage('Base price must be a number'),
  body('imageUrl').optional().trim().isURL().withMessage('Image URL must be valid'),
];

// Generate SKU based on category and count
async function generateSKU(categoryId: string): Promise<string> {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error('Category not found');

  // Get category prefix (first 3 letters uppercase)
  const prefix = category.name.substring(0, 3).toUpperCase();
  
  // Count existing items in category
  const count = await prisma.item.count({ where: { categoryId } });
  
  // Generate SKU: PREFIX-XXXX (e.g., RIN-0001)
  const number = String(count + 1).padStart(4, '0');
  return `${prefix}-${number}`;
}

// GET /api/items - List all items with pagination and filtering
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const categoryId = req.query.categoryId as string;
    const isActive = req.query.isActive as string;
    const sortBy = req.query.sortBy as string || 'name';
    const sortOrder = req.query.sortOrder as string || 'asc';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // Get items with pagination
    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          category: {
            select: { id: true, name: true },
          },
          _count: {
            select: { quoteItems: true },
          },
        },
      }),
      prisma.item.count({ where }),
    ]);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List items error:', error);
    res.status(500).json({ error: 'Failed to list items' });
  }
});

// GET /api/items/:id - Get single item
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        category: true,
        quoteItems: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            description: true,
            lineTotal: true,
            createdAt: true,
            quote: {
              select: {
                id: true,
                quoteNumber: true,
                customer: {
                  select: { name: true },
                },
              },
            },
          },
        },
        _count: {
          select: { quoteItems: true },
        },
      },
    });

    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    res.json({ item });
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Failed to get item' });
  }
});

// POST /api/items - Create new item
router.post('/', authenticate, itemValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, categoryId, sku, description, basePrice, imageUrl } = req.body;

    // Verify category exists
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      res.status(400).json({ error: 'Category not found' });
      return;
    }

    // Generate SKU if not provided
    const finalSku = sku || await generateSKU(categoryId);

    // Check if SKU already exists
    const existingSku = await prisma.item.findUnique({ where: { sku: finalSku } });
    if (existingSku) {
      res.status(400).json({ error: 'SKU already exists' });
      return;
    }

    const item = await prisma.item.create({
      data: {
        name,
        categoryId,
        sku: finalSku,
        description,
        basePrice: basePrice ? parseFloat(basePrice) : null,
        imageUrl,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json({
      message: 'Item created successfully',
      item,
    });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/items/:id - Update item
router.put('/:id', authenticate, itemValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const { name, categoryId, sku, description, basePrice, imageUrl, isActive } = req.body;

    // Check if item exists
    const existing = await prisma.item.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Verify category exists
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      res.status(400).json({ error: 'Category not found' });
      return;
    }

    // Check if new SKU conflicts with another item
    if (sku && sku !== existing.sku) {
      const skuConflict = await prisma.item.findUnique({ where: { sku } });
      if (skuConflict) {
        res.status(400).json({ error: 'SKU already exists' });
        return;
      }
    }

    const item = await prisma.item.update({
      where: { id },
      data: {
        name,
        categoryId,
        sku: sku || existing.sku,
        description,
        basePrice: basePrice !== undefined ? parseFloat(basePrice) : existing.basePrice,
        imageUrl,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({
      message: 'Item updated successfully',
      item,
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/items/:id - Delete item
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if item exists
    const existing = await prisma.item.findUnique({
      where: { id },
      include: { _count: { select: { quoteItems: true } } },
    });

    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Check if item is used in quotes
    if (existing._count.quoteItems > 0) {
      // Soft delete - just mark as inactive
      await prisma.item.update({
        where: { id },
        data: { isActive: false },
      });
      res.json({ 
        message: 'Item deactivated (has existing quote references)',
        deactivated: true,
      });
      return;
    }

    await prisma.item.delete({ where: { id } });

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// PATCH /api/items/:id/toggle - Toggle item active status
router.patch('/:id/toggle', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.item.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const item = await prisma.item.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    res.json({
      message: `Item ${item.isActive ? 'activated' : 'deactivated'} successfully`,
      item,
    });
  } catch (error) {
    console.error('Toggle item error:', error);
    res.status(500).json({ error: 'Failed to toggle item status' });
  }
});

export default router;