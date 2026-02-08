import { Router, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

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

// Validation rules
const customerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('company').optional().trim(),
  body('address').optional().trim(),
  body('notes').optional().trim(),
];

// GET /api/customers - List all customers with pagination and search
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const sortBy = req.query.sortBy as string || 'name';
    const sortOrder = req.query.sortOrder as string || 'asc';

    const skip = (page - 1) * limit;

    // Build where clause for search
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { company: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Get customers with pagination
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { quotes: true },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List customers error:', error);
    res.status(500).json({ error: 'Failed to list customers' });
  }
});

// GET /api/customers/:id - Get single customer
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            quoteNumber: true,
            status: true,
            totalZar: true,
            createdAt: true,
          },
        },
        _count: {
          select: { quotes: true },
        },
      },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    res.json({ customer });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Failed to get customer' });
  }
});

// POST /api/customers - Create new customer
router.post('/', authenticate, customerValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, company, email, phone, address, notes } = req.body;

    const customer = await prisma.customer.create({
      data: {
        name,
        company,
        email,
        phone,
        address,
        notes,
      },
    });

    res.status(201).json({
      message: 'Customer created successfully',
      customer,
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT /api/customers/:id - Update customer
router.put('/:id', authenticate, customerValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const { name, company, email, phone, address, notes } = req.body;

    // Check if customer exists
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        company,
        email,
        phone,
        address,
        notes,
      },
    });

    res.json({
      message: 'Customer updated successfully',
      customer,
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if customer exists
    const existing = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { quotes: true } } },
    });

    if (!existing) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Check if customer has quotes
    if (existing._count.quotes > 0) {
      res.status(400).json({ 
        error: 'Cannot delete customer with existing quotes',
        quoteCount: existing._count.quotes,
      });
      return;
    }

    await prisma.customer.delete({ where: { id } });

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// POST /api/customers/import - Import customers from CSV/Excel
router.post('/import', authenticate, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    let data: Record<string, string>[] = [];

    // Parse file based on type
    if (req.file.originalname.endsWith('.csv')) {
      // Parse CSV
      const csvContent = req.file.buffer.toString('utf-8');
      const workbook = XLSX.read(csvContent, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      // Parse Excel
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
    const customers: { name: string; company?: string; email?: string; phone?: string; address?: string; notes?: string }[] = [];
    const errors: { row: number; error: string }[] = [];

    data.forEach((row, index) => {
      const name = mapColumn(row, ['name', 'customer name', 'customer', 'full name']);
      
      if (!name) {
        errors.push({ row: index + 2, error: 'Name is required' });
        return;
      }

      customers.push({
        name,
        company: mapColumn(row, ['company', 'company name', 'business', 'organization']),
        email: mapColumn(row, ['email', 'e-mail', 'email address']),
        phone: mapColumn(row, ['phone', 'telephone', 'tel', 'mobile', 'cell', 'phone number']),
        address: mapColumn(row, ['address', 'street address', 'location']),
        notes: mapColumn(row, ['notes', 'note', 'comments', 'comment']),
      });
    });

    if (customers.length === 0) {
      res.status(400).json({ 
        error: 'No valid customers found in file',
        validationErrors: errors,
      });
      return;
    }

    // Insert customers
    const result = await prisma.customer.createMany({
      data: customers,
      skipDuplicates: true,
    });

    res.status(201).json({
      message: `Successfully imported ${result.count} customers`,
      imported: result.count,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import customers error:', error);
    res.status(500).json({ error: 'Failed to import customers' });
  }
});

// GET /api/customers/export/template - Download import template
router.get('/export/template', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const template = [
      {
        Name: 'John Doe',
        Company: 'ABC Jewellers',
        Email: 'john@example.com',
        Phone: '+27 12 345 6789',
        Address: '123 Main Street, Johannesburg',
        Notes: 'VIP customer',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=customer_import_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Export template error:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

export default router;