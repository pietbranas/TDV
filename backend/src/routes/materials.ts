import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  },
});

// Material types
const MATERIAL_TYPES = ['gemstone', 'finding', 'chain', 'clasp', 'setting', 'wire', 'other'];

// Validation rules
const materialValidation = [
  body('name').trim().notEmpty().withMessage('Material name is required'),
  body('type').isIn(MATERIAL_TYPES).withMessage(`Type must be one of: ${MATERIAL_TYPES.join(', ')}`),
  body('unit').trim().notEmpty().withMessage('Unit is required'),
  body('pricePerUnit').isNumeric().withMessage('Price per unit must be a number'),
  body('currency').optional().trim().default('ZAR'),
  body('supplierId').optional().trim(),
  body('sku').optional().trim(),
  body('description').optional().trim(),
];

// GET /api/materials - List all materials with filtering
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string || '';
    const type = req.query.type as string;
    const supplierId = req.query.supplierId as string;
    const inStock = req.query.inStock as string;
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
    
    if (type) {
      where.type = type;
    }
    
    if (supplierId) {
      where.supplierId = supplierId;
    }
    
    if (inStock !== undefined) {
      where.inStock = inStock === 'true';
    }

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          supplier: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.material.count({ where }),
    ]);

    res.json({
      materials,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      types: MATERIAL_TYPES,
    });
  } catch (error) {
    console.error('List materials error:', error);
    res.status(500).json({ error: 'Failed to list materials' });
  }
});

// GET /api/materials/types - Get available material types
router.get('/types', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ types: MATERIAL_TYPES });
});

// GET /api/materials/:id - Get single material
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        supplier: true,
      },
    });

    if (!material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    res.json({ material });
  } catch (error) {
    console.error('Get material error:', error);
    res.status(500).json({ error: 'Failed to get material' });
  }
});

// POST /api/materials - Create new material
router.post('/', authenticate, materialValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, type, unit, pricePerUnit, currency, supplierId, sku, description } = req.body;

    // Verify supplier exists if provided
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        res.status(400).json({ error: 'Supplier not found' });
        return;
      }
    }

    const material = await prisma.material.create({
      data: {
        name,
        type,
        unit,
        pricePerUnit: parseFloat(pricePerUnit),
        currency: currency || 'ZAR',
        supplierId: supplierId || null,
        sku,
        description,
      },
      include: {
        supplier: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json({
      message: 'Material created successfully',
      material,
    });
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ error: 'Failed to create material' });
  }
});

// PUT /api/materials/:id - Update material
router.put('/:id', authenticate, materialValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const { name, type, unit, pricePerUnit, currency, supplierId, sku, description, inStock } = req.body;

    // Check if material exists
    const existing = await prisma.material.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    // Verify supplier exists if provided
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        res.status(400).json({ error: 'Supplier not found' });
        return;
      }
    }

    const material = await prisma.material.update({
      where: { id },
      data: {
        name,
        type,
        unit,
        pricePerUnit: parseFloat(pricePerUnit),
        currency: currency || existing.currency,
        supplierId: supplierId || null,
        sku,
        description,
        inStock: inStock !== undefined ? inStock : existing.inStock,
        lastUpdated: new Date(),
      },
      include: {
        supplier: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({
      message: 'Material updated successfully',
      material,
    });
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

// DELETE /api/materials/:id - Delete material
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.material.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    await prisma.material.delete({ where: { id } });

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

// POST /api/materials/import - Import materials from CSV/Excel
router.post('/import', authenticate, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const supplierId = req.body.supplierId as string;

    // Verify supplier exists if provided
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        res.status(400).json({ error: 'Supplier not found' });
        return;
      }
    }

    let data: Record<string, string>[] = [];

    // Parse file based on type
    if (req.file.originalname.endsWith('.csv')) {
      const csvContent = req.file.buffer.toString('utf-8');
      const workbook = XLSX.read(csvContent, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    }

    if (data.length === 0) {
      res.status(400).json({ error: 'No data found in file' });
      return;
    }

    // Map columns (case-insensitive)
    const mapColumn = (row: Record<string, string>, possibleNames: string[]): string | undefined => {
      for (const name of possibleNames) {
        const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
        if (key && row[key]) return String(row[key]).trim();
      }
      return undefined;
    };

    // Process and validate data
    const materials: { 
      name: string; 
      type: string; 
      unit: string; 
      pricePerUnit: number; 
      currency: string;
      supplierId?: string;
      sku?: string;
      description?: string;
    }[] = [];
    const errors: { row: number; error: string }[] = [];

    data.forEach((row, index) => {
      const name = mapColumn(row, ['name', 'material name', 'material', 'item']);
      const type = mapColumn(row, ['type', 'material type', 'category']);
      const unit = mapColumn(row, ['unit', 'uom', 'unit of measure']);
      const priceStr = mapColumn(row, ['price', 'price per unit', 'unit price', 'cost']);
      
      if (!name) {
        errors.push({ row: index + 2, error: 'Name is required' });
        return;
      }
      
      if (!type || !MATERIAL_TYPES.includes(type.toLowerCase())) {
        errors.push({ row: index + 2, error: `Invalid type. Must be one of: ${MATERIAL_TYPES.join(', ')}` });
        return;
      }
      
      if (!unit) {
        errors.push({ row: index + 2, error: 'Unit is required' });
        return;
      }
      
      const price = parseFloat(priceStr || '0');
      if (isNaN(price) || price < 0) {
        errors.push({ row: index + 2, error: 'Invalid price' });
        return;
      }

      materials.push({
        name,
        type: type.toLowerCase(),
        unit,
        pricePerUnit: price,
        currency: mapColumn(row, ['currency']) || 'ZAR',
        supplierId: supplierId || undefined,
        sku: mapColumn(row, ['sku', 'code', 'item code']),
        description: mapColumn(row, ['description', 'desc', 'notes']),
      });
    });

    if (materials.length === 0) {
      res.status(400).json({ 
        error: 'No valid materials found in file',
        validationErrors: errors,
      });
      return;
    }

    // Insert materials
    const result = await prisma.material.createMany({
      data: materials,
      skipDuplicates: true,
    });

    res.status(201).json({
      message: `Successfully imported ${result.count} materials`,
      imported: result.count,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import materials error:', error);
    res.status(500).json({ error: 'Failed to import materials' });
  }
});

// GET /api/materials/export/template - Download import template
router.get('/export/template', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const template = [
      {
        Name: 'Diamond 0.5ct',
        Type: 'gemstone',
        Unit: 'piece',
        Price: 15000,
        Currency: 'ZAR',
        SKU: 'DIA-050',
        Description: 'Round brilliant cut diamond',
      },
      {
        Name: 'Gold Chain 1mm',
        Type: 'chain',
        Unit: 'cm',
        Price: 85,
        Currency: 'ZAR',
        SKU: 'CHN-001',
        Description: '18kt gold chain',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Materials');

    // Add a second sheet with valid types
    const typesSheet = XLSX.utils.json_to_sheet(MATERIAL_TYPES.map(t => ({ 'Valid Types': t })));
    XLSX.utils.book_append_sheet(workbook, typesSheet, 'Valid Types');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=material_import_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Export template error:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// PATCH /api/materials/:id/stock - Toggle material stock status
router.patch('/:id/stock', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { inStock } = req.body;

    const existing = await prisma.material.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    const material = await prisma.material.update({
      where: { id },
      data: { 
        inStock: inStock !== undefined ? inStock : !existing.inStock,
        lastUpdated: new Date(),
      },
    });

    res.json({
      message: `Material marked as ${material.inStock ? 'in stock' : 'out of stock'}`,
      material,
    });
  } catch (error) {
    console.error('Toggle stock error:', error);
    res.status(500).json({ error: 'Failed to update stock status' });
  }
});

export default router;