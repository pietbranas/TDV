import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseFile, convertToComponents, ParsedData } from '../services/fileParserService.js';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../uploads/resources');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.xlsx', '.xls', '.csv', '.html', '.htm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, Excel, CSV, HTML'));
    }
  }
});

// Get all supplier resources
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { supplierId, category } = req.query;
    
    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (category) where.category = category;

    const resources = await prisma.supplierResource.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        _count: { select: { components: true } }
      },
      orderBy: { uploadedAt: 'desc' }
    });

    res.json({ resources });
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Get single resource
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const resource = await prisma.supplierResource.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: true,
        components: {
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json({ resource });
  } catch (error) {
    console.error('Error fetching resource:', error);
    res.status(500).json({ error: 'Failed to fetch resource' });
  }
});

// Upload new resource (or replace existing for same supplier + category)
router.post('/', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { supplierId, name, category, notes } = req.body;

    if (!supplierId || !name || !category) {
      // Delete uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Supplier, name, and category are required' });
    }

    const fileType = path.extname(req.file.originalname).toLowerCase().replace('.', '');

    // Check if a resource already exists for this supplier + category
    const existingResource = await prisma.supplierResource.findFirst({
      where: {
        supplierId,
        category
      }
    });

    let resource;
    let replacedResource: string | null = null;

    if (existingResource) {
      // Delete old file from disk
      if (fs.existsSync(existingResource.filePath)) {
        try {
          fs.unlinkSync(existingResource.filePath);
        } catch (e) {
          console.error('Failed to delete old file:', e);
        }
      }

      // Delete old components
      await prisma.component.deleteMany({
        where: { resourceId: existingResource.id }
      });

      replacedResource = existingResource.name;

      // Update existing resource with new file info
      resource = await prisma.supplierResource.update({
        where: { id: existingResource.id },
        data: {
          name,
          fileName: req.file.originalname,
          fileType,
          filePath: req.file.path,
          fileSize: req.file.size,
          notes: notes || null,
          uploadedAt: new Date()
        },
        include: {
          supplier: { select: { id: true, name: true } }
        }
      });
    } else {
      // Create new resource
      resource = await prisma.supplierResource.create({
        data: {
          supplierId,
          name,
          category,
          fileName: req.file.originalname,
          fileType,
          filePath: req.file.path,
          fileSize: req.file.size,
          notes: notes || null
        },
        include: {
          supplier: { select: { id: true, name: true } }
        }
      });
    }

    // Parse the file and extract data
    let parsedData: ParsedData | null = null;
    let componentsCreated = 0;
    let parseError: string | null = null;

    try {
      console.log(`Parsing file: ${req.file.path}, type: ${fileType}`);
      parsedData = await parseFile(req.file.path, fileType);
      console.log(`Parsed ${parsedData.rows.length} rows with headers:`, parsedData.headers);
      
      // Convert to components and save to database
      if (parsedData.rows.length > 0) {
        const components = convertToComponents(parsedData, resource.id, supplierId, category);
        console.log(`Converted to ${components.length} components`);
        
        if (components.length > 0) {
          await prisma.component.createMany({
            data: components,
            skipDuplicates: true
          });
          componentsCreated = components.length;
        }
      }
    } catch (err: any) {
      console.error('Error parsing file:', err);
      parseError = err.message || 'Unknown parsing error';
      // Continue even if parsing fails - the file is still uploaded
    }

    res.status(201).json({ 
      resource,
      parsedData: parsedData ? {
        headers: parsedData.headers,
        rowCount: parsedData.rows.length,
        preview: parsedData.rows.slice(0, 10), // First 10 rows as preview
        sheetNames: parsedData.sheetNames
      } : null,
      componentsCreated,
      parseError,
      replacedResource
    });
  } catch (error) {
    console.error('Error uploading resource:', error);
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload resource' });
  }
});

// Update resource
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, category, notes } = req.body;

    const resource = await prisma.supplierResource.update({
      where: { id: req.params.id },
      data: {
        name,
        category,
        notes
      },
      include: {
        supplier: { select: { id: true, name: true } }
      }
    });

    res.json({ resource });
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({ error: 'Failed to update resource' });
  }
});

// Delete resource
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const resource = await prisma.supplierResource.findUnique({
      where: { id: req.params.id }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Delete file from disk
    if (fs.existsSync(resource.filePath)) {
      fs.unlinkSync(resource.filePath);
    }

    await prisma.supplierResource.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Resource deleted' });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
});

// Download resource file
router.get('/:id/download', authenticate, async (req: Request, res: Response) => {
  try {
    const resource = await prisma.supplierResource.findUnique({
      where: { id: req.params.id }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    if (!fs.existsSync(resource.filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.download(resource.filePath, resource.fileName);
  } catch (error) {
    console.error('Error downloading resource:', error);
    res.status(500).json({ error: 'Failed to download resource' });
  }
});

export default router;