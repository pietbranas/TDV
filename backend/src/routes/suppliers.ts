import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Validation rules
const supplierValidation = [
  body('name').trim().notEmpty().withMessage('Supplier name is required'),
  body('contactName').optional({ checkFalsy: true }).trim(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional({ checkFalsy: true }).trim(),
  body('address').optional({ checkFalsy: true }).trim(),
  body('website').optional({ checkFalsy: true }).trim().isURL().withMessage('Website must be a valid URL'),
  body('notes').optional({ checkFalsy: true }).trim(),
];

// GET /api/suppliers - List all suppliers
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string || '';

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { contactName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { materials: true },
        },
      },
    });

    res.json({ suppliers });
  } catch (error) {
    console.error('List suppliers error:', error);
    res.status(500).json({ error: 'Failed to list suppliers' });
  }
});

// GET /api/suppliers/:id - Get single supplier
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        materials: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            type: true,
            unit: true,
            pricePerUnit: true,
            currency: true,
            inStock: true,
            lastUpdated: true,
          },
        },
        _count: {
          select: { materials: true },
        },
      },
    });

    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    res.json({ supplier });
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ error: 'Failed to get supplier' });
  }
});

// POST /api/suppliers - Create new supplier
router.post('/', authenticate, supplierValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, contactName, email, phone, address, website, notes } = req.body;

    const supplier = await prisma.supplier.create({
      data: {
        name,
        contactName,
        email,
        phone,
        address,
        website,
        notes,
      },
    });

    res.status(201).json({
      message: 'Supplier created successfully',
      supplier,
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', authenticate, supplierValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const { name, contactName, email, phone, address, website, notes } = req.body;

    // Check if supplier exists
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        contactName,
        email,
        phone,
        address,
        website,
        notes,
      },
    });

    res.json({
      message: 'Supplier updated successfully',
      supplier,
    });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// DELETE /api/suppliers/:id - Delete supplier
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if supplier exists
    const existing = await prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { materials: true } } },
    });

    if (!existing) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    // Check if supplier has materials
    if (existing._count.materials > 0) {
      res.status(400).json({ 
        error: 'Cannot delete supplier with existing materials. Remove materials first.',
        materialCount: existing._count.materials,
      });
      return;
    }

    await prisma.supplier.delete({ where: { id } });

    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

export default router;