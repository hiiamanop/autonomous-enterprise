export type ConflictStatus = 'DETECTED' | 'RESOLVED' | 'ESCALATED';

export interface ConflictParty {
  name: string;
  decision: string;
  trustScore?: number;
}

export interface ConflictLog {
  id: string;
  workflowId?: string;
  partyA: ConflictParty;
  partyB: ConflictParty;
  status: ConflictStatus;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface ConflictResolutionResult {
  conflict: ConflictLog;
  resolved: boolean;
  winningParty?: string;
  escalated: boolean;
  ticketId?: string;
}
