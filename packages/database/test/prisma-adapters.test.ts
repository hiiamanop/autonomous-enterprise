import { describe, it, expect, vi } from 'vitest';
import { PrismaCustomerRepository } from '../src/adapters/prisma-customer.repository';
import { PrismaSalesOrderRepository } from '../src/adapters/prisma-sales-order.repository';
import { PrismaInventoryRepository } from '../src/adapters/prisma-inventory.repository';
import { SalesOrderStatus, SalesChannel } from '@autonomous-enterprise/contracts';

describe('Prisma Repository Adapters - Single Enterprise Contracts', () => {
  describe('PrismaCustomerRepository', () => {
    it('creates and finds customer by id', async () => {
      const mockPrisma = {
        customer: {
          create: vi.fn().mockResolvedValue({
            id: 'cust-1',
            name: 'Acme Corp',
            email: 'contact@acme.com',
            phone: null,
            address: null,
            createdAt: new Date('2026-09-02T10:00:00Z'),
            updatedAt: new Date('2026-09-02T10:00:00Z')
          }),
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.id === 'cust-1') {
              return Promise.resolve({
                id: 'cust-1',
                name: 'Acme Corp',
                email: 'contact@acme.com',
                phone: null,
                address: null,
                createdAt: new Date('2026-09-02T10:00:00Z'),
                updatedAt: new Date('2026-09-02T10:00:00Z')
              });
            }
            return Promise.resolve(null);
          })
        }
      } as any;

      const repo = new PrismaCustomerRepository(mockPrisma);

      const created = await repo.create({
        id: 'cust-1',
        name: 'Acme Corp',
        email: 'contact@acme.com',
        createdAt: '2026-09-02T10:00:00Z',
        updatedAt: '2026-09-02T10:00:00Z'
      });
      expect(created.name).toBe('Acme Corp');

      const found = await repo.findById('cust-1');
      expect(found).not.toBeNull();
      expect(found?.email).toBe('contact@acme.com');

      const notFound = await repo.findById('cust-999');
      expect(notFound).toBeNull();
    });
  });

  describe('PrismaSalesOrderRepository', () => {
    it('creates and queries orders with items', async () => {
      const mockPrisma = {
        salesOrder: {
          create: vi.fn().mockResolvedValue({
            id: 'so-1',
            customerId: 'cust-1',
            orderNumber: 'SO-1001',
            subtotal: 100,
            discountAmount: 10,
            totalAmount: 90,
            status: 'DRAFT',
            idempotencyKey: 'idem-1',
            notes: null,
            createdAt: new Date('2026-09-02T10:00:00Z'),
            updatedAt: new Date('2026-09-02T10:00:00Z'),
            items: [
              {
                id: 'item-1',
                salesOrderId: 'so-1',
                productId: 'prod-1',
                quantity: 2,
                unitPrice: 50,
                discount: 10,
                totalPrice: 90
              }
            ]
          }),
          findFirst: vi.fn().mockImplementation(({ where }) => {
            if (where.idempotencyKey === 'idem-1') {
              return Promise.resolve({
                id: 'so-1',
                customerId: 'cust-1',
                orderNumber: 'SO-1001',
                subtotal: 100,
                discountAmount: 10,
                totalAmount: 90,
                status: 'DRAFT',
                idempotencyKey: 'idem-1',
                notes: null,
                createdAt: new Date('2026-09-02T10:00:00Z'),
                updatedAt: new Date('2026-09-02T10:00:00Z'),
                items: []
              });
            }
            return Promise.resolve(null);
          })
        }
      } as any;

      const repo = new PrismaSalesOrderRepository(mockPrisma);

      const created = await repo.create({
        id: 'so-1',
        customerId: 'cust-1',
        orderNumber: 'SO-1001',
        channel: SalesChannel.MARKETPLACE,
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 2,
            unitPrice: 50,
            discount: 10,
            totalPrice: 90
          }
        ],
        subtotal: 100,
        discountAmount: 10,
        totalAmount: 90,
        status: SalesOrderStatus.DRAFT,
        idempotencyKey: 'idem-1',
        createdAt: '2026-09-02T10:00:00Z',
        updatedAt: '2026-09-02T10:00:00Z'
      });

      expect(created.id).toBe('so-1');
      expect(created.totalAmount).toBe(90);

      const foundByIdem = await repo.findByIdempotencyKey('idem-1');
      expect(foundByIdem).not.toBeNull();
      expect(foundByIdem?.orderNumber).toBe('SO-1001');
    });
  });

  describe('PrismaInventoryRepository', () => {
    it('saves and finds stock reservations', async () => {
      const mockPrisma = {
        stockReservation: {
          upsert: vi.fn().mockResolvedValue({
            id: 'res-1',
            warehouseId: 'wh-1',
            productId: 'prod-1',
            quantity: 5,
            status: 'PENDING',
            idempotencyKey: 'idem-res-1',
            expiresAt: null,
            createdAt: new Date('2026-09-02T10:00:00Z'),
            updatedAt: new Date('2026-09-02T10:00:00Z')
          }),
          findUnique: vi.fn().mockResolvedValue({
            id: 'res-1',
            warehouseId: 'wh-1',
            productId: 'prod-1',
            quantity: 5,
            status: 'PENDING',
            idempotencyKey: 'idem-res-1',
            expiresAt: null,
            createdAt: new Date('2026-09-02T10:00:00Z'),
            updatedAt: new Date('2026-09-02T10:00:00Z')
          })
        }
      } as any;

      const repo = new PrismaInventoryRepository(mockPrisma);

      const saved = await repo.saveReservation({
        id: 'res-1',
        warehouseId: 'wh-1',
        productId: 'prod-1',
        quantity: 5,
        status: 'PENDING',
        idempotencyKey: 'idem-res-1',
        createdAt: '2026-09-02T10:00:00Z',
        updatedAt: '2026-09-02T10:00:00Z'
      });

      expect(saved.id).toBe('res-1');
      expect(saved.quantity).toBe(5);

      const found = await repo.findReservationById('res-1');
      expect(found?.warehouseId).toBe('wh-1');
    });
  });
});
