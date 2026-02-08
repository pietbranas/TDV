import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default settings
  const defaultSettings = [
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

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log('✅ Default settings created');

  // Create default categories
  const categories = [
    { name: 'Rings', description: 'Engagement rings, wedding bands, fashion rings' },
    { name: 'Earrings', description: 'Studs, hoops, drop earrings' },
    { name: 'Necklaces', description: 'Chains, pendants, chokers' },
    { name: 'Bracelets', description: 'Bangles, chain bracelets, cuffs' },
    { name: 'Pendants', description: 'Standalone pendants without chains' },
    { name: 'Brooches', description: 'Decorative pins and brooches' },
    { name: 'Watches', description: 'Watch repairs and customizations' },
    { name: 'Custom', description: 'Custom and bespoke pieces' },
    { name: 'Repairs', description: 'Repair and restoration work' },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }
  console.log('✅ Default categories created');

  // Create sample metal prices (will be updated by API)
  // Gold prices with karat
  const goldPrices = [
    { metalType: 'gold', karat: 9, purity: 37.5, priceUsd: 28.5, priceZar: 527.25 },
    { metalType: 'gold', karat: 14, purity: 58.5, priceUsd: 44.46, priceZar: 822.51 },
    { metalType: 'gold', karat: 18, purity: 75.0, priceUsd: 57.0, priceZar: 1054.50 },
    { metalType: 'gold', karat: 22, purity: 91.6, priceUsd: 69.62, priceZar: 1287.97 },
    { metalType: 'gold', karat: 24, purity: 99.9, priceUsd: 75.93, priceZar: 1404.70 },
  ];

  for (const price of goldPrices) {
    await prisma.metalPrice.upsert({
      where: {
        metalType_karat: {
          metalType: price.metalType,
          karat: price.karat,
        },
      },
      update: {
        priceUsd: price.priceUsd,
        priceZar: price.priceZar,
        purity: price.purity,
      },
      create: price,
    });
  }

  // Other metals without karat (use karat: 0 as placeholder)
  const otherMetals = [
    { metalType: 'silver', karat: 0, purity: 92.5, priceUsd: 0.85, priceZar: 15.73 },
    { metalType: 'platinum', karat: 0, purity: 95.0, priceUsd: 31.35, priceZar: 579.98 },
    { metalType: 'palladium', karat: 0, purity: 95.0, priceUsd: 32.30, priceZar: 597.55 },
    { metalType: 'rhodium', karat: 0, purity: 99.9, priceUsd: 145.0, priceZar: 2682.50 },
  ];

  for (const price of otherMetals) {
    await prisma.metalPrice.upsert({
      where: {
        metalType_karat: {
          metalType: price.metalType,
          karat: price.karat,
        },
      },
      update: {
        priceUsd: price.priceUsd,
        priceZar: price.priceZar,
        purity: price.purity,
      },
      create: price,
    });
  }
  console.log('✅ Default metal prices created');

  // Create default exchange rate
  await prisma.exchangeRate.upsert({
    where: {
      fromCurrency_toCurrency: {
        fromCurrency: 'USD',
        toCurrency: 'ZAR',
      },
    },
    update: { rate: 18.5 },
    create: {
      fromCurrency: 'USD',
      toCurrency: 'ZAR',
      rate: 18.5,
    },
  });
  console.log('✅ Default exchange rate created');

  // Check if admin user exists
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    // Create default admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    await prisma.user.create({
      data: {
        email: 'admin@jeweller.local',
        password: hashedPassword,
        name: 'Administrator',
      },
    });
    console.log('✅ Default admin user created');
    console.log('   Email: admin@jeweller.local');
    console.log('   Password: admin123');
    console.log('   ⚠️  Please change the password after first login!');
  }

  // Create sample supplier
  const supplier = await prisma.supplier.upsert({
    where: { id: 'sample-supplier' },
    update: {},
    create: {
      id: 'sample-supplier',
      name: 'Sample Gem Supplier',
      contactName: 'John Smith',
      email: 'john@gemsupplier.example',
      phone: '+27 11 123 4567',
      address: '123 Gem Street, Johannesburg',
      notes: 'Sample supplier for demonstration',
    },
  });
  console.log('✅ Sample supplier created');

  // Create sample materials
  const materials = [
    { name: 'Diamond 0.25ct Round', type: 'gemstone', unit: 'piece', pricePerUnit: 8500, supplierId: supplier.id },
    { name: 'Diamond 0.50ct Round', type: 'gemstone', unit: 'piece', pricePerUnit: 22000, supplierId: supplier.id },
    { name: 'Diamond 1.00ct Round', type: 'gemstone', unit: 'piece', pricePerUnit: 85000, supplierId: supplier.id },
    { name: 'Ruby 0.50ct Oval', type: 'gemstone', unit: 'piece', pricePerUnit: 15000, supplierId: supplier.id },
    { name: 'Sapphire 0.50ct Oval', type: 'gemstone', unit: 'piece', pricePerUnit: 12000, supplierId: supplier.id },
    { name: 'Emerald 0.50ct Emerald Cut', type: 'gemstone', unit: 'piece', pricePerUnit: 18000, supplierId: supplier.id },
    { name: 'Butterfly Back (Gold)', type: 'finding', unit: 'pair', pricePerUnit: 250, supplierId: supplier.id },
    { name: 'Butterfly Back (Silver)', type: 'finding', unit: 'pair', pricePerUnit: 45, supplierId: supplier.id },
    { name: 'Lobster Clasp (Gold)', type: 'clasp', unit: 'piece', pricePerUnit: 350, supplierId: supplier.id },
    { name: 'Lobster Clasp (Silver)', type: 'clasp', unit: 'piece', pricePerUnit: 65, supplierId: supplier.id },
    { name: 'Box Chain 1mm (18kt)', type: 'chain', unit: 'cm', pricePerUnit: 95, supplierId: supplier.id },
    { name: 'Rope Chain 2mm (18kt)', type: 'chain', unit: 'cm', pricePerUnit: 145, supplierId: supplier.id },
    { name: 'Prong Setting 4-claw', type: 'setting', unit: 'piece', pricePerUnit: 450, supplierId: supplier.id },
    { name: 'Bezel Setting', type: 'setting', unit: 'piece', pricePerUnit: 550, supplierId: supplier.id },
  ];

  for (const material of materials) {
    await prisma.material.upsert({
      where: { id: `sample-${material.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `sample-${material.name.toLowerCase().replace(/\s+/g, '-')}`,
        ...material,
        currency: 'ZAR',
      },
    });
  }
  console.log('✅ Sample materials created');

  // Create sample customer
  const customer = await prisma.customer.upsert({
    where: { id: 'sample-customer' },
    update: {},
    create: {
      id: 'sample-customer',
      name: 'Jane Doe',
      company: 'Sample Company',
      email: 'jane@example.com',
      phone: '+27 82 123 4567',
      address: '456 Customer Ave, Cape Town',
      notes: 'Sample customer for demonstration',
    },
  });
  console.log('✅ Sample customer created');

  console.log('\n🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });