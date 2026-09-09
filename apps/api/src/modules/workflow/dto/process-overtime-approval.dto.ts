export class ProcessOvertimeApprovalDto {
  overtimeRequestId!: string;
  employeeId!: string;
  budgetId?: string;
  hrisUrgentFlag?: boolean;
  financeBudgetBreachedFlag?: boolean;
}
