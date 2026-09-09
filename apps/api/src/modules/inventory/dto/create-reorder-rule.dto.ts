export class CreateReorderRuleDto {
  warehouseId!: string;
  productId!: string;
  minQuantity!: number;
  reorderQuantity!: number;
}
