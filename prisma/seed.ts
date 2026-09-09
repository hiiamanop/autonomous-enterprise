import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = 'tenant-demo-001';

  console.log(`Seeding minimal database data for tenant: ${tenantId}...`);

  // Seed Customer
  const customer = await prisma.customer.upsert({
    where: { id: 'cust-001' },
    update: { tenantId },
    create: {
      id: 'cust-001',
      tenantId,
      name: 'Acme Corp',
      email: 'contact@acme.example.com',
      phone: '+1-555-0199',
      address: '123 Enterprise Way, Tech City'
    }
  });

  // Seed Product
  const product = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId, sku: 'WDG-001' } },
    update: {},
    create: {
      id: 'prod-001',
      tenantId,
      sku: 'WDG-001',
      name: 'Enterprise Widget A',
      description: 'High-performance widget for enterprise workloads',
      price: 150.0
    }
  });

  // Seed Warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId, code: 'WH-MAIN' } },
    update: {},
    create: {
      id: 'wh-001',
      tenantId,
      code: 'WH-MAIN',
      name: 'Primary Fulfillment Center',
      location: 'Building 4, Logistics Park'
    }
  });

  // Seed Stock
  await prisma.stock.upsert({
    where: {
      tenantId_warehouseId_productId: {
        tenantId,
        warehouseId: warehouse.id,
        productId: product.id
      }
    },
    update: {
      quantity: 100,
      reservedQuantity: 0,
      availableQuantity: 100
    },
    create: {
      id: 'stock-001',
      tenantId,
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 100,
      reservedQuantity: 0,
      availableQuantity: 100
    }
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
