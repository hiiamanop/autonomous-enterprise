import type { SalesRep } from '@autonomous-enterprise/contracts';

export const SALES_REP_REPOSITORY = Symbol('SALES_REP_REPOSITORY');

export interface ISalesRepRepository {
  create(rep: SalesRep): Promise<SalesRep>;
  findById(id: string): Promise<SalesRep | null>;
  findAll(): Promise<SalesRep[]>;
  update(rep: SalesRep): Promise<SalesRep>;
}
