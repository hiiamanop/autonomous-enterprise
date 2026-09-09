import type { Customer } from '@autonomous-enterprise/contracts';
import type { PrismaClient, Customer as PrismaCustomer } from '@prisma/client';

export interface ICustomerRepository {
  create(customer: Customer): Promise<Customer>;
  findById(id: string): Promise<Customer | null>;
  findAll(): Promise<Customer[]>;
}

export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapToDomain(raw: PrismaCustomer): Customer {
    return {
      id: raw.id,
      name: raw.name,
      email: raw.email,
      phone: raw.phone ?? undefined,
      address: raw.address ?? undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString()
    };
  }

  async create(customer: Customer): Promise<Customer> {
    const created = await this.prisma.customer.create({
      data: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        createdAt: customer.createdAt ? new Date(customer.createdAt) : undefined,
        updatedAt: customer.updatedAt ? new Date(customer.updatedAt) : undefined
      }
    });

    return this.mapToDomain(created);
  }

  async findById(id: string): Promise<Customer | null> {
    const found = await this.prisma.customer.findUnique({
      where: { id }
    });

    return found ? this.mapToDomain(found) : null;
  }

  async findAll(): Promise<Customer[]> {
    const customers = await this.prisma.customer.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return customers.map((c) => this.mapToDomain(c));
  }
}
