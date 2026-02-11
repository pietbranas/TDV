import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all components with filtering
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { 
      supplierId, 
      resourceId, 
      category, 
      subCategory,
      search,
      isActive,
      limit = '100',
      offset = '0'
    } = req.query;
    
    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (resourceId) where.resourceId = resourceId;
    if (category) where.category = category;
    if (subCategory) where.subCategory = subCategory;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [components, total] = await Promise.all([
      prisma.component.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          resource: { select: { id: true, name: true } }
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.component.count({ where })
    ]);

    res.json({ components, total });
  } catch (error) {
    console.error('Error fetching components:', error);
    res.status(500).json({ error: 'Failed to fetch components' });
  }
});

// Get component categories
router.get('/categories', authenticate, async (req: Request, res: Response) => {
  try {
    const categories = await prisma.component.groupBy({
      by: ['category'],
      _count: { category: true }
    });

    res.json({ 
      categories: categories.map(c => ({ 
        name: c.category, 
        count: c._count.category 
      }))
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single component
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const component = await prisma.component.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: true,
        resource: true
      }
    });

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json({ component });
  } catch (error) {
    console.error('Error fetching component:', error);
    res.status(500).json({ error: 'Failed to fetch component' });
  }
});

// Create component
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      resourceId,
      supplierId,
      sku,
      name,
      description,
      category,
      subCategory,
      unit,
      priceUsd,
      priceZar,
      size,
      quality,
      specifications
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    const component = await prisma.component.create({
      data: {
        resourceId: resourceId || null,
        supplierId: supplierId || null,
        sku: sku || null,
        name,
        description: description || null,
        category,
        subCategory: subCategory || null,
        unit: unit || 'each',
        priceUsd: priceUsd ? parseFloat(priceUsd) : null,
        priceZar: priceZar ? parseFloat(priceZar) : null,
        size: size || null,
        quality: quality || null,
        specifications: specifications || null
      },
      include: {
        supplier: { select: { id: true, name: true } },
        resource: { select: { id: true, name: true } }
      }
    });

    res.status(201).json({ component });
  } catch (error) {
    console.error('Error creating component:', error);
    res.status(500).json({ error: 'Failed to create component' });
  }
});

// Bulk create components (for importing from price lists)
router.post('/bulk', authenticate, async (req: Request, res: Response) => {
  try {
    const { components, resourceId, supplierId } = req.body;

    if (!Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ error: 'Components array is required' });
    }

    const created = await prisma.component.createMany({
      data: components.map((c: any) => ({
        resourceId: resourceId || c.resourceId || null,
        supplierId: supplierId || c.supplierId || null,
        sku: c.sku || null,
        name: c.name,
        description: c.description || null,
        category: c.category,
        subCategory: c.subCategory || null,
        unit: c.unit || 'each',
        priceUsd: c.priceUsd ? parseFloat(c.priceUsd) : null,
        priceZar: c.priceZar ? parseFloat(c.priceZar) : null,
        size: c.size || null,
        quality: c.quality || null,
        specifications: c.specifications || null
      })),
      skipDuplicates: true
    });

    res.status(201).json({ created: created.count });
  } catch (error) {
    console.error('Error bulk creating components:', error);
    res.status(500).json({ error: 'Failed to create components' });
  }
});

// Update component
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      sku,
      name,
      description,
      category,
      subCategory,
      unit,
      priceUsd,
      priceZar,
      size,
      quality,
      specifications,
      isActive
    } = req.body;

    const component = await prisma.component.update({
      where: { id: req.params.id },
      data: {
        sku,
        name,
        description,
        category,
        subCategory,
        unit,
        priceUsd: priceUsd !== undefined ? parseFloat(priceUsd) : undefined,
        priceZar: priceZar !== undefined ? parseFloat(priceZar) : undefined,
        size,
        quality,
        specifications,
        isActive
      },
      include: {
        supplier: { select: { id: true, name: true } },
        resource: { select: { id: true, name: true } }
      }
    });

    res.json({ component });
  } catch (error) {
    console.error('Error updating component:', error);
    res.status(500).json({ error: 'Failed to update component' });
  }
});

// Delete component
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await prisma.component.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Component deleted' });
  } catch (error) {
    console.error('Error deleting component:', error);
    res.status(500).json({ error: 'Failed to delete component' });
  }
});

export default router;