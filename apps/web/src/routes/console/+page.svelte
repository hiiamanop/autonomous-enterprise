<script lang="ts">
  /**
   * Operator Console.
   *
   * Every other page in this app is read-only. This one is the write surface:
   * each tab exposes the real write endpoints of one business module, submits
   * against the live API, reads the record back, and shows the resulting
   * platform activity in a live trace so an input can be followed end to end.
   */
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import ModuleForm from '$lib/ModuleForm.svelte';
  import DataTable from '$lib/DataTable.svelte';
  import TraceStream from '$lib/TraceStream.svelte';

  type Tab =
    | 'sales'
    | 'inventory'
    | 'hris'
    | 'finance'
    | 'accounting'
    | 'procurement'
    | 'ticketing'
    | 'knowledge'
    | 'infrastructure'
    | 'orchestrator';

  const TABS: Array<{ key: Tab; label: string; icon: string; blurb: string }> = [
    { key: 'sales', label: 'Sales', icon: '🛍️', blurb: 'Customers, orders and lead outcomes' },
    { key: 'inventory', label: 'Inventory', icon: '📦', blurb: 'Products, warehouses, stock and reservations' },
    { key: 'hris', label: 'HRIS', icon: '👥', blurb: 'Workforce, overtime and capacity assessment' },
    { key: 'finance', label: 'Finance', icon: '💰', blurb: 'Cost centres, budgets and expenses' },
    { key: 'accounting', label: 'Accounting', icon: '📒', blurb: 'Ledger, journals, invoices and payments' },
    { key: 'procurement', label: 'Procurement', icon: '🚚', blurb: 'Suppliers, requests and purchase orders' },
    { key: 'ticketing', label: 'Ticketing', icon: '🎫', blurb: 'Human-in-the-loop escalations' },
    { key: 'knowledge', label: 'Knowledge', icon: '📚', blurb: 'RAG corpus the agents retrieve from' },
    { key: 'infrastructure', label: 'Infrastructure', icon: '🖥️', blurb: 'Kubernetes scaling requests' },
    { key: 'orchestrator', label: 'Orchestrator', icon: '🧠', blurb: 'Give an AI agent a goal to execute' }
  ];

  let activeTab = $state<Tab>('sales');

  // Reference data, loaded once and refreshed after writes so that select
  // inputs always offer IDs that actually exist. Submitting a hand-typed ID is
  // the most common cause of a 400 from these endpoints.
  let customers = $state<any[]>([]);
  let products = $state<any[]>([]);
  let warehouses = $state<any[]>([]);
  let orders = $state<any[]>([]);
  let reservations = $state<any[]>([]);
  let departments = $state<any[]>([]);
  let employees = $state<any[]>([]);
  let overtime = $state<any[]>([]);
  let budgets = $state<any[]>([]);
  let costCenters = $state<any[]>([]);
  let expenses = $state<any[]>([]);
  let accounts = $state<any[]>([]);
  let journals = $state<any[]>([]);
  let invoices = $state<any[]>([]);
  let payments = $state<any[]>([]);
  let suppliers = $state<any[]>([]);
  let purchaseRequests = $state<any[]>([]);
  let purchaseOrders = $state<any[]>([]);
  let tickets = $state<any[]>([]);
  let documents = $state<any[]>([]);
  let scalingEvents = $state<any[]>([]);
  let cluster = $state<any>(null);
  let agents = $state<any[]>([]);

  let loading = $state(false);

  const opt = (rows: any[], labelFn: (r: any) => string) =>
    (rows ?? []).map((r) => ({ value: r.id, label: labelFn(r) }));

  async function refreshAll() {
    loading = true;
    const results = await Promise.allSettled([
      api.listCustomers(),
      api.listProducts(),
      api.listWarehouses(),
      api.listSalesOrders(),
      api.listStockReservations(),
      api.listDepartments(),
      api.listEmployees(),
      api.listOvertime(),
      api.listBudgets(),
      api.listCostCenters(),
      api.listExpenses(),
      api.listChartOfAccounts(),
      api.listJournals(),
      api.listInvoices(),
      api.listPayments(),
      api.listSuppliers(),
      api.listPurchaseRequests(),
      api.listPurchaseOrders(),
      api.listTickets(),
      api.listKnowledgeDocuments(),
      api.listScalingEvents(),
      api.getClusterSnapshot(),
      api.listAgents()
    ]);

    const val = (i: number) => {
      const r = results[i];
      return r.status === 'fulfilled' ? ((r.value as any)?.data ?? []) : [];
    };

    customers = val(0);
    products = val(1);
    warehouses = val(2);
    orders = val(3);
    reservations = val(4);
    departments = val(5);
    employees = val(6);
    overtime = val(7);
    budgets = val(8);
    costCenters = val(9);
    expenses = val(10);
    accounts = val(11);
    journals = val(12);
    invoices = val(13);
    payments = val(14);
    suppliers = val(15);
    purchaseRequests = val(16);
    purchaseOrders = val(17);
    tickets = val(18);
    documents = val(19);
    scalingEvents = val(20);
    cluster = results[21].status === 'fulfilled' ? ((results[21].value as any)?.data ?? null) : null;
    agents = val(22);

    loading = false;
  }

  onMount(refreshAll);

  const today = () => new Date().toISOString().slice(0, 10);

  // Trace filters, so each tab shows the events its own actions produce rather
  // than the whole firehose.
  const TRACE_FILTERS: Record<Tab, string[]> = {
    sales: ['SALES', 'ORDER', 'CUSTOMER', 'LEAD', 'FULFILL'],
    inventory: ['INVENTORY', 'STOCK', 'RESERV', 'PRODUCT', 'REPLENISH'],
    hris: ['HRIS', 'STAFF', 'OVERTIME', 'EMPLOYEE', 'DELIVERY', 'COURIER'],
    finance: ['FINANCE', 'BUDGET', 'EXPENSE', 'COST'],
    accounting: ['ACCOUNTING', 'JOURNAL', 'INVOICE', 'PAYMENT', 'POSTING'],
    procurement: ['PROCUREMENT', 'SUPPLIER', 'PURCHASE', 'GOODS'],
    ticketing: ['TICKET', 'ESCALAT', 'SLA', 'HUMAN'],
    knowledge: ['KNOWLEDGE', 'DOCUMENT', 'SEARCH', 'RAG'],
    infrastructure: ['INFRA', 'SCALING', 'CLUSTER', 'K8S'],
    orchestrator: ['ORCHESTRAT', 'AGENT', 'GOAL', 'WORKFLOW', 'CONFLICT']
  };
</script>

<svelte:head><title>Operator Console — Autonomous Enterprise</title></svelte:head>

<div class="console">
  <header class="page-header">
    <div>
      <h1 class="title">Operator Console</h1>
      <p class="subtitle">
        Submit real input to any business module and watch the platform react. Every form posts to
        the live API and writes to the database; the trace panel shows the resulting agent and
        workflow activity as it happens.
      </p>
    </div>
    <button class="refresh" onclick={refreshAll} disabled={loading}>
      {loading ? 'Loading…' : 'Refresh data'}
    </button>
  </header>

  <nav class="tabs">
    {#each TABS as tab (tab.key)}
      <button class="tab" class:active={activeTab === tab.key} onclick={() => (activeTab = tab.key)}>
        <span class="tab-icon">{tab.icon}</span>
        <span class="tab-label">{tab.label}</span>
      </button>
    {/each}
  </nav>

  <p class="tab-blurb">{TABS.find((t) => t.key === activeTab)?.blurb}</p>

  <div class="layout">
    <div class="work-area">
      {#if activeTab === 'sales'}
        <ModuleForm
          title="Create customer"
          description="A customer is required before any order can be placed."
          endpoint="POST /sales/customers"
          fields={[
            { name: 'name', label: 'Name', required: true, placeholder: 'Acme Retail' },
            { name: 'email', label: 'Email', required: true, placeholder: 'ops@acme.test' },
            { name: 'phone', label: 'Phone' },
            { name: 'address', label: 'Address' }
          ]}
          submitLabel="Create customer"
          onSubmit={(v) => api.createCustomer(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Place sales order"
          description="MARKETPLACE orders are auto-approved; DIRECT_SALES creates a lead a rep must close. This is the entry point of the fulfilment chain."
          endpoint="POST /sales/orders"
          disabled={customers.length === 0 || products.length === 0}
          disabledReason="Create at least one customer and one product first."
          fields={[
            {
              name: 'customerId',
              label: 'Customer',
              type: 'select',
              required: true,
              options: opt(customers, (c) => `${c.name} (${c.email})`)
            },
            {
              name: 'productId',
              label: 'Product',
              type: 'select',
              required: true,
              options: opt(products, (p) => `${p.sku} — ${p.name} ($${p.price})`)
            },
            { name: 'quantity', label: 'Quantity', type: 'number', required: true, initial: 2 },
            { name: 'unitPrice', label: 'Unit price (USD)', type: 'number', required: true, initial: 49.9 },
            {
              name: 'channel',
              label: 'Channel',
              type: 'select',
              options: [
                { value: 'MARKETPLACE', label: 'MARKETPLACE (auto-approved)' },
                { value: 'DIRECT_SALES', label: 'DIRECT_SALES (needs a rep)' }
              ]
            },
            { name: 'notes', label: 'Notes', type: 'textarea' }
          ]}
          submitLabel="Place order"
          onSubmit={(v) =>
            api.createSalesOrder({
              customerId: v.customerId,
              channel: v.channel,
              notes: v.notes,
              items: [{ productId: v.productId, quantity: v.quantity, unitPrice: v.unitPrice }]
            })}
          onSuccess={refreshAll}
        />

        <DataTable
          title="Sales orders"
          rows={orders}
          onRefresh={refreshAll}
          {loading}
          columns={[
            { key: 'orderNumber', label: 'Order', mono: true },
            { key: 'status', label: 'Status' },
            { key: 'channel', label: 'Channel' },
            { key: 'totalAmount', label: 'Total', render: (r) => `$${Number(r.totalAmount ?? 0).toFixed(2)}` },
            { key: 'createdAt', label: 'Created', render: (r) => new Date(r.createdAt).toLocaleTimeString() }
          ]}
        />
      {:else if activeTab === 'inventory'}
        <ModuleForm
          title="Create product"
          endpoint="POST /inventory/products"
          fields={[
            { name: 'sku', label: 'SKU', required: true, placeholder: 'SKU-WIDGET-A' },
            { name: 'name', label: 'Name', required: true, placeholder: 'Premium Widget A' },
            { name: 'price', label: 'Price (USD)', type: 'number', required: true, initial: 49.9 },
            { name: 'description', label: 'Description' }
          ]}
          submitLabel="Create product"
          onSubmit={(v) => api.createProduct(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Create warehouse"
          endpoint="POST /inventory/warehouses"
          fields={[
            { name: 'code', label: 'Code', required: true, placeholder: 'WH-MAIN' },
            { name: 'name', label: 'Name', required: true, placeholder: 'Main Distribution Bay' },
            { name: 'location', label: 'Location', placeholder: 'Jakarta' }
          ]}
          submitLabel="Create warehouse"
          onSubmit={(v) => api.createWarehouse(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Set stock level"
          description="Sets the absolute on-hand quantity and writes a movement ledger entry."
          endpoint="POST /inventory/stock"
          disabled={warehouses.length === 0 || products.length === 0}
          disabledReason="Create a warehouse and a product first."
          fields={[
            {
              name: 'warehouseId',
              label: 'Warehouse',
              type: 'select',
              required: true,
              options: opt(warehouses, (w) => `${w.code} — ${w.name}`)
            },
            {
              name: 'productId',
              label: 'Product',
              type: 'select',
              required: true,
              options: opt(products, (p) => `${p.sku} — ${p.name}`)
            },
            { name: 'quantity', label: 'Quantity', type: 'number', required: true, initial: 100 },
            { name: 'notes', label: 'Notes' }
          ]}
          submitLabel="Set stock"
          onSubmit={(v) => api.setStock(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Reserve stock"
          description="Fails when available quantity is insufficient — the check the fulfilment workflow relies on."
          endpoint="POST /inventory/reservations"
          disabled={warehouses.length === 0 || products.length === 0}
          disabledReason="Create a warehouse and a product first."
          fields={[
            {
              name: 'warehouseId',
              label: 'Warehouse',
              type: 'select',
              required: true,
              options: opt(warehouses, (w) => `${w.code} — ${w.name}`)
            },
            {
              name: 'productId',
              label: 'Product',
              type: 'select',
              required: true,
              options: opt(products, (p) => `${p.sku} — ${p.name}`)
            },
            { name: 'quantity', label: 'Quantity', type: 'number', required: true, initial: 5 }
          ]}
          submitLabel="Reserve"
          onSubmit={(v) => api.reserveStock(v as any)}
          onSuccess={refreshAll}
        />

        <DataTable
          title="Stock reservations"
          rows={reservations}
          onRefresh={refreshAll}
          {loading}
          columns={[
            { key: 'id', label: 'ID', mono: true },
            { key: 'quantity', label: 'Qty' },
            { key: 'status', label: 'Status' },
            { key: 'createdAt', label: 'Created', render: (r) => new Date(r.createdAt).toLocaleTimeString() }
          ]}
        />
      {:else if activeTab === 'hris'}
        <ModuleForm
          title="Create department"
          endpoint="POST /hris/departments"
          fields={[{ name: 'name', label: 'Name', required: true, placeholder: 'Warehouse Operations' }]}
          submitLabel="Create department"
          onSubmit={(v) => api.createDepartment(v.name)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Hire employee"
          description="Position determines the role classification: include 'Courier' or 'Warehouse' so capacity assessment counts them correctly."
          endpoint="POST /hris/employees"
          disabled={departments.length === 0}
          disabledReason="Create a department first."
          fields={[
            {
              name: 'departmentId',
              label: 'Department',
              type: 'select',
              required: true,
              options: opt(departments, (d) => d.name)
            },
            { name: 'fullName', label: 'Full name', required: true, placeholder: 'Budi Santoso' },
            { name: 'email', label: 'Email', required: true, placeholder: 'budi@company.test' },
            {
              name: 'position',
              label: 'Position',
              type: 'select',
              required: true,
              options: [
                { value: 'Warehouse Picker', label: 'Warehouse Picker' },
                { value: 'Warehouse Packer', label: 'Warehouse Packer' },
                { value: 'Courier', label: 'Courier' },
                { value: 'Supervisor', label: 'Supervisor' }
              ]
            },
            { name: 'hourlyRate', label: 'Hourly rate (USD)', type: 'number', required: true, initial: 8.5 }
          ]}
          submitLabel="Hire"
          onSubmit={(v) => api.createEmployee(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Run capacity assessment"
          description="The most agent-like action here: computes warehouse and courier utilisation, assigns couriers to unshipped orders, raises overtime when overloaded, and escalates a ticket when critical — all real writes."
          endpoint="POST /hris/departments/:id/assess-staffing"
          disabled={departments.length === 0}
          disabledReason="Create a department first."
          fields={[
            {
              name: 'departmentId',
              label: 'Department',
              type: 'select',
              required: true,
              options: opt(departments, (d) => d.name)
            },
            {
              name: 'pendingOrders',
              label: 'Pending orders',
              type: 'number',
              required: true,
              initial: 40,
              help: 'Raise this well above staff capacity to force an overload.'
            }
          ]}
          submitLabel="Assess staffing"
          onSubmit={(v) => {
            const readyToShip = (orders ?? [])
              .filter((o: any) => o.status === 'APPROVED')
              .map((o: any) => ({ orderId: o.id, orderNumber: o.orderNumber }));
            return api.assessStaffing(v.departmentId, {
              pendingOrders: v.pendingOrders,
              ordersReadyToShip: readyToShip
            });
          }}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Request overtime"
          endpoint="POST /hris/overtime"
          disabled={employees.length === 0}
          disabledReason="Hire an employee first."
          fields={[
            {
              name: 'employeeId',
              label: 'Employee',
              type: 'select',
              required: true,
              options: opt(employees, (e) => `${e.fullName} — ${e.position}`)
            },
            { name: 'date', label: 'Date', type: 'date', required: true, initial: today() },
            { name: 'hours', label: 'Hours', type: 'number', required: true, initial: 3 },
            { name: 'reason', label: 'Reason', type: 'textarea', placeholder: 'Fulfilment surge' }
          ]}
          submitLabel="Request overtime"
          onSubmit={(v) => api.requestOvertime(v as any)}
          onSuccess={refreshAll}
        />

        <DataTable
          title="Overtime requests"
          rows={overtime}
          onRefresh={refreshAll}
          {loading}
          columns={[
            { key: 'employeeId', label: 'Employee', mono: true },
            { key: 'hours', label: 'Hours' },
            { key: 'status', label: 'Status' },
            { key: 'estimatedCost', label: 'Est. cost', render: (r) => `$${Number(r.estimatedCost ?? 0).toFixed(2)}` }
          ]}
        />
      {:else if activeTab === 'finance'}
        <ModuleForm
          title="Create cost centre"
          endpoint="POST /finance/cost-centers"
          fields={[
            { name: 'name', label: 'Name', required: true, placeholder: 'Fulfilment Operations' },
            { name: 'code', label: 'Code', required: true, placeholder: 'CC-FUL' }
          ]}
          submitLabel="Create cost centre"
          onSubmit={(v) => api.createCostCenter(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Create budget"
          description="Budgets gate autonomous spending: infrastructure scaling and overtime approval both check availability here."
          endpoint="POST /finance/budgets"
          fields={[
            { name: 'name', label: 'Name', required: true, placeholder: 'Q4 Operations' },
            { name: 'totalAmount', label: 'Total amount (USD)', type: 'number', required: true, initial: 5000 },
            { name: 'period', label: 'Period', required: true, initial: '2026-Q4' },
            {
              name: 'costCenterId',
              label: 'Cost centre',
              type: 'select',
              options: [{ value: '', label: '— none —' }, ...opt(costCenters, (c) => `${c.code} — ${c.name}`)]
            }
          ]}
          submitLabel="Create budget"
          onSubmit={(v) => api.createBudget(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Submit expense"
          endpoint="POST /finance/expenses"
          fields={[
            { name: 'amount', label: 'Amount (USD)', type: 'number', required: true, initial: 250 },
            { name: 'description', label: 'Description', required: true, placeholder: 'Courier fuel reimbursement' },
            { name: 'requestedBy', label: 'Requested by', required: true, initial: 'usr-admin-01' },
            {
              name: 'budgetId',
              label: 'Budget',
              type: 'select',
              options: [{ value: '', label: '— none —' }, ...opt(budgets, (b) => `${b.name} ($${b.totalAmount})`)]
            }
          ]}
          submitLabel="Submit expense"
          onSubmit={(v) => api.createExpense(v as any)}
          onSuccess={refreshAll}
        />

        <DataTable
          title="Budgets"
          rows={budgets}
          onRefresh={refreshAll}
          {loading}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'totalAmount', label: 'Total', render: (r) => `$${Number(r.totalAmount ?? 0).toFixed(2)}` },
            { key: 'allocatedAmount', label: 'Allocated', render: (r) => `$${Number(r.allocatedAmount ?? 0).toFixed(2)}` },
            { key: 'period', label: 'Period' }
          ]}
        />

        <DataTable
          title="Expenses"
          rows={expenses}
          {loading}
          columns={[
            { key: 'description', label: 'Description' },
            { key: 'amount', label: 'Amount', render: (r) => `$${Number(r.amount ?? 0).toFixed(2)}` },
            { key: 'status', label: 'Status' }
          ]}
        />
      {:else if activeTab === 'accounting'}
        <ModuleForm
          title="Create ledger account"
          endpoint="POST /accounting/chart-of-accounts"
          fields={[
            { name: 'code', label: 'Code', required: true, placeholder: '1000' },
            { name: 'name', label: 'Name', required: true, placeholder: 'Cash' },
            {
              name: 'type',
              label: 'Type',
              type: 'select',
              required: true,
              options: [
                { value: 'ASSET', label: 'ASSET' },
                { value: 'LIABILITY', label: 'LIABILITY' },
                { value: 'EQUITY', label: 'EQUITY' },
                { value: 'REVENUE', label: 'REVENUE' },
                { value: 'EXPENSE', label: 'EXPENSE' }
              ]
            }
          ]}
          submitLabel="Create account"
          onSubmit={(v) => api.createChartOfAccount(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Create journal (double entry)"
          description="Posts one debit and one credit of equal value. The service rejects an unbalanced journal."
          endpoint="POST /accounting/journals"
          disabled={accounts.length < 2}
          disabledReason="Create at least two ledger accounts first."
          fields={[
            { name: 'reference', label: 'Reference', required: true, placeholder: 'JRN-0001' },
            { name: 'description', label: 'Description' },
            {
              name: 'debitAccountId',
              label: 'Debit account',
              type: 'select',
              required: true,
              options: opt(accounts, (a) => `${a.code} — ${a.name}`)
            },
            {
              name: 'creditAccountId',
              label: 'Credit account',
              type: 'select',
              required: true,
              options: opt(accounts, (a) => `${a.code} — ${a.name}`)
            },
            { name: 'amount', label: 'Amount (USD)', type: 'number', required: true, initial: 500 }
          ]}
          submitLabel="Create journal"
          onSubmit={(v) =>
            api.createJournal({
              reference: v.reference,
              description: v.description,
              entries: [
                { accountId: v.debitAccountId, direction: 'DEBIT', amount: v.amount },
                { accountId: v.creditAccountId, direction: 'CREDIT', amount: v.amount }
              ]
            })}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Create invoice"
          endpoint="POST /accounting/invoices"
          fields={[
            {
              name: 'type',
              label: 'Type',
              type: 'select',
              required: true,
              options: [
                { value: 'RECEIVABLE', label: 'RECEIVABLE (customer owes us)' },
                { value: 'PAYABLE', label: 'PAYABLE (we owe supplier)' }
              ]
            },
            { name: 'counterparty', label: 'Counterparty', required: true, placeholder: 'Acme Retail' },
            { name: 'amount', label: 'Amount (USD)', type: 'number', required: true, initial: 1000 },
            { name: 'dueDate', label: 'Due date', type: 'date' }
          ]}
          submitLabel="Create invoice"
          onSubmit={(v) => api.createInvoice(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Record payment"
          description="Payment beyond the remaining invoice balance is rejected."
          endpoint="POST /accounting/payments"
          disabled={invoices.length === 0}
          disabledReason="Create an invoice first."
          fields={[
            {
              name: 'invoiceId',
              label: 'Invoice',
              type: 'select',
              required: true,
              options: opt(invoices, (i) => `${i.invoiceNumber ?? i.id} — ${i.counterparty} ($${i.amount})`)
            },
            { name: 'amount', label: 'Amount (USD)', type: 'number', required: true, initial: 250 },
            { name: 'method', label: 'Method', placeholder: 'BANK_TRANSFER' }
          ]}
          submitLabel="Record payment"
          onSubmit={(v) => api.recordPayment(v as any)}
          onSuccess={refreshAll}
        />

        <DataTable
          title="Invoices"
          rows={invoices}
          onRefresh={refreshAll}
          {loading}
          columns={[
            { key: 'counterparty', label: 'Counterparty' },
            { key: 'type', label: 'Type' },
            { key: 'amount', label: 'Amount', render: (r) => `$${Number(r.amount ?? 0).toFixed(2)}` },
            { key: 'status', label: 'Status' }
          ]}
        />
      {:else if activeTab === 'procurement'}
        <ModuleForm
          title="Register supplier"
          description="A supplier must be verified before a purchase order can be raised against it."
          endpoint="POST /procurement/suppliers"
          fields={[
            { name: 'name', label: 'Name', required: true, placeholder: 'Nusantara Supply Co' },
            { name: 'contactEmail', label: 'Contact email' },
            { name: 'contactPhone', label: 'Contact phone' }
          ]}
          submitLabel="Register supplier"
          onSubmit={(v) => api.createSupplier(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Verify supplier"
          endpoint="PATCH /procurement/suppliers/:id/verify"
          disabled={suppliers.length === 0}
          disabledReason="Register a supplier first."
          fields={[
            {
              name: 'supplierId',
              label: 'Supplier',
              type: 'select',
              required: true,
              options: opt(suppliers, (s) => `${s.name}${s.isVerified ? ' (verified)' : ''}`)
            }
          ]}
          submitLabel="Verify"
          onSubmit={(v) => api.verifySupplier(v.supplierId)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Raise purchase request"
          endpoint="POST /procurement/purchase-requests"
          disabled={products.length === 0}
          disabledReason="Create a product first."
          fields={[
            { name: 'requestedBy', label: 'Requested by', required: true, initial: 'usr-admin-01' },
            {
              name: 'productId',
              label: 'Product',
              type: 'select',
              required: true,
              options: opt(products, (p) => `${p.sku} — ${p.name}`)
            },
            { name: 'quantity', label: 'Quantity', type: 'number', required: true, initial: 50 },
            { name: 'reason', label: 'Reason', type: 'textarea', placeholder: 'Stock below reorder minimum' }
          ]}
          submitLabel="Raise request"
          onSubmit={(v) => api.createPurchaseRequest(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Create purchase order"
          description="Rejected when the supplier is unverified, and gated by budget availability."
          endpoint="POST /procurement/purchase-orders"
          disabled={suppliers.length === 0 || products.length === 0}
          disabledReason="Register a supplier and create a product first."
          fields={[
            {
              name: 'supplierId',
              label: 'Supplier',
              type: 'select',
              required: true,
              options: opt(suppliers, (s) => `${s.name}${s.isVerified ? ' (verified)' : ' (UNVERIFIED)'}`)
            },
            {
              name: 'productId',
              label: 'Product',
              type: 'select',
              required: true,
              options: opt(products, (p) => `${p.sku} — ${p.name}`)
            },
            { name: 'quantity', label: 'Quantity', type: 'number', required: true, initial: 50 },
            { name: 'unitPrice', label: 'Unit price (USD)', type: 'number', required: true, initial: 20 }
          ]}
          submitLabel="Create PO"
          onSubmit={(v) =>
            api.createPurchaseOrder({
              supplierId: v.supplierId,
              items: [{ productId: v.productId, quantity: v.quantity, unitPrice: v.unitPrice }]
            })}
          onSuccess={refreshAll}
        />

        <DataTable
          title="Purchase orders"
          rows={purchaseOrders}
          onRefresh={refreshAll}
          {loading}
          columns={[
            { key: 'id', label: 'ID', mono: true },
            { key: 'status', label: 'Status' },
            { key: 'totalAmount', label: 'Total', render: (r) => `$${Number(r.totalAmount ?? 0).toFixed(2)}` }
          ]}
        />
      {:else if activeTab === 'ticketing'}
        <ModuleForm
          title="Open ticket"
          description="Tickets are the human-in-the-loop surface: agents escalate here when confidence, budget or policy will not let them proceed."
          endpoint="POST /tickets"
          fields={[
            { name: 'title', label: 'Title', required: true, placeholder: 'Courier capacity shortfall' },
            { name: 'source', label: 'Source', required: true, initial: 'OperatorConsole' },
            { name: 'description', label: 'Description', type: 'textarea' },
            {
              name: 'priority',
              label: 'Priority',
              type: 'select',
              options: [
                { value: 'MEDIUM', label: 'MEDIUM' },
                { value: 'LOW', label: 'LOW' },
                { value: 'HIGH', label: 'HIGH' },
                { value: 'CRITICAL', label: 'CRITICAL' }
              ]
            }
          ]}
          submitLabel="Open ticket"
          onSubmit={(v) => api.createTicket(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Update ticket status"
          endpoint="PATCH /tickets/:id/status"
          disabled={tickets.length === 0}
          disabledReason="Open a ticket first."
          fields={[
            {
              name: 'ticketId',
              label: 'Ticket',
              type: 'select',
              required: true,
              options: opt(tickets, (t) => `${t.title} [${t.status}]`)
            },
            {
              name: 'status',
              label: 'New status',
              type: 'select',
              required: true,
              options: [
                { value: 'TRIAGED', label: 'TRIAGED' },
                { value: 'ASSIGNED', label: 'ASSIGNED' },
                { value: 'IN_PROGRESS', label: 'IN_PROGRESS' },
                { value: 'HUMAN_REVIEW', label: 'HUMAN_REVIEW' },
                { value: 'RESOLVED', label: 'RESOLVED' },
                { value: 'CLOSED', label: 'CLOSED' }
              ]
            }
          ]}
          submitLabel="Update status"
          onSubmit={(v) => api.updateTicketStatus(v.ticketId, v.status)}
          onSuccess={refreshAll}
        />

        <DataTable
          title="Tickets"
          rows={tickets}
          onRefresh={refreshAll}
          {loading}
          columns={[
            { key: 'title', label: 'Title' },
            { key: 'status', label: 'Status' },
            { key: 'priority', label: 'Priority' },
            { key: 'source', label: 'Source' }
          ]}
        />
      {:else if activeTab === 'knowledge'}
        <ModuleForm
          title="Add knowledge document"
          description="This is the corpus agents retrieve from when they need policy or procedure context."
          endpoint="POST /knowledge/documents"
          fields={[
            { name: 'title', label: 'Title', required: true, placeholder: 'Courier dispatch SOP' },
            {
              name: 'sourceType',
              label: 'Source type',
              type: 'select',
              required: true,
              options: [
                { value: 'SOP', label: 'SOP' },
                { value: 'COMPANY_POLICY', label: 'COMPANY_POLICY' },
                { value: 'PRODUCT_CATALOG', label: 'PRODUCT_CATALOG' },
                { value: 'FINANCIAL_POLICY', label: 'FINANCIAL_POLICY' },
                { value: 'HR_POLICY', label: 'HR_POLICY' },
                { value: 'PROCUREMENT_POLICY', label: 'PROCUREMENT_POLICY' },
                { value: 'TECHNICAL_DOCUMENTATION', label: 'TECHNICAL_DOCUMENTATION' },
                { value: 'HISTORICAL_CASE', label: 'HISTORICAL_CASE' }
              ]
            },
            { name: 'content', label: 'Content', type: 'textarea', required: true }
          ]}
          submitLabel="Add document"
          onSubmit={(v) => api.createKnowledgeDocument(v as any)}
          onSuccess={refreshAll}
        />

        <ModuleForm
          title="Search knowledge"
          description="Runs the same retrieval path the agents use, and returns ranked results with scores."
          endpoint="POST /knowledge/search"
          fields={[
            { name: 'query', label: 'Query', required: true, placeholder: 'courier dispatch' },
            { name: 'limit', label: 'Limit', type: 'number', initial: 5 }
          ]}
          submitLabel="Search"
          onSubmit={(v) => api.searchKnowledge(v as any)}
        />

        <DataTable
          title="Knowledge documents"
          rows={documents}
          onRefresh={refreshAll}
          {loading}
          columns={[
            { key: 'title', label: 'Title' },
            { key: 'sourceType', label: 'Type' },
            { key: 'createdAt', label: 'Created', render: (r) => new Date(r.createdAt).toLocaleTimeString() }
          ]}
        />
      {:else if activeTab === 'infrastructure'}
        <div class="cluster-strip">
          {#if cluster}
            <div class="stat"><span>Cluster</span><strong>{cluster.clusterName ?? '—'}</strong></div>
            <div class="stat"><span>Nodes</span><strong>{cluster.nodes?.length ?? 0}</strong></div>
            <div class="stat"><span>Pods</span><strong>{cluster.pods?.length ?? 0}</strong></div>
            <div class="stat">
              <span>Deployments</span>
              <strong>
                {(cluster.deployments ?? []).map((d: any) => `${d.name}:${d.replicas}`).join(', ') || '—'}
              </strong>
            </div>
          {:else}
            <p class="cluster-warn">
              No cluster snapshot. The API cannot reach Kubernetes — start the Kind overlay
              (docker-compose.kind.yml) to enable real scaling.
            </p>
          {/if}
        </div>

        <ModuleForm
          title="Request scaling"
          description="Goes through the same policy and budget gate the infra agent uses. Above the replica ceiling the request is recorded as POLICY_REJECTED rather than executed."
          endpoint="POST /infrastructure/scaling-requests"
          fields={[
            { name: 'namespace', label: 'Namespace', required: true, initial: 'autonomous-enterprise' },
            {
              name: 'deploymentName',
              label: 'Deployment',
              type: 'select',
              required: true,
              options: (cluster?.deployments ?? []).map((d: any) => ({
                value: d.name,
                label: `${d.name} (currently ${d.replicas})`
              }))
            },
            { name: 'toReplicas', label: 'Target replicas', type: 'number', required: true, initial: 5 },
            { name: 'reason', label: 'Reason', required: true, initial: 'Manual capacity test from console' },
            { name: 'projectedCostUsd', label: 'Projected cost (USD/hr)', type: 'number', required: true, initial: 0.06 }
          ]}
          submitLabel="Request scaling"
          onSubmit={(v) => api.requestScaling(v as any)}
          onSuccess={refreshAll}
        />

        <DataTable
          title="Scaling events"
          rows={scalingEvents}
          onRefresh={refreshAll}
          {loading}
          columns={[
            { key: 'status', label: 'Status' },
            { key: 'replicas', label: 'Change', render: (r) => `${r.fromReplicas} → ${r.toReplicas}` },
            { key: 'projectedCostUsd', label: 'Cost', render: (r) => `$${Number(r.projectedCostUsd ?? 0).toFixed(4)}` },
            { key: 'reason', label: 'Reason' }
          ]}
        />
      {:else if activeTab === 'orchestrator'}
        <ModuleForm
          title="Execute an agent goal"
          description="Hands a goal to the orchestrator. Complexity and risk drive model routing; the trust requirement decides whether the agent may act autonomously or must escalate to a human."
          endpoint="POST /orchestrator/goals"
          fields={[
            {
              name: 'goal',
              label: 'Goal',
              type: 'textarea',
              required: true,
              initial: 'Review pending orders and decide whether fulfilment capacity is sufficient'
            },
            {
              name: 'agentName',
              label: 'Agent',
              type: 'select',
              required: true,
              options:
                agents.length > 0
                  ? agents.map((a) => ({ value: a.agentName, label: `${a.agentName} (trust ${(a.trustProfile?.overallTrust ?? 0).toFixed(2)})` }))
                  : [{ value: 'orchestrator', label: 'orchestrator' }]
            },
            {
              name: 'complexity',
              label: 'Complexity',
              type: 'select',
              required: true,
              options: [
                { value: 'SIMPLE_QUERY', label: 'SIMPLE_QUERY' },
                { value: 'SIMPLE_CLASSIFICATION', label: 'SIMPLE_CLASSIFICATION' },
                { value: 'COMPLEX_REASONING', label: 'COMPLEX_REASONING' },
                { value: 'CRITICAL_DECISION', label: 'CRITICAL_DECISION' }
              ]
            },
            {
              name: 'riskLevel',
              label: 'Risk level',
              type: 'select',
              required: true,
              options: [
                { value: 'LOW', label: 'LOW' },
                { value: 'MEDIUM', label: 'MEDIUM' },
                { value: 'HIGH', label: 'HIGH' },
                { value: 'CRITICAL', label: 'CRITICAL' }
              ]
            },
            {
              name: 'trustRequirement',
              label: 'Trust requirement',
              type: 'number',
              initial: 0.7,
              step: '0.05',
              help: 'Set above the agent’s trust score to force a human escalation.'
            }
          ]}
          submitLabel="Execute goal"
          onSubmit={(v) => api.executeGoal(v as any)}
          onSuccess={refreshAll}
        />

        <DataTable
          title="Registered agents"
          rows={agents}
          onRefresh={refreshAll}
          {loading}
          columns={[
            { key: 'agentName', label: 'Agent' },
            { key: 'model', label: 'Model', mono: true },
            { key: 'availability', label: 'Availability' },
            {
              key: 'trust',
              label: 'Trust',
              render: (r) => Number(r.trustProfile?.overallTrust ?? 0).toFixed(3)
            }
          ]}
        />
      {/if}
    </div>

    <aside class="trace-area">
      <TraceStream filter={TRACE_FILTERS[activeTab]} title="Live E2E Trace" />
    </aside>
  </div>
</div>

<style>
  .console {
    padding: 1.5rem 1.75rem 2.5rem;
    max-width: 1700px;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 1.25rem;
  }

  .title {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--text-secondary);
    max-width: 76ch;
    margin-top: 0.3rem;
    line-height: 1.55;
  }

  .refresh {
    background: #ffffff;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    border-radius: 6px;
    padding: 0.45rem 0.95rem;
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    box-shadow: var(--shadow-xs);
    transition: all 0.15s ease;
  }

  .refresh:hover:not(:disabled) {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.6rem;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 7px;
    padding: 0.4rem 0.75rem;
    color: var(--text-secondary);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  .tab:hover {
    background: var(--bg-card-hover);
    color: var(--text-primary);
  }

  .tab.active {
    background: #ffffff;
    border-color: var(--border-color);
    color: var(--accent-blue);
    font-weight: 600;
    box-shadow: var(--shadow-xs);
  }

  .tab-icon {
    font-size: 0.95rem;
  }

  .tab-blurb {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin: 0.7rem 0 1rem;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 380px;
    gap: 1.1rem;
    align-items: start;
  }

  @media (max-width: 1180px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }

  .work-area {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
  }

  .trace-area {
    position: sticky;
    top: 1rem;
  }

  .cluster-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 0.85rem 1.1rem;
    box-shadow: var(--shadow-sm);
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .stat span {
    font-size: 0.68rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .stat strong {
    font-size: 0.85rem;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .cluster-warn {
    font-size: 0.78rem;
    color: var(--accent-amber);
    line-height: 1.5;
  }
</style>
