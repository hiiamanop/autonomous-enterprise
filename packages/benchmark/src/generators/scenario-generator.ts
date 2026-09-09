export const SCENARIO_CATEGORIES = ['BASELINE_ORDER', 'FLASH_SALE_BURST', 'SUPPLIER_DISRUPTION', 'BUDGET_EXHAUSTION', 'MULTI_AGENT_CONFLICT', 'ENTERPRISE_SAGA_MACRO', 'MULTI_WAY_CONFLICT'] as const;
export type ScenarioCategory = typeof SCENARIO_CATEGORIES[number];

export interface BenchmarkScenario {
  id: string;
  category: ScenarioCategory;
  name: string;
  orderVolume: number;
  concurrency: number;
  stockUnits: number;
  supplierReliability: number;
  aiBudget: number;
  domains: string[];
  contention: number;
}

const templates: Record<ScenarioCategory, Omit<BenchmarkScenario, 'id' | 'category'>> = {
  BASELINE_ORDER: { name: 'Normal order flow', orderVolume: 100, concurrency: 5, stockUnits: 500, supplierReliability: 1, aiBudget: 100, domains: ['Sales', 'Inventory'], contention: 0.05 },
  FLASH_SALE_BURST: { name: 'Flash sale burst', orderVolume: 2000, concurrency: 500, stockUnits: 800, supplierReliability: 1, aiBudget: 100, domains: ['Sales', 'Inventory', 'Finance'], contention: 0.95 },
  SUPPLIER_DISRUPTION: { name: 'Supplier disruption', orderVolume: 300, concurrency: 20, stockUnits: 80, supplierReliability: 0.1, aiBudget: 100, domains: ['Procurement', 'Inventory', 'Sales'], contention: 0.45 },
  BUDGET_EXHAUSTION: { name: 'Nearly exhausted AI budget', orderVolume: 250, concurrency: 25, stockUnits: 400, supplierReliability: 0.9, aiBudget: 2, domains: ['Sales', 'Finance'], contention: 0.2 },
  MULTI_AGENT_CONFLICT: { name: 'Cross-domain policy deadlock', orderVolume: 450, concurrency: 45, stockUnits: 300, supplierReliability: 0.8, aiBudget: 100, domains: ['Sales', 'Inventory', 'Finance', 'HR'], contention: 0.8 },
  ENTERPRISE_SAGA_MACRO: { name: 'Enterprise Saga Macro: Flash Sale', orderVolume: 5000, concurrency: 1000, stockUnits: 1200, supplierReliability: 0.75, aiBudget: 25, domains: ['Sales', 'Inventory', 'Procurement', 'Finance', 'HRIS', 'Accounting', 'Infrastructure Scaling', 'Ticketing'], contention: 0.98 },
  MULTI_WAY_CONFLICT: { name: 'Four-way domain conflict', orderVolume: 650, concurrency: 100, stockUnits: 350, supplierReliability: 0.7, aiBudget: 20, domains: ['Sales', 'Inventory', 'Finance', 'HRIS'], contention: 0.95 }
};

export function generateScenarios(perCategory = 3, seed = 42): BenchmarkScenario[] {
  if (!Number.isInteger(perCategory) || perCategory < 1) throw new Error('perCategory must be a positive integer');
  return SCENARIO_CATEGORIES.flatMap((category, categoryIndex) => Array.from({ length: perCategory }, (_, variant) => {
    const template = templates[category];
    const factor = 1 + (((seed + categoryIndex * 17 + variant * 7) % 11) - 5) / 100;
    return { ...template, id: `${category.toLowerCase()}-${variant + 1}`, category, orderVolume: Math.round(template.orderVolume * factor), concurrency: Math.max(1, Math.round(template.concurrency * factor)), stockUnits: Math.max(1, Math.round(template.stockUnits * factor)), aiBudget: Math.max(0, Number((template.aiBudget * (1 + variant / 20)).toFixed(2))) };
  }));
}
