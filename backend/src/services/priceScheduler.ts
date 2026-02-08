import cron from 'node-cron';
import { fetchMetalPrices, fetchExchangeRates } from './priceService.js';

// Schedule price updates
export function startPriceUpdateScheduler(): void {
  // Update metal prices every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Scheduled metal price update starting...');
    try {
      const result = await fetchMetalPrices();
      console.log('Metal price update result:', result);
    } catch (error) {
      console.error('Scheduled metal price update failed:', error);
    }
  });

  // Update exchange rates every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    console.log('⏰ Scheduled exchange rate update starting...');
    try {
      const result = await fetchExchangeRates();
      console.log('Exchange rate update result:', result);
    } catch (error) {
      console.error('Scheduled exchange rate update failed:', error);
    }
  });

  // Initial fetch on startup (with delay to allow DB connection)
  setTimeout(async () => {
    console.log('🚀 Initial price fetch on startup...');
    try {
      await fetchExchangeRates();
      await fetchMetalPrices();
      console.log('✅ Initial price fetch completed');
    } catch (error) {
      console.error('Initial price fetch failed:', error);
    }
  }, 5000);

  console.log('📅 Price update scheduler initialized');
  console.log('   - Metal prices: Every hour');
  console.log('   - Exchange rates: Every 4 hours');
}