import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Default settings
const DEFAULT_SETTINGS = [
  { key: 'company_name', value: 'My Jewellery Business', description: 'Company name for quotes and invoices' },
  { key: 'company_address', value: '', description: 'Company address' },
  { key: 'company_phone', value: '', description: 'Company phone number' },
  { key: 'company_email', value: '', description: 'Company email address' },
  { key: 'company_vat', value: '', description: 'VAT registration number' },
  { key: 'default_labour_rate', value: '350', description: 'Default labour rate per hour (ZAR)' },
  { key: 'default_markup_pct', value: '30', description: 'Default markup percentage' },
  { key: 'quote_validity_days', value: '30', description: 'Default quote validity in days' },
  { key: 'quote_terms', value: 'Payment due within 30 days of acceptance.', description: 'Default terms and conditions for quotes' },
  { key: 'quote_notes', value: '', description: 'Default notes for quotes' },
  { key: 'currency', value: 'ZAR', description: 'Base currency' },
  { key: 'currency_symbol', value: 'R', description: 'Currency symbol' },
];

// GET /api/settings - Get all settings
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });

    // Convert to key-value object
    const settingsObj: Record<string, string> = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });

    res.json({ settings: settingsObj, raw: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// GET /api/settings/:key - Get single setting
router.get('/:key', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key } = req.params;

    const setting = await prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      // Return default if exists
      const defaultSetting = DEFAULT_SETTINGS.find(s => s.key === key);
      if (defaultSetting) {
        res.json({ setting: defaultSetting });
        return;
      }
      res.status(404).json({ error: 'Setting not found' });
      return;
    }

    res.json({ setting });
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
});

// PUT /api/settings/:key - Update single setting
router.put('/:key', authenticate, [
  body('value').exists().withMessage('Value is required'),
], async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { key } = req.params;
    const { value, description } = req.body;

    const setting = await prisma.setting.upsert({
      where: { key },
      update: {
        value: String(value),
        description: description || undefined,
      },
      create: {
        key,
        value: String(value),
        description: description || DEFAULT_SETTINGS.find(s => s.key === key)?.description,
      },
    });

    res.json({
      message: 'Setting updated successfully',
      setting,
    });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// PUT /api/settings - Update multiple settings
router.put('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = req.body;

    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'Settings object is required' });
      return;
    }

    const updates: Promise<unknown>[] = [];

    for (const [key, value] of Object.entries(settings)) {
      updates.push(
        prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: {
            key,
            value: String(value),
            description: DEFAULT_SETTINGS.find(s => s.key === key)?.description,
          },
        })
      );
    }

    await Promise.all(updates);

    const updatedSettings = await prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });

    res.json({
      message: 'Settings updated successfully',
      settings: updatedSettings,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST /api/settings/reset - Reset settings to defaults
router.post('/reset', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updates: Promise<unknown>[] = [];

    for (const setting of DEFAULT_SETTINGS) {
      updates.push(
        prisma.setting.upsert({
          where: { key: setting.key },
          update: {
            value: setting.value,
            description: setting.description,
          },
          create: setting,
        })
      );
    }

    await Promise.all(updates);

    const settings = await prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });

    res.json({
      message: 'Settings reset to defaults',
      settings,
    });
  } catch (error) {
    console.error('Reset settings error:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

// GET /api/settings/defaults - Get default settings
router.get('/defaults/list', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ defaults: DEFAULT_SETTINGS });
});

export default router;