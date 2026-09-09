import type { Customer } from '@autonomous-enterprise/contracts';

export interface ICustomerRepository {
  create(customer: Customer): Promise<Customer>;
  findById(id: string): Promise<Customer | null>;
  findAll(): Promise<Customer[]>;
}

export const CUSTOMER_REPOSITORY = 'CUSTOMER_REPOSITORY';
