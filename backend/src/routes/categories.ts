import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Validation rules
const categoryValidation = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('description').optional().trim(),
];

// GET /api/categories - List all categories
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    res.json({ categories });
  } catch (error) {
    console.error('List categories error:', error);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

// GET /api/categories/:id - Get single category
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            sku: true,
            name: true,
            basePrice: true,
            isActive: true,
          },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    res.json({ category });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Failed to get category' });
  }
});

// POST /api/categories - Create new category
router.post('/', authenticate, categoryValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, description } = req.body;

    // Check if category name already exists
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) {
      res.status(400).json({ error: 'Category with this name already exists' });
      return;
    }

    const category = await prisma.category.create({
      data: { name, description },
    });

    res.status(201).json({
      message: 'Category created successfully',
      category,
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id - Update category
router.put('/:id', authenticate, categoryValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const { name, description } = req.body;

    // Check if category exists
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    // Check if new name conflicts with another category
    if (name !== existing.name) {
      const nameConflict = await prisma.category.findUnique({ where: { name } });
      if (nameConflict) {
        res.status(400).json({ error: 'Category with this name already exists' });
        return;
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: { name, description },
    });

    res.json({
      message: 'Category updated successfully',
      category,
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if category exists
    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });

    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    // Check if category has items
    if (existing._count.items > 0) {
      res.status(400).json({ 
        error: 'Cannot delete category with existing items',
        itemCount: existing._count.items,
      });
      return;
    }

    await prisma.category.delete({ where: { id } });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;