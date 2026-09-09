import { Injectable } from '@nestjs/common';
import type { SalesRep } from '@autonomous-enterprise/contracts';
import type { ISalesRepRepository } from '../domain/sales-rep.repository.interface';

@Injectable()
export class InMemorySalesRepRepository implements ISalesRepRepository {
  private readonly reps: Map<string, SalesRep> = new Map();

  async create(rep: SalesRep): Promise<SalesRep> {
    this.reps.set(rep.id, { ...rep });
    return { ...rep };
  }

  async findById(id: string): Promise<SalesRep | null> {
    const rep = this.reps.get(id);
    return rep ? { ...rep } : null;
  }

  async findAll(): Promise<SalesRep[]> {
    return Array.from(this.reps.values()).map((r) => ({ ...r }));
  }

  async update(rep: SalesRep): Promise<SalesRep> {
    if (!this.reps.has(rep.id)) {
      throw new Error(`Sales rep ${rep.id} not found`);
    }
    this.reps.set(rep.id, { ...rep });
    return { ...rep };
  }
}
