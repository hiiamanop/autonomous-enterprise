import { Injectable } from '@nestjs/common';
import type { Customer } from '@autonomous-enterprise/contracts';
import type { ICustomerRepository } from '../domain/customer.repository.interface';

@Injectable()
export class InMemoryCustomerRepository implements ICustomerRepository {
  private readonly customers: Map<string, Customer> = new Map();

  async create(customer: Customer): Promise<Customer> {
    this.customers.set(customer.id, { ...customer });
    return { ...customer };
  }

  async findById(id: string): Promise<Customer | null> {
    const customer = this.customers.get(id);
    return customer ? { ...customer } : null;
  }

  async findAll(): Promise<Customer[]> {
    return Array.from(this.customers.values()).map((c) => ({ ...c }));
  }
}
