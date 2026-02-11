import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@jeweller.local' },
    update: {},
    create: {
      email: 'admin@jeweller.local',
      password: hashedPassword,
      name: 'Admin User',
    },
  });
  console.log('✅ Admin user created');

  // Create suppliers with fixed IDs
  const ajantaId = 'supplier-ajanta';
  const dawidId = 'supplier-dawid';
  const intercolourId = 'supplier-intercolour';
  const goldSilverId = 'supplier-goldsilver';

  await prisma.supplier.upsert({
    where: { id: ajantaId },
    update: {},
    create: {
      id: ajantaId,
      name: 'Ajanta Afrika',
      email: 'gems@ajanta.co.za',
      phone: '+27 11 334 1988',
      website: 'https://ajantaafrika.com',
      notes: 'Diamonds, coloured gemstones, black diamonds. Trade only.',
    },
  });

  await prisma.supplier.upsert({
    where: { id: dawidId },
    update: {},
    create: {
      id: dawidId,
      name: 'Dawid Steyn',
      email: 'info@dawidsteyn.co.za',
      phone: '+27 11 334 2000',
      notes: 'Findings, settings, chains. Johannesburg based.',
    },
  });

  await prisma.supplier.upsert({
    where: { id: intercolourId },
    update: {},
    create: {
      id: intercolourId,
      name: 'Intercolour',
      email: 'sales@intercolour.co.za',
      phone: '+27 11 334 3000',
      notes: 'Coloured gemstones, semi-precious stones.',
    },
  });

  await prisma.supplier.upsert({
    where: { id: goldSilverId },
    update: {},
    create: {
      id: goldSilverId,
      name: 'SA Gold & Silver',
      email: 'orders@goldsmith.co.za',
      phone: '+27 11 334 4000',
      notes: 'Precious metals - gold, silver, platinum.',
    },
  });
  console.log('✅ Suppliers created');

  // Create supplier resources using relation syntax
  const blackDiamondResourceId = 'resource-black-diamond';
  const findingsResourceId = 'resource-findings';
  const gemstonesResourceId = 'resource-gemstones';
  const chainsResourceId = 'resource-chains';

  await prisma.supplierResource.upsert({
    where: { id: blackDiamondResourceId },
    update: {},
    create: {
      id: blackDiamondResourceId,
      supplier: { connect: { id: ajantaId } },
      name: 'Black Diamond Round Price List',
      category: 'diamonds',
      fileName: 'Black Diamond Round Price List – Ajanta Afrika.html',
      fileType: 'html',
      filePath: '/uploads/black-diamond-pricelist.html',
      fileSize: 45000,
      notes: 'Black diamond round and rosecut prices. Prices in USD per carat.',
    },
  });

  await prisma.supplierResource.upsert({
    where: { id: findingsResourceId },
    update: {},
    create: {
      id: findingsResourceId,
      supplier: { connect: { id: dawidId } },
      name: 'Findings Price List 2022',
      category: 'findings',
      fileName: 'Dawid Steyn Price List 2022.pdf',
      fileType: 'pdf',
      filePath: '/uploads/findings-pricelist.pdf',
      fileSize: 250000,
      notes: 'Gold findings - posts, backs, clasps, bails, settings.',
    },
  });

  await prisma.supplierResource.upsert({
    where: { id: gemstonesResourceId },
    update: {},
    create: {
      id: gemstonesResourceId,
      supplier: { connect: { id: intercolourId } },
      name: 'Intercolour Gemstones 2025',
      category: 'gemstones',
      fileName: '2025 Intercolour Pricelist.pdf',
      fileType: 'pdf',
      filePath: '/uploads/gemstones-pricelist.pdf',
      fileSize: 180000,
      notes: 'Coloured gemstones - rubies, sapphires, emeralds, semi-precious.',
    },
  });

  await prisma.supplierResource.upsert({
    where: { id: chainsResourceId },
    update: {},
    create: {
      id: chainsResourceId,
      supplier: { connect: { id: dawidId } },
      name: 'Silver Chains Price List Sept 2025',
      category: 'chains',
      fileName: 'Silver Chains Price List - SEPT 2025.xlsx',
      fileType: 'xlsx',
      filePath: '/uploads/chains-pricelist.xlsx',
      fileSize: 85000,
      notes: 'Sterling silver chains - various styles and lengths.',
    },
  });
  console.log('✅ Supplier resources created');

  // Black Diamond Round prices from Ajanta Afrika (parsed from HTML)
  const blackDiamondRound = [
    { size: '0.9', pricePerCt: 220, approxWeight: 0.005 },
    { size: '1.0', pricePerCt: 295, approxWeight: 0.006 },
    { size: '1.1', pricePerCt: 220, approxWeight: 0.007 },
    { size: '1.2', pricePerCt: 220, approxWeight: 0.009 },
    { size: '1.3', pricePerCt: 200, approxWeight: 0.011 },
    { size: '1.4', pricePerCt: 250, approxWeight: 0.014 },
    { size: '1.5', pricePerCt: 250, approxWeight: 0.016 },
    { size: '1.6', pricePerCt: 240, approxWeight: 0.019 },
    { size: '1.7', pricePerCt: 240, approxWeight: 0.022 },
    { size: '1.8', pricePerCt: 240, approxWeight: 0.026 },
    { size: '1.9', pricePerCt: 220, approxWeight: 0.03 },
    { size: '2.0', pricePerCt: 220, approxWeight: 0.038 },
    { size: '2.3', pricePerCt: 220, approxWeight: 0.05 },
    { size: '2.4', pricePerCt: 200, approxWeight: 0.063 },
    { size: '2.5', pricePerCt: 160, approxWeight: 0.066 },
    { size: '3.0', pricePerCt: 220, approxWeight: 0.12 },
    { size: '3.5', pricePerCt: 200, approxWeight: 0.21 },
    { size: '4.0', pricePerCt: 220, approxWeight: 0.27 },
    { size: '4.5', pricePerCt: 200, approxWeight: 0.42 },
    { size: '5.0', pricePerCt: 180, approxWeight: 0.61 },
  ];

  // Create Black Diamond components
  for (const diamond of blackDiamondRound) {
    const id = `comp-bldi-rd-${diamond.size.replace('.', '')}`;
    await prisma.component.upsert({
      where: { id },
      update: { priceUsd: diamond.pricePerCt },
      create: {
        id,
        supplier: { connect: { id: ajantaId } },
        resource: { connect: { id: blackDiamondResourceId } },
        name: `Black Diamond Round ${diamond.size}mm`,
        sku: `BLDI-RD-${diamond.size}`,
        category: 'diamonds',
        subCategory: 'black-diamond',
        unit: 'carat',
        priceUsd: diamond.pricePerCt,
        size: `${diamond.size}mm`,
        quality: 'Commercial',
      },
    });
  }
  console.log('✅ Black Diamond components created');

  // Sample findings
  const findings = [
    { name: 'Earring Post - 9kt Yellow Gold', sku: 'EP-9KY', priceZar: 85, unit: 'pair' },
    { name: 'Earring Post - 18kt Yellow Gold', sku: 'EP-18KY', priceZar: 165, unit: 'pair' },
    { name: 'Butterfly Back - 9kt Yellow Gold', sku: 'BB-9KY', priceZar: 45, unit: 'pair' },
    { name: 'Butterfly Back - 18kt Yellow Gold', sku: 'BB-18KY', priceZar: 95, unit: 'pair' },
    { name: 'Lobster Clasp - 9kt Yellow Gold 10mm', sku: 'LC-9KY-10', priceZar: 120, unit: 'each' },
    { name: 'Lobster Clasp - 18kt Yellow Gold 10mm', sku: 'LC-18KY-10', priceZar: 245, unit: 'each' },
    { name: 'Jump Ring - 9kt Yellow Gold 4mm', sku: 'JR-9KY-4', priceZar: 15, unit: 'each' },
    { name: 'Bail - 9kt Yellow Gold Small', sku: 'BAIL-9KY-S', priceZar: 85, unit: 'each' },
    { name: 'Pendant Setting - 4 Claw 5mm', sku: 'PS-4C-5', priceZar: 225, unit: 'each' },
    { name: 'Ring Setting - Solitaire 5mm', sku: 'RS-SOL-5', priceZar: 525, unit: 'each' },
  ];

  for (const finding of findings) {
    const id = `comp-${finding.sku.toLowerCase()}`;
    await prisma.component.upsert({
      where: { id },
      update: { priceZar: finding.priceZar },
      create: {
        id,
        supplier: { connect: { id: dawidId } },
        resource: { connect: { id: findingsResourceId } },
        name: finding.name,
        sku: finding.sku,
        category: 'findings',
        unit: finding.unit,
        priceZar: finding.priceZar,
      },
    });
  }
  console.log('✅ Findings components created');

  // Sample gemstones
  const gemstones = [
    { name: 'Ruby Round 4mm', sku: 'RUBY-RD-4', priceUsd: 85, size: '4mm' },
    { name: 'Ruby Round 5mm', sku: 'RUBY-RD-5', priceUsd: 165, size: '5mm' },
    { name: 'Sapphire Blue Round 4mm', sku: 'SAPH-BL-RD-4', priceUsd: 65, size: '4mm' },
    { name: 'Sapphire Blue Round 5mm', sku: 'SAPH-BL-RD-5', priceUsd: 125, size: '5mm' },
    { name: 'Emerald Round 4mm', sku: 'EMER-RD-4', priceUsd: 110, size: '4mm' },
    { name: 'Emerald Round 5mm', sku: 'EMER-RD-5', priceUsd: 220, size: '5mm' },
    { name: 'Amethyst Round 5mm', sku: 'AMET-RD-5', priceUsd: 12, size: '5mm' },
    { name: 'Tanzanite Round 5mm', sku: 'TANZ-RD-5', priceUsd: 165, size: '5mm' },
    { name: 'Morganite Round 6mm', sku: 'MORG-RD-6', priceUsd: 55, size: '6mm' },
    { name: 'Aquamarine Round 5mm', sku: 'AQUA-RD-5', priceUsd: 45, size: '5mm' },
  ];

  for (const gem of gemstones) {
    const id = `comp-${gem.sku.toLowerCase()}`;
    await prisma.component.upsert({
      where: { id },
      update: { priceUsd: gem.priceUsd },
      create: {
        id,
        supplier: { connect: { id: intercolourId } },
        resource: { connect: { id: gemstonesResourceId } },
        name: gem.name,
        sku: gem.sku,
        category: 'gemstones',
        unit: 'each',
        priceUsd: gem.priceUsd,
        size: gem.size,
        quality: 'AA',
      },
    });
  }
  console.log('✅ Gemstone components created');

  // Sample chains
  const chains = [
    { name: 'Curb Chain Sterling Silver 1.5mm 45cm', sku: 'CH-CURB-SS-1.5-45', priceZar: 185 },
    { name: 'Box Chain Sterling Silver 1mm 45cm', sku: 'CH-BOX-SS-1-45', priceZar: 165 },
    { name: 'Rope Chain Sterling Silver 1.5mm 45cm', sku: 'CH-ROPE-SS-1.5-45', priceZar: 245 },
    { name: 'Snake Chain Sterling Silver 1mm 45cm', sku: 'CH-SNAKE-SS-1-45', priceZar: 175 },
    { name: 'Figaro Chain Sterling Silver 2mm 45cm', sku: 'CH-FIG-SS-2-45', priceZar: 235 },
  ];

  for (const chain of chains) {
    const id = `comp-${chain.sku.toLowerCase().replace(/\./g, '')}`;
    await prisma.component.upsert({
      where: { id },
      update: { priceZar: chain.priceZar },
      create: {
        id,
        supplier: { connect: { id: dawidId } },
        resource: { connect: { id: chainsResourceId } },
        name: chain.name,
        sku: chain.sku,
        category: 'chains',
        unit: 'each',
        priceZar: chain.priceZar,
      },
    });
  }
  console.log('✅ Chain components created');

  // Create materials (metals) - using pricePerUnit as per schema
  const materials = [
    { id: 'mat-9kt-yellow', name: '9kt Yellow Gold', type: 'gold', pricePerUnit: 450 },
    { id: 'mat-9kt-white', name: '9kt White Gold', type: 'gold', pricePerUnit: 480 },
    { id: 'mat-9kt-rose', name: '9kt Rose Gold', type: 'gold', pricePerUnit: 460 },
    { id: 'mat-14kt-yellow', name: '14kt Yellow Gold', type: 'gold', pricePerUnit: 720 },
    { id: 'mat-14kt-white', name: '14kt White Gold', type: 'gold', pricePerUnit: 750 },
    { id: 'mat-18kt-yellow', name: '18kt Yellow Gold', type: 'gold', pricePerUnit: 950 },
    { id: 'mat-18kt-white', name: '18kt White Gold', type: 'gold', pricePerUnit: 1000 },
    { id: 'mat-18kt-rose', name: '18kt Rose Gold', type: 'gold', pricePerUnit: 960 },
    { id: 'mat-silver-925', name: 'Sterling Silver 925', type: 'silver', pricePerUnit: 18 },
    { id: 'mat-platinum-950', name: 'Platinum 950', type: 'platinum', pricePerUnit: 1450 },
  ];

  for (const mat of materials) {
    await prisma.material.upsert({
      where: { id: mat.id },
      update: { pricePerUnit: mat.pricePerUnit },
      create: {
        id: mat.id,
        name: mat.name,
        type: mat.type,
        pricePerUnit: mat.pricePerUnit,
        unit: 'gram',
      },
    });
  }
  console.log('✅ Materials created');

  // Create sample customer
  const customerId = 'customer-sample';
  await prisma.customer.upsert({
    where: { id: customerId },
    update: {},
    create: {
      id: customerId,
      name: 'Sample Customer',
      email: 'sample@customer.com',
      phone: '+27 82 123 4567',
      notes: 'Sample customer for testing',
    },
  });
  console.log('✅ Sample customer created');

  // Create settings
  const defaultSettings = [
    { key: 'labour_rate_per_hour', value: '450', description: 'Default labour rate per hour in ZAR' },
    { key: 'default_markup_percentage', value: '50', description: 'Default markup percentage for quotes' },
    { key: 'vat_percentage', value: '15', description: 'VAT percentage' },
    { key: 'currency', value: 'ZAR', description: 'Base currency' },
    { key: 'company_name', value: 'Jeweller Studio', description: 'Company name for quotes' },
    { key: 'company_email', value: 'info@jeweller.local', description: 'Company email' },
    { key: 'company_phone', value: '+27 11 000 0000', description: 'Company phone' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log('✅ Settings created');

  // Summary
  const counts = {
    suppliers: await prisma.supplier.count(),
    resources: await prisma.supplierResource.count(),
    components: await prisma.component.count(),
    materials: await prisma.material.count(),
    customers: await prisma.customer.count(),
  };

  console.log('');
  console.log('📊 Database Summary:');
  console.log(`   - Suppliers: ${counts.suppliers}`);
  console.log(`   - Resources: ${counts.resources}`);
  console.log(`   - Components: ${counts.components}`);
  console.log(`   - Materials: ${counts.materials}`);
  console.log(`   - Customers: ${counts.customers}`);
  console.log('');
  console.log('🎉 Database seed completed successfully!');

  await prisma.$disconnect();
}

// Run if called directly
seedDatabase().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});