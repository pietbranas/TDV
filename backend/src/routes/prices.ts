import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { fetchMetalPrices, fetchExchangeRates } from '../services/priceService.js';

const router = Router();

// Metal configurations with purity percentages
const METAL_CONFIG = {
  gold: {
    name: 'Gold',
    karats: [
      { karat: 9, purity: 37.5 },
      { karat: 14, purity: 58.5 },
      { karat: 18, purity: 75.0 },
      { karat: 22, purity: 91.6 },
      { karat: 24, purity: 99.9 },
    ],
  },
  silver: {
    name: 'Silver',
    variants: [
      { name: 'Sterling', purity: 92.5 },
      { name: 'Fine', purity: 99.9 },
    ],
  },
  platinum: {
    name: 'Platinum',
    variants: [
      { name: '950', purity: 95.0 },
      { name: '900', purity: 90.0 },
    ],
  },
  palladium: {
    name: 'Palladium',
    variants: [
      { name: '950', purity: 95.0 },
      { name: '500', purity: 50.0 },
    ],
  },
  rhodium: {
    name: 'Rhodium',
    variants: [
      { name: 'Pure', purity: 99.9 },
    ],
  },
};

// GET /api/prices/metals - Get all current metal prices
router.get('/metals', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const metalPrices = await prisma.metalPrice.findMany({
      orderBy: [
        { metalType: 'asc' },
        { karat: 'desc' },
      ],
    });

    // Group by metal type
    const grouped: Record<string, typeof metalPrices> = {};
    metalPrices.forEach(price => {
      if (!grouped[price.metalType]) {
        grouped[price.metalType] = [];
      }
      grouped[price.metalType].push(price);
    });

    res.json({ 
      metalPrices: grouped,
      lastUpdated: metalPrices[0]?.fetchedAt || null,
      config: METAL_CONFIG,
    });
  } catch (error) {
    console.error('Get metal prices error:', error);
    res.status(500).json({ error: 'Failed to get metal prices' });
  }
});

// GET /api/prices/metals/:type - Get specific metal prices
router.get('/metals/:type', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    const karat = req.query.karat ? parseInt(req.query.karat as string) : undefined;

    const where: Record<string, unknown> = { metalType: type.toLowerCase() };
    if (karat) {
      where.karat = karat;
    }

    const metalPrices = await prisma.metalPrice.findMany({
      where,
      orderBy: { karat: 'desc' },
    });

    if (metalPrices.length === 0) {
      res.status(404).json({ error: 'Metal prices not found' });
      return;
    }

    res.json({ metalPrices });
  } catch (error) {
    console.error('Get metal price error:', error);
    res.status(500).json({ error: 'Failed to get metal price' });
  }
});

// GET /api/prices/exchange - Get exchange rates
router.get('/exchange', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exchangeRates = await prisma.exchangeRate.findMany({
      orderBy: { fromCurrency: 'asc' },
    });

    res.json({ 
      exchangeRates,
      lastUpdated: exchangeRates[0]?.fetchedAt || null,
    });
  } catch (error) {
    console.error('Get exchange rates error:', error);
    res.status(500).json({ error: 'Failed to get exchange rates' });
  }
});

// GET /api/prices/exchange/:from/:to - Get specific exchange rate
router.get('/exchange/:from/:to', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to } = req.params;

    const exchangeRate = await prisma.exchangeRate.findUnique({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency: from.toUpperCase(),
          toCurrency: to.toUpperCase(),
        },
      },
    });

    if (!exchangeRate) {
      res.status(404).json({ error: 'Exchange rate not found' });
      return;
    }

    res.json({ exchangeRate });
  } catch (error) {
    console.error('Get exchange rate error:', error);
    res.status(500).json({ error: 'Failed to get exchange rate' });
  }
});

// POST /api/prices/refresh - Manually refresh all prices
router.post('/refresh', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('Manual price refresh triggered');

    // Fetch and update metal prices
    const metalPricesResult = await fetchMetalPrices();
    
    // Fetch and update exchange rates
    const exchangeRatesResult = await fetchExchangeRates();

    res.json({
      message: 'Prices refreshed successfully',
      metalPrices: metalPricesResult,
      exchangeRates: exchangeRatesResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Refresh prices error:', error);
    res.status(500).json({ error: 'Failed to refresh prices' });
  }
});

// GET /api/prices/calculate - Calculate metal cost
router.get('/calculate', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const metalType = req.query.metalType as string;
    const karat = req.query.karat ? parseInt(req.query.karat as string) : null;
    const grams = parseFloat(req.query.grams as string);

    if (!metalType || isNaN(grams)) {
      res.status(400).json({ error: 'metalType and grams are required' });
      return;
    }

    // Get metal price
    const metalPrice = await prisma.metalPrice.findFirst({
      where: {
        metalType: metalType.toLowerCase(),
        ...(karat && { karat }),
      },
    });

    if (!metalPrice) {
      res.status(404).json({ error: 'Metal price not found' });
      return;
    }

    const totalUsd = Number(metalPrice.priceUsd) * grams;
    const totalZar = Number(metalPrice.priceZar) * grams;

    res.json({
      metalType: metalPrice.metalType,
      karat: metalPrice.karat,
      purity: metalPrice.purity,
      grams,
      pricePerGramUsd: Number(metalPrice.priceUsd),
      pricePerGramZar: Number(metalPrice.priceZar),
      totalUsd,
      totalZar,
      fetchedAt: metalPrice.fetchedAt,
    });
  } catch (error) {
    console.error('Calculate metal cost error:', error);
    res.status(500).json({ error: 'Failed to calculate metal cost' });
  }
});

// GET /api/prices/convert - Convert currency
router.get('/convert', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const amount = parseFloat(req.query.amount as string);
    const from = (req.query.from as string || 'USD').toUpperCase();
    const to = (req.query.to as string || 'ZAR').toUpperCase();

    if (isNaN(amount)) {
      res.status(400).json({ error: 'Valid amount is required' });
      return;
    }

    // If same currency, return as is
    if (from === to) {
      res.json({ amount, from, to, converted: amount, rate: 1 });
      return;
    }

    // Try direct conversion
    let exchangeRate = await prisma.exchangeRate.findUnique({
      where: {
        fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to },
      },
    });

    if (exchangeRate) {
      const converted = amount * Number(exchangeRate.rate);
      res.json({
        amount,
        from,
        to,
        converted,
        rate: Number(exchangeRate.rate),
        fetchedAt: exchangeRate.fetchedAt,
      });
      return;
    }

    // Try reverse conversion
    exchangeRate = await prisma.exchangeRate.findUnique({
      where: {
        fromCurrency_toCurrency: { fromCurrency: to, toCurrency: from },
      },
    });

    if (exchangeRate) {
      const rate = 1 / Number(exchangeRate.rate);
      const converted = amount * rate;
      res.json({
        amount,
        from,
        to,
        converted,
        rate,
        fetchedAt: exchangeRate.fetchedAt,
      });
      return;
    }

    res.status(404).json({ error: `Exchange rate not found for ${from} to ${to}` });
  } catch (error) {
    console.error('Convert currency error:', error);
    res.status(500).json({ error: 'Failed to convert currency' });
  }
});

// GET /api/prices/config - Get metal configuration
router.get('/config', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ config: METAL_CONFIG });
});

export default router;