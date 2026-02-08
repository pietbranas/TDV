import axios from 'axios';
import { prisma } from '../index.js';

// Metal configurations with purity percentages
const GOLD_KARATS = [
  { karat: 9, purity: 37.5 },
  { karat: 14, purity: 58.5 },
  { karat: 18, purity: 75.0 },
  { karat: 22, purity: 91.6 },
  { karat: 24, purity: 99.9 },
];

const OTHER_METALS = [
  { type: 'silver', name: 'Sterling Silver', purity: 92.5 },
  { type: 'silver', name: 'Fine Silver', purity: 99.9 },
  { type: 'platinum', name: 'Platinum 950', purity: 95.0 },
  { type: 'platinum', name: 'Platinum 900', purity: 90.0 },
  { type: 'palladium', name: 'Palladium 950', purity: 95.0 },
  { type: 'palladium', name: 'Palladium 500', purity: 50.0 },
  { type: 'rhodium', name: 'Rhodium Pure', purity: 99.9 },
];

// Fetch metal prices from API
export async function fetchMetalPrices(): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    // Try metals.live API first (free, no API key required)
    const response = await axios.get('https://api.metals.live/v1/spot', {
      timeout: 10000,
    });

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response from metals API');
    }

    // Parse response - metals.live returns array of {metal, price} in USD per troy ounce
    const metalPrices: Record<string, number> = {};
    response.data.forEach((item: { metal: string; price: number }) => {
      metalPrices[item.metal.toLowerCase()] = item.price;
    });

    // Get USD to ZAR exchange rate
    const usdToZar = await getExchangeRate('USD', 'ZAR');

    // Convert troy ounce to gram (1 troy oz = 31.1035 grams)
    const TROY_OZ_TO_GRAM = 31.1035;

    const now = new Date();
    const updates: Promise<unknown>[] = [];

    // Update gold prices for each karat
    if (metalPrices.gold) {
      const goldPerGramUsd = metalPrices.gold / TROY_OZ_TO_GRAM;
      
      for (const { karat, purity } of GOLD_KARATS) {
        const priceUsd = goldPerGramUsd * (purity / 100);
        const priceZar = priceUsd * usdToZar;

        updates.push(
          prisma.metalPrice.upsert({
            where: { metalType_karat: { metalType: 'gold', karat } },
            update: {
              priceUsd,
              priceZar,
              purity,
              fetchedAt: now,
            },
            create: {
              metalType: 'gold',
              karat,
              purity,
              priceUsd,
              priceZar,
              fetchedAt: now,
            },
          })
        );
      }
    }

    // Update other metal prices
    for (const metal of OTHER_METALS) {
      const basePrice = metalPrices[metal.type];
      if (basePrice) {
        const pricePerGramUsd = (basePrice / TROY_OZ_TO_GRAM) * (metal.purity / 100);
        const pricePerGramZar = pricePerGramUsd * usdToZar;

        updates.push(
          prisma.metalPrice.upsert({
            where: { metalType_karat: { metalType: metal.type, karat: null } },
            update: {
              priceUsd: pricePerGramUsd,
              priceZar: pricePerGramZar,
              purity: metal.purity,
              fetchedAt: now,
            },
            create: {
              metalType: metal.type,
              karat: null,
              purity: metal.purity,
              priceUsd: pricePerGramUsd,
              priceZar: pricePerGramZar,
              fetchedAt: now,
            },
          })
        );
      }
    }

    await Promise.all(updates);

    console.log(`✅ Metal prices updated: ${updates.length} records`);
    return { success: true, message: 'Metal prices updated successfully', count: updates.length };

  } catch (error) {
    console.error('❌ Failed to fetch metal prices:', error);
    
    // Try fallback API (GoldAPI) if available
    const goldApiKey = process.env.GOLD_API_KEY;
    if (goldApiKey) {
      return await fetchMetalPricesFromGoldAPI(goldApiKey);
    }

    return { success: false, message: 'Failed to fetch metal prices' };
  }
}

// Fallback: Fetch from GoldAPI
async function fetchMetalPricesFromGoldAPI(apiKey: string): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    const metals = ['XAU', 'XAG', 'XPT', 'XPD', 'XRH']; // Gold, Silver, Platinum, Palladium, Rhodium
    const metalMap: Record<string, string> = {
      XAU: 'gold',
      XAG: 'silver',
      XPT: 'platinum',
      XPD: 'palladium',
      XRH: 'rhodium',
    };

    const usdToZar = await getExchangeRate('USD', 'ZAR');
    const TROY_OZ_TO_GRAM = 31.1035;
    const now = new Date();
    const updates: Promise<unknown>[] = [];

    for (const metal of metals) {
      try {
        const response = await axios.get(`https://www.goldapi.io/api/${metal}/USD`, {
          headers: { 'x-access-token': apiKey },
          timeout: 10000,
        });

        if (response.data && response.data.price) {
          const metalType = metalMap[metal];
          const pricePerOz = response.data.price;
          const pricePerGramUsd = pricePerOz / TROY_OZ_TO_GRAM;

          if (metalType === 'gold') {
            for (const { karat, purity } of GOLD_KARATS) {
              const priceUsd = pricePerGramUsd * (purity / 100);
              const priceZar = priceUsd * usdToZar;

              updates.push(
                prisma.metalPrice.upsert({
                  where: { metalType_karat: { metalType: 'gold', karat } },
                  update: { priceUsd, priceZar, purity, fetchedAt: now },
                  create: { metalType: 'gold', karat, purity, priceUsd, priceZar, fetchedAt: now },
                })
              );
            }
          } else {
            const metalConfig = OTHER_METALS.filter(m => m.type === metalType);
            for (const config of metalConfig) {
              const priceUsd = pricePerGramUsd * (config.purity / 100);
              const priceZar = priceUsd * usdToZar;

              updates.push(
                prisma.metalPrice.upsert({
                  where: { metalType_karat: { metalType, karat: null } },
                  update: { priceUsd, priceZar, purity: config.purity, fetchedAt: now },
                  create: { metalType, karat: null, purity: config.purity, priceUsd, priceZar, fetchedAt: now },
                })
              );
            }
          }
        }
      } catch (metalError) {
        console.error(`Failed to fetch ${metal} price:`, metalError);
      }
    }

    await Promise.all(updates);
    console.log(`✅ Metal prices updated via GoldAPI: ${updates.length} records`);
    return { success: true, message: 'Metal prices updated via GoldAPI', count: updates.length };

  } catch (error) {
    console.error('❌ GoldAPI fallback failed:', error);
    return { success: false, message: 'Failed to fetch metal prices from GoldAPI' };
  }
}

// Fetch exchange rates
export async function fetchExchangeRates(): Promise<{ success: boolean; message: string; rates?: Record<string, number> }> {
  try {
    // Try exchangerate-api.com
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    let response;

    if (apiKey) {
      response = await axios.get(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`, {
        timeout: 10000,
      });
    } else {
      // Use free API without key (limited)
      response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
        timeout: 10000,
      });
    }

    if (!response.data || !response.data.rates) {
      throw new Error('Invalid response from exchange rate API');
    }

    const rates = response.data.rates;
    const now = new Date();
    const updates: Promise<unknown>[] = [];

    // Store key exchange rates
    const currencies = ['ZAR', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD', 'JPY', 'CNY'];
    const storedRates: Record<string, number> = {};

    for (const currency of currencies) {
      if (rates[currency]) {
        storedRates[currency] = rates[currency];
        
        updates.push(
          prisma.exchangeRate.upsert({
            where: {
              fromCurrency_toCurrency: { fromCurrency: 'USD', toCurrency: currency },
            },
            update: {
              rate: rates[currency],
              fetchedAt: now,
            },
            create: {
              fromCurrency: 'USD',
              toCurrency: currency,
              rate: rates[currency],
              fetchedAt: now,
            },
          })
        );
      }
    }

    // Also store EUR to ZAR if both available
    if (rates.EUR && rates.ZAR) {
      const eurToZar = rates.ZAR / rates.EUR;
      storedRates['EUR_ZAR'] = eurToZar;
      
      updates.push(
        prisma.exchangeRate.upsert({
          where: {
            fromCurrency_toCurrency: { fromCurrency: 'EUR', toCurrency: 'ZAR' },
          },
          update: { rate: eurToZar, fetchedAt: now },
          create: { fromCurrency: 'EUR', toCurrency: 'ZAR', rate: eurToZar, fetchedAt: now },
        })
      );
    }

    await Promise.all(updates);

    console.log(`✅ Exchange rates updated: ${updates.length} rates`);
    return { success: true, message: 'Exchange rates updated successfully', rates: storedRates };

  } catch (error) {
    console.error('❌ Failed to fetch exchange rates:', error);
    return { success: false, message: 'Failed to fetch exchange rates' };
  }
}

// Get exchange rate from database
export async function getExchangeRate(from: string, to: string): Promise<number> {
  // If same currency, return 1
  if (from === to) return 1;

  // Try direct rate
  const directRate = await prisma.exchangeRate.findUnique({
    where: {
      fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to },
    },
  });

  if (directRate) {
    return Number(directRate.rate);
  }

  // Try reverse rate
  const reverseRate = await prisma.exchangeRate.findUnique({
    where: {
      fromCurrency_toCurrency: { fromCurrency: to, toCurrency: from },
    },
  });

  if (reverseRate) {
    return 1 / Number(reverseRate.rate);
  }

  // Default fallback for USD to ZAR (approximate)
  if (from === 'USD' && to === 'ZAR') {
    console.warn('⚠️ Using fallback USD/ZAR rate');
    return 18.5; // Approximate fallback
  }

  throw new Error(`Exchange rate not found: ${from} to ${to}`);
}

// Get metal price from database
export async function getMetalPrice(metalType: string, karat?: number): Promise<{ priceUsd: number; priceZar: number } | null> {
  const metalPrice = await prisma.metalPrice.findFirst({
    where: {
      metalType: metalType.toLowerCase(),
      ...(karat && { karat }),
    },
  });

  if (!metalPrice) return null;

  return {
    priceUsd: Number(metalPrice.priceUsd),
    priceZar: Number(metalPrice.priceZar),
  };
}

// Calculate metal cost
export function calculateMetalCost(pricePerGram: number, grams: number): number {
  return pricePerGram * grams;
}