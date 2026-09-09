<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '$lib/api';

  interface AgentDesk {
    id: string;
    name: string;
    role: string;
    shortRole: string;
    zone: string;
    color: string;
    accent: string;
    homeX: number;
    homeY: number;
    currentX: number;
    currentY: number;
    targetX: number;
    targetY: number;
    avatar: string;
    spriteBase: string;
    walkFrame: number;
    isWalking: boolean;
    isTyping: boolean;
    facingLeft: boolean;
    status: 'idle' | 'working' | 'thinking' | 'warning' | 'coffee' | 'walking';
    activeEffect?: string;
    speechBubble: string;
    speechTimer?: any;
    model: string;
    trustScore: number;
    tokensUsed: number;
    recentAction?: string;
    actionHistory: Array<{ timestamp: string; action: string; message: string; tokens: number }>;
  }

  interface Furniture {
    id: string;
    type: string;
    sprite: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    hasMonitor?: boolean;
    isInteractive?: boolean;
  }

  let isNightMode = $state(false);
  let isInspectorOpen = $state(false);
  let isDrawerExpanded = $state(false);

  let simulatorStatus = $state<{
    isRunning: boolean;
    mode: 'NORMAL' | 'FLASH_SALE' | 'CHAOS';
    intervalMs: number;
    totalTicks: number;
    successfulActions: number;
    failedActions: number;
    pausedByRateLimit: boolean;
    rateLimitCooldownSeconds: number;
    lastAction?: string;
    lastActor?: string;
    lastSpeechBubble?: string;
  }>({
    isRunning: false,
    mode: 'NORMAL',
    intervalMs: 1500,
    totalTicks: 0,
    successfulActions: 0,
    failedActions: 0,
    pausedByRateLimit: false,
    rateLimitCooldownSeconds: 0
  });

  let selectedAgentId = $state<string | null>(null);
  let historyScope = $state<'agent' | 'all'>('all');
  let globalReasoning = $state<
    Array<{
      id: string;
      timestamp: string;
      agentId: string;
      agentName: string;
      color: string;
      action: string;
      message: string;
      tokens: number;
      toolName?: string;
      sideEffect?: string;
      toolArgs?: string;
      toolResult?: string;
      toolOk?: boolean;
      durationMs?: number;
      toolsUsed?: string[];
      writesPerformed?: number;
      stopReason?: string;
      costUsd?: number;
    }>
  >([]);
  let livePackets = $state<Array<{ id: string; fromX: number; fromY: number; toX: number; toY: number; color: string; label: string }>>([]);
  let recentEvents = $state<Array<{ id: string; time: string; actor: string; action: string; message: string; mood: string }>>([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString(),
      actor: 'Redis EventStream',
      action: 'SYSTEM_READY',
      message: 'Autonomous enterprise live event stream & OmniRouter reasoning active.',
      mood: 'thinking'
    }
  ]);

  let cleanupEventStream: (() => void) | null = null;
  let statusPollTimer: any = null;
  let idleThoughtTimer: any = null;
  let animationFrameId: number | null = null;
  let cooldownCountdown = $state(0);
  let countdownTimer: any = null;
  let errorBanner = $state<string | null>(null);
  let activeHotspotToast = $state<string | null>(null);

  const LAYOUT_STORAGE_KEY = 'virtual-office-layout-v1';

  const DEFAULT_FURNITURE: Furniture[] = [
    // 1. Central AI Command Zone (Top Center)
    { id: 'desk-mgr-1', type: 'standing-desk', sprite: '/sprites/furniture/standing-desk-left-rear.png', x: 42.0, y: 42.0, width: 8.5, height: 11.5, label: 'AI Central Command Desk', hasMonitor: true },

    // 2. War Room / Auditor Zone (Center)
    { id: 'desk-mgr-2', type: 'standing-desk', sprite: '/sprites/furniture/standing-desk-left-front.png', x: 48.0, y: 56.0, width: 8.5, height: 11.5, label: 'War Room Audit Terminal', hasMonitor: true },

    // 3. Sales Operations Desk (Far Left Wing)
    { id: 'desk-sales-1', type: 'standing-desk', sprite: '/sprites/furniture/standing-desk-left-rear.png', x: 24.0, y: 62.0, width: 8.5, height: 11.5, label: 'Sales & Inbound Desk', hasMonitor: true },

    // 4. QA & Verification Desk (Bottom Left)
    { id: 'desk-sales-2', type: 'standing-desk', sprite: '/sprites/furniture/standing-desk-left-front.png', x: 36.0, y: 74.0, width: 8.5, height: 11.5, label: 'QA Verification Bay', hasMonitor: true },

    // 5. Finance & Treasury Desk (Upper Right Wing)
    { id: 'desk-ops-2', type: 'standing-desk', sprite: '/sprites/furniture/standing-desk-left-front.png', x: 62.0, y: 54.0, width: 8.5, height: 11.5, label: 'Finance & Treasury Desk', hasMonitor: true },

    // 6. Inventory & Stock Bay (Far Right Wing)
    { id: 'desk-ops-1', type: 'standing-desk', sprite: '/sprites/furniture/standing-desk-left-rear.png', x: 76.0, y: 68.0, width: 8.5, height: 11.5, label: 'Inventory & Warehouse Desk', hasMonitor: true },

    // 7. HRIS & Staffing Center (Bottom Center)
    { id: 'desk-ops-3', type: 'standing-desk', sprite: '/sprites/furniture/standing-desk-right-front.png', x: 54.0, y: 78.0, width: 8.5, height: 11.5, label: 'HRIS People Lounge Desk', hasMonitor: true },

    // 8. K8s Server Core Desk (Beside Central Command / Orchestrator)
    { id: 'desk-ops-4', type: 'standing-desk', sprite: '/sprites/furniture/standing-desk-right-rear.png', x: 52.0, y: 43.0, width: 8.5, height: 11.5, label: 'K8s Cluster DevOps Terminal', hasMonitor: true },

    // Interactive Appliances & Decor
    { id: 'coffee-bar', type: 'coffee', sprite: '/sprites/appliances/coffee-on.png', x: 78.5, y: 46.0, width: 3.5, height: 4.5, label: 'Espresso Bar ☕', isInteractive: true },
    { id: 'filing-cabinet-1', type: 'filing', sprite: '/sprites/furniture/filling-closed.png', x: 30.0, y: 50.0, width: 4.5, height: 6.0, label: 'Audit Archives 🗄️', isInteractive: true },
    { id: 'printer-1', type: 'printer', sprite: '/sprites/decoration/printer-working.png', x: 88.0, y: 50.0, width: 4.2, height: 4.8, label: 'Invoice Printer 🖨️', isInteractive: true },
    { id: 'whiteboard-1', type: 'whiteboard', sprite: '/sprites/decoration/white-board.png', x: 18.0, y: 52.0, width: 14.0, height: 16.0, label: 'Sprint Board 📋', isInteractive: true },

    // Plants Spanning the Perimeter
    { id: 'plant-monstera-1', type: 'plant', sprite: '/sprites/decoration/monstera-plant.png', x: 93.0, y: 58.0, width: 5.0, height: 7.0, label: 'Monstera Plant 🌿' },
    { id: 'plant-snake-1', type: 'plant', sprite: '/sprites/decoration/snake-plant.png', x: 42.0, y: 33.0, width: 4.0, height: 6.5, label: 'Snake Plant 🪴' },
    { id: 'plant-money-1', type: 'plant', sprite: '/sprites/decoration/money-tree.png', x: 14.0, y: 72.0, width: 4.5, height: 6.8, label: 'Money Tree 🌲' },
    { id: 'plant-money-2', type: 'plant', sprite: '/sprites/decoration/money-tree.png', x: 68.0, y: 84.0, width: 4.5, height: 6.8, label: 'Money Tree 🌲' }
  ];

  let FURNITURE_LIST = $state<Furniture[]>(DEFAULT_FURNITURE.map((f) => ({ ...f })));

  let isEditMode = $state(false);
  let selectedFurnitureId = $state<string | null>(null);
  let selectedEditAgentId = $state<string | null>(null);
  let draggingTarget: { type: 'furniture' | 'agent'; id: string } | null = null;
  let dragOffset = { dx: 0, dy: 0 };
  let stageEl: HTMLDivElement | null = $state(null);
  let layoutSavedToast = $state<string | null>(null);

  const DEFAULT_AGENT_POSITIONS: Record<string, { x: number; y: number }> = {
    'sales-agent': { x: 24.0, y: 66.5 },
    'inventory-agent': { x: 76.0, y: 72.5 },
    'finance-agent': { x: 62.0, y: 58.5 },
    'hris-agent': { x: 54.0, y: 82.5 },
    'infra-agent': { x: 52.0, y: 47.5 },
    'orchestrator': { x: 42.0, y: 46.5 },
    'debugger-agent': { x: 48.0, y: 60.5 },
    'tester-agent': { x: 36.0, y: 78.5 }
  };

  const IDLE_THOUGHTS: Record<string, string[]> = {
    'sales-agent': [
      'Evaluating enterprise inbound pipeline ($42k MRR)...',
      'Scoring high-value lead: Acme Corp SaaS deal...',
      'Syncing CRM lead status with Postgres store...',
      'Drafting automated proposal for customer review...',
      'Real-time conversion rate optimal at 3.8%...'
    ],
    'inventory-agent': [
      'Scanning warehouse bay 4 stock levels (SKU-770)...',
      'Automated reorder point verified: 50 units remaining...',
      'Syncing inventory reservations across all orders...',
      'Supplier dispatch ETA confirmed for tomorrow morning...',
      'Stock integrity check passed: 100% tally.'
    ],
    'finance-agent': [
      'Cognitive token burn rate $0.02/hr (within $10 cap)...',
      'Verifying GL debit/credit ledger balance...',
      'Auditing invoice matching against purchase orders...',
      'Treasury cash reserve safe: 18 months runway...',
      'Tax compliance validation checks complete.'
    ],
    'hris-agent': [
      'Workforce capacity load currently at 82%...',
      'Calculating engineering on-call rotation schedules...',
      'Processing approved PTO requests in HR portal...',
      'Talent matching score: 4 candidates short-listed...',
      'Employee sentiment metric: 94% positive.'
    ],
    'infra-agent': [
      'K8s cluster metrics: 2 active pods, 0 restarts...',
      'Prometheus scrapers reporting 14ms p99 latency...',
      'Auto-scaling threshold monitoring CPU at 28%...',
      'Checking Istio service mesh mTLS certificates...',
      'Container runtime healthy: all probes green.'
    ],
    'orchestrator': [
      'Central macro loop routing inter-agent tasks...',
      'Dependency graph resolved: 0 blocking locks...',
      'Autonomous supervisor health check optimal...',
      'OmniRouter model tier: minimax/minimax-m3 (free)...',
      'Circuit breaker armed: 0 trip thresholds reached.'
    ],
    'debugger-agent': [
      'Auditing state machine transitions across domains...',
      'Validating tamper-evident SHA-256 event hashes...',
      'Replay experiment sandbox ready for simulation...',
      'Audit trail verified: 0 anomalies detected...',
      'Checking invariant contracts on database mutations.'
    ],
    'tester-agent': [
      '179 automated contract tests passing across 6 pkgs...',
      'Running fuzz testing on API gateway rate limits...',
      'Checking tenant isolation on HTTP headers...',
      'Vitest benchmark assertions verified green...',
      'End-to-end integration scenario execution ready.'
    ]
  };

  let agents = $state<Record<string, AgentDesk>>({
    'sales-agent': {
      id: 'sales-agent',
      name: 'Sales Agent',
      role: 'Inbound Orders & Lead Prospecting',
      shortRole: 'SALES',
      zone: 'Sales Wing',
      color: '#3b82f6',
      accent: '#2563eb',
      homeX: 24.0,
      homeY: 66.5,
      currentX: 24.0,
      currentY: 66.5,
      targetX: 24.0,
      targetY: 66.5,
      avatar: '🛍️',
      spriteBase: 'frontend',
      walkFrame: 0,
      isWalking: false,
      isTyping: false,
      facingLeft: false,
      status: 'idle',
      activeEffect: undefined,
      speechBubble: 'Standing by for enterprise events...',
      model: 'minimax/minimax-m3:free',
      trustScore: 0.94,
      tokensUsed: 14200,
      actionHistory: []
    },
    'inventory-agent': {
      id: 'inventory-agent',
      name: 'Inventory Agent',
      role: 'Warehouse & Stock Replenishment',
      shortRole: 'INVENTORY',
      zone: 'Warehouse Bay',
      color: '#10b981',
      accent: '#059669',
      homeX: 76.0,
      homeY: 72.5,
      currentX: 76.0,
      currentY: 72.5,
      targetX: 76.0,
      targetY: 72.5,
      avatar: '📦',
      spriteBase: 'fullstack',
      walkFrame: 0,
      isWalking: false,
      isTyping: false,
      facingLeft: false,
      status: 'idle',
      activeEffect: undefined,
      speechBubble: 'Standing by for warehouse orders...',
      model: 'minimax/minimax-m3:free',
      trustScore: 0.91,
      tokensUsed: 18500,
      actionHistory: []
    },
    'finance-agent': {
      id: 'finance-agent',
      name: 'Finance Agent',
      role: 'Treasury & AI Budget Guardian',
      shortRole: 'FINANCE',
      zone: 'Finance Suite',
      color: '#f59e0b',
      accent: '#d97706',
      homeX: 62.0,
      homeY: 58.5,
      currentX: 62.0,
      currentY: 58.5,
      targetX: 62.0,
      targetY: 58.5,
      avatar: '💰',
      spriteBase: 'security',
      walkFrame: 0,
      isWalking: false,
      isTyping: false,
      facingLeft: false,
      status: 'idle',
      activeEffect: undefined,
      speechBubble: 'Standing by for treasury audit...',
      model: 'minimax/minimax-m3:free',
      trustScore: 0.96,
      tokensUsed: 22100,
      actionHistory: []
    },
    'hris-agent': {
      id: 'hris-agent',
      name: 'HRIS Agent',
      role: 'Staffing & Capacity Manager',
      shortRole: 'HRIS',
      zone: 'People Lounge',
      color: '#8b5cf6',
      accent: '#7c3aed',
      homeX: 54.0,
      homeY: 82.5,
      currentX: 54.0,
      currentY: 82.5,
      targetX: 54.0,
      targetY: 82.5,
      avatar: '👥',
      spriteBase: 'reviewer',
      walkFrame: 0,
      isWalking: false,
      isTyping: false,
      facingLeft: false,
      status: 'idle',
      activeEffect: undefined,
      speechBubble: 'Standing by for staffing demand...',
      model: 'minimax/minimax-m3:free',
      trustScore: 0.92,
      tokensUsed: 9800,
      actionHistory: []
    },
    'infra-agent': {
      id: 'infra-agent',
      name: 'Infra Agent',
      role: 'K8s Cluster Controller',
      shortRole: 'DEVOPS',
      zone: 'Server Core',
      color: '#ec4899',
      accent: '#db2777',
      homeX: 52.0,
      homeY: 47.5,
      currentX: 52.0,
      currentY: 47.5,
      targetX: 52.0,
      targetY: 47.5,
      avatar: '🖥️',
      spriteBase: 'devops',
      walkFrame: 0,
      isWalking: false,
      isTyping: false,
      facingLeft: false,
      status: 'idle',
      activeEffect: undefined,
      speechBubble: 'Standing by for telemetry...',
      model: 'minimax/minimax-m3:free',
      trustScore: 0.98,
      tokensUsed: 31200,
      actionHistory: []
    },
    'orchestrator': {
      id: 'orchestrator',
      name: 'AI Orchestrator',
      role: 'Macro Goal Manager & Router',
      shortRole: 'ORCHESTRATOR',
      zone: 'Central Command',
      color: '#6366f1',
      accent: '#4f46e5',
      homeX: 42.0,
      homeY: 46.5,
      currentX: 42.0,
      currentY: 46.5,
      targetX: 42.0,
      targetY: 46.5,
      avatar: '🧠',
      spriteBase: 'manager',
      walkFrame: 0,
      isWalking: false,
      isTyping: false,
      facingLeft: false,
      status: 'idle',
      activeEffect: undefined,
      speechBubble: 'Standing by for macro directives...',
      model: 'minimax/minimax-m3:free',
      trustScore: 0.97,
      tokensUsed: 48900,
      actionHistory: []
    },
    'debugger-agent': {
      id: 'debugger-agent',
      name: 'QA & Auditor',
      role: 'System Consistency & Replay Auditor',
      shortRole: 'AUDITOR',
      zone: 'War Room',
      color: '#06b6d4',
      accent: '#0891b2',
      homeX: 48.0,
      homeY: 60.5,
      currentX: 48.0,
      currentY: 60.5,
      targetX: 48.0,
      targetY: 60.5,
      avatar: '🔍',
      spriteBase: 'debugger',
      walkFrame: 0,
      isWalking: false,
      isTyping: false,
      facingLeft: true,
      status: 'idle',
      activeEffect: undefined,
      speechBubble: 'Standing by for consistency audit...',
      model: 'minimax/minimax-m3:free',
      trustScore: 0.95,
      tokensUsed: 16700,
      actionHistory: []
    },
    'tester-agent': {
      id: 'tester-agent',
      name: 'Tester Agent',
      role: 'Contract Verification',
      shortRole: 'TESTER',
      zone: 'Verification Bay',
      color: '#14b8a6',
      accent: '#0d9488',
      homeX: 36.0,
      homeY: 78.5,
      currentX: 36.0,
      currentY: 78.5,
      targetX: 36.0,
      targetY: 78.5,
      avatar: '⚡',
      spriteBase: 'tester',
      walkFrame: 0,
      isWalking: false,
      isTyping: false,
      facingLeft: false,
      status: 'idle',
      activeEffect: undefined,
      speechBubble: 'Standing by for contract verification...',
      model: 'minimax/minimax-m3:free',
      trustScore: 0.99,
      tokensUsed: 12400,
      actionHistory: []
    }
  });

  let selectedAgent = $derived(selectedAgentId ? agents[selectedAgentId] ?? null : null);

  onMount(async () => {
    loadSavedLayout();

    try {
      await loadSimulatorStatus();
      await loadAgentRegistry();
    } catch (e) {}

    try {
      cleanupEventStream = api.subscribeToEvents((event) => {
        handleEvent(event);
      });
    } catch (e) {}

    statusPollTimer = setInterval(() => {
      loadSimulatorStatus();
    }, 2000);

    idleThoughtTimer = setInterval(() => {
      cycleRandomAgentThought();
    }, 2800);

    countdownTimer = setInterval(() => {
      if (cooldownCountdown > 0) {
        cooldownCountdown -= 1;
        if (cooldownCountdown <= 0) {
          simulatorStatus.pausedByRateLimit = false;
        }
      }
    }, 1000);

    let frameCount = 0;
    const animateLoop = () => {
      frameCount++;
      updateAgentMovement(frameCount);
      animationFrameId = requestAnimationFrame(animateLoop);
    };
    animationFrameId = requestAnimationFrame(animateLoop);
  });

  onDestroy(() => {
    if (cleanupEventStream) cleanupEventStream();
    if (statusPollTimer) clearInterval(statusPollTimer);
    if (idleThoughtTimer) clearInterval(idleThoughtTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  });

  function cycleRandomAgentThought() {
    if (!simulatorStatus.isRunning || simulatorStatus.pausedByRateLimit) {
      for (const id of Object.keys(agents)) {
        agents[id].isTyping = false;
        agents[id].status = 'idle';
        agents[id].activeEffect = 'sleeping';
      }
      return;
    }

    const agentKeys = Object.keys(agents);
    const chosenKey = agentKeys[Math.floor(Math.random() * agentKeys.length)];
    const agent = agents[chosenKey];
    if (agent && !agent.isWalking) {
      const thoughts = IDLE_THOUGHTS[chosenKey] || ['Processing enterprise telemetry...'];
      const nextThought = thoughts[Math.floor(Math.random() * thoughts.length)];
      agent.speechBubble = nextThought;
      agent.isTyping = true;
      if (!agent.activeEffect || agent.activeEffect === 'sleeping') {
        agent.activeEffect = 'typing';
      }

      if (Math.random() < 0.15) {
        agent.activeEffect = 'need-coffee';
        const coffee = FURNITURE_LIST.find((f) => f.id === 'coffee-bar');
        if (coffee) {
          const stand = getStandingSpot(coffee);
          triggerAgentMovement(agent.id, stand.x, stand.y, 4500);
        }
      }
    }
  }

  function getStandingSpot(item: Furniture): { x: number; y: number } {
    const jitter = (Math.random() * 1.6) - 0.8;
    return {
      x: item.x + jitter,
      y: item.y + item.height * 0.55
    };
  }

  function dispatchAgentTo(agentId: string, furnitureId: string) {
    const item = FURNITURE_LIST.find((f) => f.id === furnitureId);
    if (!item) return;
    const stand = getStandingSpot(item);
    triggerAgentMovement(agentId, stand.x, stand.y, 5000);
  }

  function loadSavedLayout() {
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      const savedFurniture = Array.isArray(parsed) ? parsed : (parsed.furniture || []);
      const savedAgents = Array.isArray(parsed) ? [] : (parsed.agents || []);

      if (savedFurniture.length > 0) {
        FURNITURE_LIST = FURNITURE_LIST.map((item) => {
          const hit = savedFurniture.find((s: any) => s.id === item.id);
          return hit ? { ...item, x: hit.x, y: hit.y, width: hit.width, height: hit.height } : item;
        });
      }

      for (const ag of savedAgents) {
        if (agents[ag.id]) {
          agents[ag.id].homeX = ag.x;
          agents[ag.id].homeY = ag.y;
          agents[ag.id].currentX = ag.x;
          agents[ag.id].currentY = ag.y;
          agents[ag.id].targetX = ag.x;
          agents[ag.id].targetY = ag.y;
        }
      }
    } catch (e) {}
  }

  function persistLayout(showToast = true) {
    try {
      const payload = {
        furniture: FURNITURE_LIST.map((f) => ({
          id: f.id,
          x: Number(f.x.toFixed(2)),
          y: Number(f.y.toFixed(2)),
          width: Number(f.width.toFixed(2)),
          height: Number(f.height.toFixed(2))
        })),
        agents: Object.values(agents).map((a) => ({
          id: a.id,
          x: Number(a.homeX.toFixed(2)),
          y: Number(a.homeY.toFixed(2))
        }))
      };
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload));
      if (showToast) showLayoutToast('Layout saved to this browser');
    } catch (e) {
      showLayoutToast('Failed to save layout');
    }
  }

  function resetLayout() {
    FURNITURE_LIST = DEFAULT_FURNITURE.map((f) => ({ ...f }));
    for (const [id, pos] of Object.entries(DEFAULT_AGENT_POSITIONS)) {
      if (agents[id]) {
        agents[id].homeX = pos.x;
        agents[id].homeY = pos.y;
        agents[id].currentX = pos.x;
        agents[id].currentY = pos.y;
        agents[id].targetX = pos.x;
        agents[id].targetY = pos.y;
      }
    }
    try {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch (e) {}
    selectedFurnitureId = null;
    selectedEditAgentId = null;
    showLayoutToast('Layout reset to default');
  }

  function exportLayout() {
    const payload = {
      furniture: FURNITURE_LIST.map((f) => ({
        id: f.id,
        x: Number(f.x.toFixed(2)),
        y: Number(f.y.toFixed(2)),
        width: Number(f.width.toFixed(2)),
        height: Number(f.height.toFixed(2))
      })),
      agents: Object.values(agents).map((a) => ({
        id: a.id,
        x: Number(a.homeX.toFixed(2)),
        y: Number(a.homeY.toFixed(2))
      }))
    };
    const json = JSON.stringify(payload, null, 2);
    try {
      navigator.clipboard.writeText(json);
      showLayoutToast('Layout JSON copied to clipboard');
    } catch (e) {
      showLayoutToast('Copy failed — see browser console');
    }
    console.log('Virtual Office Layout JSON:\n', json);
  }

  function showLayoutToast(msg: string) {
    layoutSavedToast = msg;
    setTimeout(() => {
      layoutSavedToast = null;
    }, 2500);
  }

  function toggleEditMode() {
    isEditMode = !isEditMode;
    if (!isEditMode) {
      selectedFurnitureId = null;
      selectedEditAgentId = null;
      draggingTarget = null;
    }
  }

  function startDrag(event: PointerEvent, item: Furniture) {
    if (!isEditMode || !stageEl) return;
    event.preventDefault();
    event.stopPropagation();

    selectedFurnitureId = item.id;
    selectedEditAgentId = null;
    draggingTarget = { type: 'furniture', id: item.id };

    const rect = stageEl.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    dragOffset = { dx: pointerX - item.x, dy: pointerY - item.y };

    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function startAgentDrag(event: PointerEvent, agent: AgentDesk) {
    if (!isEditMode || !stageEl) return;
    event.preventDefault();
    event.stopPropagation();

    selectedEditAgentId = agent.id;
    selectedFurnitureId = null;
    draggingTarget = { type: 'agent', id: agent.id };

    const rect = stageEl.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    dragOffset = { dx: pointerX - agent.homeX, dy: pointerY - agent.homeY };

    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onDrag(event: PointerEvent) {
    if (!draggingTarget || !stageEl) return;
    event.preventDefault();

    const rect = stageEl.getBoundingClientRect();
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;

    if (draggingTarget.type === 'furniture') {
      const idx = FURNITURE_LIST.findIndex((f) => f.id === draggingTarget?.id);
      if (idx === -1) return;

      FURNITURE_LIST[idx].x = clampPct(pointerX - dragOffset.dx);
      FURNITURE_LIST[idx].y = clampPct(pointerY - dragOffset.dy);
    } else if (draggingTarget.type === 'agent') {
      const ag = agents[draggingTarget.id];
      if (!ag) return;
      const newX = clampPct(pointerX - dragOffset.dx);
      const newY = clampPct(pointerY - dragOffset.dy);
      ag.homeX = newX;
      ag.homeY = newY;
      ag.currentX = newX;
      ag.currentY = newY;
      ag.targetX = newX;
      ag.targetY = newY;
    }
  }

  function endDrag(event: PointerEvent) {
    if (!draggingTarget) return;
    draggingTarget = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch (e) {}
    persistLayout(false);
  }

  function clampPct(value: number): number {
    return Math.max(0, Math.min(100, Number(value.toFixed(2))));
  }

  function adjustSelected(field: 'x' | 'y' | 'width' | 'height', delta: number) {
    if (!selectedFurnitureId) return;
    const idx = FURNITURE_LIST.findIndex((f) => f.id === selectedFurnitureId);
    if (idx === -1) return;

    const next = FURNITURE_LIST[idx][field] + delta;
    FURNITURE_LIST[idx][field] = field === 'width' || field === 'height'
      ? Math.max(1, Number(next.toFixed(2)))
      : clampPct(next);

    persistLayout(false);
  }

  function adjustAgentPos(agentId: string, axis: 'x' | 'y', delta: number) {
    const ag = agents[agentId];
    if (!ag) return;
    if (axis === 'x') {
      const next = clampPct(ag.homeX + delta);
      ag.homeX = next;
      ag.currentX = next;
      ag.targetX = next;
    } else {
      const next = clampPct(ag.homeY + delta);
      ag.homeY = next;
      ag.currentY = next;
      ag.targetY = next;
    }
    persistLayout(false);
  }

  function selectEditAgent(agent: AgentDesk) {
    selectedEditAgentId = agent.id;
    selectedFurnitureId = null;
  }

  function nudgeSelected(event: KeyboardEvent) {
    if (!isEditMode) return;
    const step = event.shiftKey ? 1 : 0.25;

    if (selectedFurnitureId) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); adjustSelected('x', -step); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); adjustSelected('x', step); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); adjustSelected('y', -step); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); adjustSelected('y', step); }
      else if (event.key === 'Escape') { selectedFurnitureId = null; }
    } else if (selectedEditAgentId && agents[selectedEditAgentId]) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); adjustAgentPos(selectedEditAgentId, 'x', -step); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); adjustAgentPos(selectedEditAgentId, 'x', step); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); adjustAgentPos(selectedEditAgentId, 'y', -step); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); adjustAgentPos(selectedEditAgentId, 'y', step); }
      else if (event.key === 'Escape') { selectedEditAgentId = null; }
    }
  }

  let selectedFurniture = $derived(
    selectedFurnitureId ? FURNITURE_LIST.find((f) => f.id === selectedFurnitureId) ?? null : null
  );

  let selectedEditAgent = $derived(
    selectedEditAgentId && agents[selectedEditAgentId] ? agents[selectedEditAgentId] : null
  );

  function updateAgentMovement(frameCount: number) {
    for (const id of Object.keys(agents)) {
      const agent = agents[id];
      const dx = agent.targetX - agent.currentX;
      const dy = agent.targetY - agent.currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0.3) {
        agent.isWalking = true;
        agent.isTyping = false;
        agent.facingLeft = dx < 0;
        const speed = 0.38;
        agent.currentX += (dx / dist) * speed;
        agent.currentY += (dy / dist) * speed;

        if (frameCount % 6 === 0) {
          agent.walkFrame = (agent.walkFrame + 1) % 4;
        }
      } else {
        agent.currentX = agent.targetX;
        agent.currentY = agent.targetY;
        agent.isWalking = false;
        agent.isTyping = true;
      }
    }
  }

  function triggerAgentMovement(actorId: string, destX: number, destY: number, returnToHomeAfterMs = 4500) {
    const agent = agents[actorId];
    if (!agent) return;
    agent.targetX = destX;
    agent.targetY = destY;

    if (returnToHomeAfterMs > 0) {
      setTimeout(() => {
        if (agents[actorId]) {
          agents[actorId].targetX = agents[actorId].homeX;
          agents[actorId].targetY = agents[actorId].homeY;
        }
      }, returnToHomeAfterMs);
    }
  }

  async function loadAgentRegistry() {
    try {
      const res = await api.listAgents();
      if (res.success && res.data) {
        for (const reg of res.data) {
          if (agents[reg.agentName]) {
            agents[reg.agentName].model = reg.model || 'minimax/minimax-m3:free';
            if (reg.trustProfile?.overallTrust !== undefined) {
              agents[reg.agentName].trustScore = reg.trustProfile.overallTrust;
            }
          }
        }
      }
    } catch (e) {}
  }

  async function loadSimulatorStatus() {
    try {
      const res = await api.getSimulatorStatus();
      if (res.success && res.data) {
        simulatorStatus = res.data;
        if (res.data.pausedByRateLimit) {
          cooldownCountdown = res.data.rateLimitCooldownSeconds;
        }

        if (res.data.isRunning && res.data.lastActor && agents[res.data.lastActor] && res.data.lastSpeechBubble) {
          agents[res.data.lastActor].speechBubble = res.data.lastSpeechBubble;
          agents[res.data.lastActor].status = 'working';
          agents[res.data.lastActor].isTyping = true;
        } else if (!res.data.isRunning) {
          for (const id of Object.keys(agents)) {
            agents[id].isTyping = false;
            agents[id].status = 'idle';
            agents[id].activeEffect = undefined;
          }
        }
      }
    } catch (e: any) {
      errorBanner = e?.message || 'Failed to connect to simulator API';
    }
  }

  async function toggleSimulator() {
    errorBanner = null;
    try {
      if (simulatorStatus.isRunning) {
        const res = await api.stopSimulator();
        if (res.error) errorBanner = res.error.message;
        else {
          simulatorStatus.isRunning = false;
          for (const id of Object.keys(agents)) {
            agents[id].isTyping = false;
            agents[id].status = 'idle';
            agents[id].activeEffect = undefined;
          }
        }
      } else {
        const res = await api.startSimulator({ mode: simulatorStatus.mode, intervalMs: simulatorStatus.intervalMs });
        if (res.error) errorBanner = res.error.message;
        else {
          simulatorStatus.isRunning = true;
        }
      }
      await loadSimulatorStatus();
    } catch (e: any) {
      errorBanner = e?.message;
    }
  }

  async function changeMode(mode: 'NORMAL' | 'FLASH_SALE' | 'CHAOS') {
    simulatorStatus.mode = mode;
    if (simulatorStatus.isRunning) {
      await api.updateSimulatorConfig({ mode });
      await loadSimulatorStatus();
    }
  }

  async function changeInterval(intervalMs: number) {
    simulatorStatus.intervalMs = intervalMs;
    if (simulatorStatus.isRunning) {
      await api.updateSimulatorConfig({ intervalMs });
      await loadSimulatorStatus();
    }
  }

  async function triggerManualCooldown(seconds = 30) {
    try {
      const res = await api.pauseSimulatorCooldown(seconds);
      if (res.success) {
        cooldownCountdown = seconds;
        simulatorStatus.pausedByRateLimit = true;
      }
      await loadSimulatorStatus();
    } catch (e: any) {
      errorBanner = e?.message;
    }
  }

  async function resumeFromCooldown() {
    try {
      const res = await api.resumeSimulatorCooldown();
      if (res.success) {
        cooldownCountdown = 0;
        simulatorStatus.pausedByRateLimit = false;
      }
      await loadSimulatorStatus();
    } catch (e: any) {
      errorBanner = e?.message;
    }
  }

  function handleFurnitureClick(item: Furniture) {
    activeHotspotToast = `${item.label} clicked!`;
    setTimeout(() => {
      activeHotspotToast = null;
    }, 3000);

    const agentKeys = Object.keys(agents);
    const randomAgentId = agentKeys[Math.floor(Math.random() * agentKeys.length)];
    const agent = agents[randomAgentId];
    if (agent) {
      agent.speechBubble = `Interacting with ${item.label}...`;
      agent.activeEffect = item.type === 'coffee' ? 'need-coffee' : item.type === 'printer' ? 'post-it' : 'thumb-up';
      const stand = getStandingSpot(item);
      triggerAgentMovement(agent.id, stand.x, stand.y, 4500);
    }
  }

  function handleEvent(event: any) {
    const meta = event.metadata || {};
    const actorId = meta.actorName || (event.actor?.id as string);
    const targetId = meta.targetAgent as string;
    const speech = meta.speechBubble as string;
    const mood = (meta.mood as any) || 'working';

    if (actorId && agents[actorId]) {
      const ag = agents[actorId];
      ag.status = mood === 'warning' ? 'warning' : mood === 'thinking' ? 'thinking' : 'working';
      ag.isTyping = true;

      if (mood === 'thinking') ag.activeEffect = 'typing';
      else if (mood === 'warning') ag.activeEffect = 'fire';
      else if (event.action?.includes('STOCK') || event.action?.includes('ORDER')) ag.activeEffect = 'rocket';
      else if (event.action?.includes('COOLDOWN')) ag.activeEffect = 'need-coffee';
      else ag.activeEffect = 'thumb-up';

      if (speech) {
        ag.speechBubble = speech;
        ag.recentAction = event.action;
        const tokenCount = Number(meta.tokens ?? meta.totalTokens ?? 0) || 120;

        ag.actionHistory.unshift({
          timestamp: new Date().toLocaleTimeString(),
          action: event.action,
          message: speech,
          tokens: tokenCount
        });
        if (ag.actionHistory.length > 50) ag.actionHistory.pop();

        globalReasoning = [
          {
            id: Math.random().toString(36).slice(2),
            timestamp: new Date().toLocaleTimeString(),
            agentId: ag.id,
            agentName: ag.name,
            color: ag.color,
            action: event.action,
            message: speech,
            tokens: tokenCount,
            toolName: meta.toolName as string | undefined,
            sideEffect: meta.sideEffect as string | undefined,
            toolArgs: meta.arguments ? JSON.stringify(meta.arguments) : undefined,
            toolResult: meta.result ? JSON.stringify(meta.result).slice(0, 400) : undefined,
            toolOk: meta.ok as boolean | undefined,
            durationMs: meta.durationMs as number | undefined,
            toolsUsed: meta.toolsUsed as string[] | undefined,
            writesPerformed: meta.writesPerformed as number | undefined,
            stopReason: meta.stopReason as string | undefined,
            costUsd: meta.estimatedCostUsd as number | undefined
          },
          ...globalReasoning.slice(0, 99)
        ];
      }

      if (meta.tokens) {
        ag.tokensUsed += meta.tokens;
      }

      if (targetId && agents[targetId]) {
        const midX = (ag.homeX + agents[targetId].homeX) / 2;
        const midY = (ag.homeY + agents[targetId].homeY) / 2;
        triggerAgentMovement(actorId, midX, midY, 3500);
      }
    }

    if (actorId && targetId && agents[actorId] && agents[targetId] && actorId !== targetId) {
      spawnPacket(agents[actorId], agents[targetId], meta.speechBubble || event.action);
    }

    recentEvents = [
      {
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        actor: agents[actorId]?.name || actorId || 'System',
        action: event.action,
        message: speech || event.action,
        mood
      },
      ...recentEvents.slice(0, 29)
    ];

    if (event.action === 'AI_RATE_LIMIT_TRIGGERED' || event.action === 'AI_RATE_LIMIT_SUPERVISOR_PAUSE') {
      simulatorStatus.pausedByRateLimit = true;
      cooldownCountdown = meta.cooldownSeconds || 30;
    } else if (event.action === 'AI_RATE_LIMIT_RESOLVED' || event.action === 'AI_RATE_LIMIT_SUPERVISOR_RESUMED') {
      simulatorStatus.pausedByRateLimit = false;
      cooldownCountdown = 0;
    }
  }

  function spawnPacket(fromAgent: AgentDesk, toAgent: AgentDesk, label: string) {
    const packetId = Math.random().toString();
    livePackets = [
      ...livePackets,
      {
        id: packetId,
        fromX: fromAgent.currentX,
        fromY: fromAgent.currentY,
        toX: toAgent.currentX,
        toY: toAgent.currentY,
        color: fromAgent.color,
        label: label.substring(0, 24) + (label.length > 24 ? '...' : '')
      }
    ];

    setTimeout(() => {
      livePackets = livePackets.filter((p) => p.id !== packetId);
    }, 1800);
  }

  function getSpriteUrl(agent: AgentDesk): string {
    if (agent.isWalking) {
      return `/sprites/${agent.spriteBase}-walk-${agent.walkFrame}.png`;
    }
    return `/sprites/${agent.spriteBase}.png`;
  }

  function selectAgent(agent: AgentDesk) {
    selectedAgentId = agent.id;
    historyScope = 'agent';
    isInspectorOpen = true;
  }
</script>

<svelte:head>
  <title>Autonomous Enterprise - 2D Virtual Office</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=JetBrains+Mono:wght@400;600;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<svelte:window onkeydown={nudgeSelected} />

{#snippet reasoningEntry(entry: any)}
  <div class="history-item" style="border-left-color: {entry.color}">
    <div class="history-meta">
      <span class="history-act" style="color: {entry.color}">{entry.agentName}</span>
      <span class="history-ts">{entry.timestamp}</span>
    </div>
    <span class="history-action-tag">{entry.action}</span>

    {#if entry.toolName}
      <div class="tool-trace" class:tool-write={entry.sideEffect !== 'READ'} class:tool-failed={entry.toolOk === false}>
        <div class="tool-trace-head">
          <span class="tool-badge" class:write={entry.sideEffect !== 'READ'}>
            {entry.sideEffect === 'READ' ? 'READ' : entry.sideEffect === 'CRITICAL_WRITE' ? 'CRITICAL WRITE' : 'WRITE'}
          </span>
          <code class="tool-name">{entry.toolName}()</code>
          {#if entry.durationMs !== undefined}
            <span class="tool-dur">{entry.durationMs}ms</span>
          {/if}
          <span class="tool-status">{entry.toolOk === false ? '✕' : '✓'}</span>
        </div>
        {#if entry.toolArgs && entry.toolArgs !== '{}'}
          <div class="tool-row"><span class="tool-label">args</span><code>{entry.toolArgs}</code></div>
        {/if}
        {#if entry.toolResult}
          <div class="tool-row"><span class="tool-label">result</span><code>{entry.toolResult}</code></div>
        {/if}
      </div>
    {:else}
      <p class="history-txt">"{entry.message}"</p>
    {/if}

    {#if entry.toolsUsed?.length}
      <div class="run-summary">
        <span class="run-chip">{entry.toolsUsed.length} tool calls</span>
        {#if entry.writesPerformed}
          <span class="run-chip write">{entry.writesPerformed} DB writes</span>
        {/if}
        {#if entry.stopReason}
          <span class="run-chip">{entry.stopReason}</span>
        {/if}
        {#if entry.costUsd}
          <span class="run-chip">${entry.costUsd.toFixed(5)}</span>
        {/if}
      </div>
      <div class="tool-chain">
        {#each entry.toolsUsed as t, i (i)}
          <code class="chain-node">{t}</code>{#if i < entry.toolsUsed.length - 1}<span class="chain-arrow">→</span>{/if}
        {/each}
      </div>
    {/if}

    <span class="history-tok">⚡ {entry.tokens} tokens</span>
  </div>
{/snippet}

<div class="office-page-root" class:night-theme={isNightMode}>
  <!-- Top Control Arcade Bar -->
  <div class="arcade-header">
    <div class="header-left-col">
      <div class="status-badge" class:running={simulatorStatus.isRunning} class:paused={simulatorStatus.pausedByRateLimit}>
        <span class="pulsing-led"></span>
        <span class="status-txt">{simulatorStatus.pausedByRateLimit ? '429 COOLDOWN' : simulatorStatus.isRunning ? 'LIVE AUTONOMOUS SIM' : 'SIMULATOR PAUSED'}</span>
      </div>

      <div class="sim-btn-group">
        <button 
          class="sim-toggle-btn" 
          class:is-active={simulatorStatus.isRunning} 
          onclick={toggleSimulator}
        >
          {simulatorStatus.isRunning ? '⏹ STOP' : '▶ START'}
        </button>

        <div class="mode-pills">
          <button class="mode-pill" class:active={simulatorStatus.mode === 'NORMAL'} onclick={() => changeMode('NORMAL')}>NORMAL</button>
          <button class="mode-pill" class:active={simulatorStatus.mode === 'FLASH_SALE'} onclick={() => changeMode('FLASH_SALE')}>⚡ FLASH SALE</button>
          <button class="mode-pill" class:active={simulatorStatus.mode === 'CHAOS'} onclick={() => changeMode('CHAOS')}>🌪️ CHAOS</button>
        </div>

        <div class="speed-pills">
          <button class="speed-pill" class:active={simulatorStatus.intervalMs === 3000} onclick={() => changeInterval(3000)}>1x (3s)</button>
          <button class="speed-pill" class:active={simulatorStatus.intervalMs === 1500} onclick={() => changeInterval(1500)}>2x (1.5s)</button>
          <button class="speed-pill" class:active={simulatorStatus.intervalMs === 750} onclick={() => changeInterval(750)}>4x (0.75s)</button>
        </div>
      </div>
    </div>

    <div class="header-right-col">
      <div class="metrics-strip">
        <div class="metric-item">
          <span class="m-val">{simulatorStatus.totalTicks}</span>
          <span class="m-lbl">TICKS</span>
        </div>
        <div class="metric-item">
          <span class="m-val success">{simulatorStatus.successfulActions}</span>
          <span class="m-lbl">EXECUTED</span>
        </div>
        <div class="metric-item">
          <span class="m-val accent">{Object.values(agents).reduce((acc, a) => acc + a.tokensUsed, 0).toLocaleString()}</span>
          <span class="m-lbl">TOKENS</span>
        </div>
      </div>

      <div class="utility-btns">
        {#if simulatorStatus.pausedByRateLimit || cooldownCountdown > 0}
          <button class="cooldown-resume-btn" onclick={resumeFromCooldown}>
            RESUME ({cooldownCountdown}s)
          </button>
        {:else}
          <button class="cooldown-test-btn" onclick={() => triggerManualCooldown(30)}>
            TEST 429
          </button>
        {/if}

        <button class="theme-toggle-btn" onclick={() => (isNightMode = !isNightMode)}>
          {isNightMode ? '🌙 NIGHT' : '☀️ DAY'}
        </button>

        <button class="edit-layout-btn" class:active={isEditMode} onclick={toggleEditMode}>
          {isEditMode ? '✓ DONE EDITING' : '✎ EDIT LAYOUT'}
        </button>

        <button class="inspector-toggle-btn" class:active={isInspectorOpen} onclick={() => (isInspectorOpen = !isInspectorOpen)}>
          📊 {isInspectorOpen ? 'HIDE PANEL' : 'INSPECT'}
        </button>
      </div>
    </div>
  </div>

  {#if simulatorStatus.pausedByRateLimit || cooldownCountdown > 0}
    <div class="emergency-cooldown-bar">
      <span class="shield-icon">🛡️</span>
      <div class="shield-text">
        <strong>SUPERVISOR HTTP 429 COOLDOWN ACTIVE</strong>: OmniRouter rate limits intercepted. Auto-resuming in {cooldownCountdown}s.
      </div>
      <button class="btn-override" onclick={resumeFromCooldown}>MANUAL OVERRIDE</button>
    </div>
  {/if}

  {#if activeHotspotToast}
    <div class="hotspot-toast-popup">
      <span>{activeHotspotToast}</span>
    </div>
  {/if}

  {#if layoutSavedToast}
    <div class="layout-toast-popup">
      <span>{layoutSavedToast}</span>
    </div>
  {/if}

  {#if isEditMode}
    <div class="layout-editor-bar">
      <div class="editor-left">
        <span class="editor-badge">✎ LAYOUT EDITOR</span>
        {#if selectedFurniture}
          <span class="editor-target">{selectedFurniture.label}</span>
          <div class="editor-fields">
            <label class="editor-field">
              X
              <input
                type="number" step="0.5"
                value={selectedFurniture.x}
                oninput={(e) => adjustSelected('x', Number((e.target as HTMLInputElement).value) - selectedFurniture!.x)}
              />
            </label>
            <label class="editor-field">
              Y
              <input
                type="number" step="0.5"
                value={selectedFurniture.y}
                oninput={(e) => adjustSelected('y', Number((e.target as HTMLInputElement).value) - selectedFurniture!.y)}
              />
            </label>
            <label class="editor-field">
              W
              <input
                type="number" step="0.5" min="1"
                value={selectedFurniture.width}
                oninput={(e) => adjustSelected('width', Number((e.target as HTMLInputElement).value) - selectedFurniture!.width)}
              />
            </label>
            <label class="editor-field">
              H
              <input
                type="number" step="0.5" min="1"
                value={selectedFurniture.height}
                oninput={(e) => adjustSelected('height', Number((e.target as HTMLInputElement).value) - selectedFurniture!.height)}
              />
            </label>
          </div>
          <div class="editor-size-btns">
            <button onclick={() => { adjustSelected('width', -1); adjustSelected('height', -1.2); }}>− Smaller</button>
            <button onclick={() => { adjustSelected('width', 1); adjustSelected('height', 1.2); }}>+ Bigger</button>
          </div>
        {:else if selectedEditAgent}
          <span class="editor-target" style="color: {selectedEditAgent.color};">{selectedEditAgent.avatar} {selectedEditAgent.name} (AGENT)</span>
          <div class="editor-fields">
            <label class="editor-field">
              X
              <input
                type="number" step="0.5"
                value={selectedEditAgent.homeX}
                oninput={(e) => adjustAgentPos(selectedEditAgent!.id, 'x', Number((e.target as HTMLInputElement).value) - selectedEditAgent!.homeX)}
              />
            </label>
            <label class="editor-field">
              Y
              <input
                type="number" step="0.5"
                value={selectedEditAgent.homeY}
                oninput={(e) => adjustAgentPos(selectedEditAgent!.id, 'y', Number((e.target as HTMLInputElement).value) - selectedEditAgent!.homeY)}
              />
            </label>
          </div>
          <div class="editor-size-btns">
            <button onclick={() => adjustAgentPos(selectedEditAgent!.id, 'x', -1)}>← Left</button>
            <button onclick={() => adjustAgentPos(selectedEditAgent!.id, 'x', 1)}>Right →</button>
            <button onclick={() => adjustAgentPos(selectedEditAgent!.id, 'y', -1)}>↑ Up</button>
            <button onclick={() => adjustAgentPos(selectedEditAgent!.id, 'y', 1)}>Down ↓</button>
          </div>
        {:else}
          <span class="editor-hint">Drag any furniture or agent character to move. Click to fine-tune with inputs or arrow keys.</span>
        {/if}
      </div>

      <div class="editor-right">
        <button class="editor-action save" onclick={() => persistLayout(true)}>💾 SAVE</button>
        <button class="editor-action" onclick={exportLayout}>⧉ COPY JSON</button>
        <button class="editor-action danger" onclick={resetLayout}>↺ RESET</button>
      </div>
    </div>
  {/if}

  <!-- Main Viewport Area -->
  <div class="viewport-wrapper">
    <!-- Isometric Office Floor Canvas -->
    <div class="office-stage-container">
      <div class="isometric-canvas" class:edit-mode={isEditMode} bind:this={stageEl}>
        <!-- Office Room Background -->
        <img 
          src={isNightMode ? '/rooms/office-night.png' : '/rooms/office-day.png'} 
          alt="Virtual Office Isometric Plan" 
          class="stage-background"
        />

        {#if isEditMode}
          <div class="edit-grid-overlay"></div>
        {/if}

        <!-- Furniture Layer (Standing Desks, Monitors, Plants, Coffee Machine, Water Cooler) -->
        {#each FURNITURE_LIST as item (item.id)}
          <div
            class="furniture-piece"
            class:interactive={item.isInteractive}
            class:editable={isEditMode}
            class:selected-furniture={selectedFurnitureId === item.id}
            style="left: {item.x}%; top: {item.y}%; width: {item.width}%; z-index: {isEditMode && selectedFurnitureId === item.id ? 900 : Math.round(item.y * 10)};"
            onpointerdown={(e) => (isEditMode ? startDrag(e, item) : undefined)}
            onpointermove={onDrag}
            onpointerup={endDrag}
            onpointercancel={endDrag}
            onclick={() => (isEditMode ? (selectedFurnitureId = item.id) : handleFurnitureClick(item))}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && (isEditMode ? (selectedFurnitureId = item.id) : handleFurnitureClick(item))}
          >
            <img src={item.sprite} alt={item.label} class="furniture-img" draggable="false" />

            <!-- Dual Glowing Monitors & Screen Glow on Standing Desks -->
            {#if item.hasMonitor}
              <div class="desk-monitor-glow">
                <div class="monitor-screen monitor-left"></div>
                <div class="monitor-screen monitor-right"></div>
              </div>
            {/if}

            {#if item.isInteractive && !isEditMode}
              <span class="interactive-marker">✨</span>
            {/if}

            {#if isEditMode}
              <span class="edit-item-tag">{item.label}</span>
            {/if}
          </div>
        {/each}

        <!-- Communication Packets Flying Across Floor -->
        {#each livePackets as pkt (pkt.id)}
          <div
            class="flight-packet"
            style="--from-x: {pkt.fromX}%; --from-y: {pkt.fromY}%; --to-x: {pkt.toX}%; --to-y: {pkt.toY}%; --pkt-color: {pkt.color};"
          >
            <span class="packet-tag">{pkt.label}</span>
          </div>
        {/each}

        <!-- AI Agent Characters Layer (Standing in Front of Desks & Monitors) -->
        {#each Object.values(agents) as agent (agent.id)}
          <div
            class="character-entity"
            class:selected={selectedAgent?.id === agent.id}
            class:selected-agent-edit={isEditMode && selectedEditAgentId === agent.id}
            class:editable={isEditMode}
            class:walking={agent.isWalking}
            class:facing-left={agent.facingLeft}
            style="left: {agent.currentX}%; top: {agent.currentY}%; z-index: {isEditMode && selectedEditAgentId === agent.id ? 950 : Math.round(agent.currentY * 10) + 60};"
            onpointerdown={(e) => (isEditMode ? startAgentDrag(e, agent) : undefined)}
            onpointermove={onDrag}
            onpointerup={endDrag}
            onpointercancel={endDrag}
            onclick={() => (isEditMode ? selectEditAgent(agent) : selectAgent(agent))}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && (isEditMode ? selectEditAgent(agent) : selectAgent(agent))}
          >
            <!-- Continuous Dynamic Live Thought Speech Bubble Above Head -->
            <div class="character-speech-bubble" style="--role-accent: {agent.color};">
              <div class="bubble-header-bar">
                <span class="bubble-role-tag">{agent.shortRole}</span>
                <span class="bubble-status-pill" class:typing={agent.isTyping} class:walking={agent.isWalking}>
                  {agent.isWalking ? 'WALKING' : 'ACTIVE'}
                </span>
              </div>
              <div class="bubble-body-text">
                {agent.speechBubble}
              </div>
              <div class="bubble-pointer"></div>
            </div>

            <!-- Overhead Action Effect Icon (e.g. typing, coffee, rocket, fire) -->
            {#if agent.activeEffect}
              <div class="overhead-effect">
                <img src="/sprites/effects/{agent.activeEffect}.png" alt={agent.activeEffect} />
              </div>
            {/if}

            <!-- Character Sprite with Typing / Walk Cycles -->
            <div class="sprite-container">
              <img 
                src={getSpriteUrl(agent)} 
                alt={agent.name} 
                class="character-sprite"
                class:typing-bounce={agent.isTyping && !agent.isWalking}
              />
              <div class="ground-shadow"></div>
            </div>

            <!-- Character Floor Badge -->
            <div class="character-nameplate" style="--plate-color: {agent.color};">
              <span class="nameplate-title">{agent.name}</span>
            </div>
          </div>
        {/each}
      </div>

      <!-- Bottom Real-Time Event Banner on Office Floor -->
      <div class="floor-event-ticker">
        <div class="ticker-prefix">
          <span class="ticker-dot"></span>
          <span>LIVE REDIS EVENT STREAM:</span>
        </div>
        <div class="ticker-scroll-text">
          {#if recentEvents.length > 0}
            <span class="t-actor">[{recentEvents[0].actor}]</span>
            <span class="t-msg">{recentEvents[0].message}</span>
            <span class="t-time">({recentEvents[0].time})</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Sliding Inspector & Live Reasoning Drawer -->
    {#if isInspectorOpen}
      <div class="side-inspector-drawer" class:expanded={isDrawerExpanded}>
        <div class="drawer-header">
          <span class="drawer-title">⚡ AGENT REASONING STREAM</span>
          <div class="drawer-header-actions">
            <button
              class="drawer-expand-btn"
              title={isDrawerExpanded ? 'Collapse panel' : 'Expand panel for full stream view'}
              onclick={() => (isDrawerExpanded = !isDrawerExpanded)}
            >
              {isDrawerExpanded ? '⇥ COLLAPSE' : '⇤ EXPAND'}
            </button>
            <button class="drawer-close-btn" onclick={() => (isInspectorOpen = false)}>✕</button>
          </div>
        </div>

        {#if selectedAgent}
          <div class="agent-detail-card" style="border-top-color: {selectedAgent.color}">
            <div class="detail-top-row">
              <div class="detail-avatar-box">
                <img src="/sprites/{selectedAgent.spriteBase}.png" alt={selectedAgent.name} class="detail-sprite-img" />
              </div>
              <div>
                <h3 class="detail-name">{selectedAgent.name}</h3>
                <span class="detail-role">{selectedAgent.role}</span>
              </div>
            </div>

            <div class="detail-grid">
              <div class="detail-tile">
                <span class="tile-label">AI MODEL</span>
                <span class="tile-value mono">{selectedAgent.model}</span>
              </div>
              <div class="detail-tile">
                <span class="tile-label">TRUST SCORE</span>
                <span class="tile-value green">{(selectedAgent.trustScore * 100).toFixed(0)}%</span>
              </div>
              <div class="detail-tile">
                <span class="tile-label">TOKENS</span>
                <span class="tile-value">{selectedAgent.tokensUsed.toLocaleString()}</span>
              </div>
              <div class="detail-tile">
                <span class="tile-label">LOCATION</span>
                <span class="tile-value">{selectedAgent.zone}</span>
              </div>
            </div>

            <div class="quick-dispatch-actions">
              <span class="dispatch-title">MANUAL DISPATCH</span>
              <div class="dispatch-row">
                <button class="dispatch-btn" onclick={() => dispatchAgentTo(selectedAgent!.id, 'coffee-bar')}>☕ Espresso Bar</button>
                <button class="dispatch-btn" onclick={() => dispatchAgentTo(selectedAgent!.id, 'desk-mgr-1')}>🧠 Orchestrator</button>
                <button class="dispatch-btn" onclick={() => dispatchAgentTo(selectedAgent!.id, 'printer-1')}>🖨️ Printer</button>
              </div>
            </div>

            <div class="thought-history-section">
              <div class="history-head-row">
                <span class="history-title">REASONING HISTORY (LIVE STREAM)</span>
                <div class="scope-toggle">
                  <button
                    class="scope-btn"
                    class:active={historyScope === 'agent'}
                    onclick={() => (historyScope = 'agent')}
                  >THIS AGENT ({selectedAgent.actionHistory.length})</button>
                  <button
                    class="scope-btn"
                    class:active={historyScope === 'all'}
                    onclick={() => (historyScope = 'all')}
                  >ALL AGENTS ({globalReasoning.length})</button>
                </div>
              </div>

              <div class="history-list">
                {#if historyScope === 'agent'}
                  {#if selectedAgent.actionHistory.length === 0}
                    <div class="history-empty">
                      No reasoning yet for {selectedAgent.name}. The simulator rotates through agents,
                      so switch to <strong>ALL AGENTS</strong> to see the full live stream.
                    </div>
                  {:else}
                    {#each selectedAgent.actionHistory as act}
                      <div class="history-item" style="border-left-color: {selectedAgent.color}">
                        <div class="history-meta">
                          <span class="history-act">{act.action}</span>
                          <span class="history-ts">{act.timestamp}</span>
                        </div>
                        <p class="history-txt">"{act.message}"</p>
                        <span class="history-tok">⚡ {act.tokens} tokens</span>
                      </div>
                    {/each}
                  {/if}
                {:else}
                  {#if globalReasoning.length === 0}
                    <div class="history-empty">
                      Waiting for live OmniRouter reasoning. Start the simulator to populate this stream.
                    </div>
                  {:else}
                    {#each globalReasoning as entry (entry.id)}
                      {@render reasoningEntry(entry)}
                    {/each}
                  {/if}
                {/if}
              </div>
            </div>
          </div>
        {:else}
          <div class="global-stream-panel">
            <div class="history-head-row">
              <span class="history-title">ALL AGENTS REASONING STREAM ({globalReasoning.length})</span>
              <span class="stream-hint">Click an agent for details</span>
            </div>
            <div class="history-list global">
              {#if globalReasoning.length === 0}
                <div class="history-empty">
                  Waiting for live OmniRouter reasoning. Start the simulator to populate this stream.
                </div>
              {:else}
                {#each globalReasoning as entry (entry.id)}
                  {@render reasoningEntry(entry)}
                {/each}
              {/if}
            </div>
          </div>
        {/if}

        <!-- Bottom Event Ticker inside Drawer -->
        <div class="drawer-event-ticker">
          <div class="ticker-top">
            <span class="ticker-title">TERMINAL EVENTS ({recentEvents.length})</span>
          </div>
          <div class="ticker-feed">
            {#each recentEvents as ev (ev.id)}
              <div class="feed-entry" class:warn={ev.mood === 'warning'}>
                <span class="feed-ts">[{ev.time}]</span>
                <span class="feed-actor">{ev.actor}:</span>
                <span class="feed-msg">{ev.message}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .office-page-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    max-height: calc(100vh - 60px);
    background: #cbd5e1;
    color: #0f172a;
    font-family: var(--font-sans);
    overflow: hidden;
    position: relative;
    box-sizing: border-box;
  }
  .office-page-root.night-theme {
    background: #090a0f;
    color: #e2e8f0;
  }

  /* Arcade Header Strip */
  .arcade-header {
    height: 48px;
    background: #ffffff;
    border-bottom: 1px solid #cbd5e1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    flex-shrink: 0;
    gap: 12px;
  }
  .night-theme .arcade-header {
    background: #11141d;
    border-bottom: 1px solid #242b3d;
  }

  .header-left-col {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
  }
  .night-theme .status-badge {
    background: #181d2a;
    border: 1px solid #2d3748;
  }

  .status-badge.running {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }

  .status-badge.paused {
    border-color: #f59e0b;
    background: rgba(245, 158, 11, 0.15);
  }

  .pulsing-led {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #64748b;
  }

  .status-badge.running .pulsing-led {
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
  }

  .status-badge.paused .pulsing-led {
    background: #f59e0b;
    box-shadow: 0 0 6px #f59e0b;
    animation: blinkLed 1s infinite;
  }

  @keyframes blinkLed {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .status-txt {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #e2e8f0;
  }

  .sim-btn-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sim-toggle-btn {
    background: #10b981;
    color: #042f1d;
    border: none;
    padding: 5px 12px;
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 700;
  }

  .sim-toggle-btn.is-active {
    background: #ef4444;
    color: #fff;
  }

  .mode-pills, .speed-pills {
    display: flex;
    gap: 3px;
  }

  .mode-pill, .speed-pill {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    color: #475569;
    padding: 3px 7px;
    font-size: 9px;
    font-family: var(--font-mono);
    border-radius: 3px;
    cursor: pointer;
    font-weight: 500;
  }

  .mode-pill.active, .speed-pill.active {
    background: #2563eb;
    border-color: #2563eb;
    color: #fff;
    font-weight: 600;
  }

  .night-theme .mode-pill, .night-theme .speed-pill {
    background: #1a202c;
    border-color: #2d3748;
    color: #94a3b8;
  }
  .night-theme .mode-pill.active, .night-theme .speed-pill.active {
    background: #3b82f6;
    border-color: #60a5fa;
    color: #fff;
  }

  .header-right-col {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .metrics-strip {
    display: flex;
    align-items: center;
    gap: 10px;
    border-left: 1px solid #e2e8f0;
    padding-left: 10px;
  }
  .night-theme .metrics-strip {
    border-left-color: #242b3d;
  }

  .metric-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .m-val {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: #0f172a;
  }
  .night-theme .m-val {
    color: #f8fafc;
  }

  .m-val.success { color: #059669; }
  .m-val.accent { color: #0284c7; }

  .m-lbl {
    font-family: var(--font-mono);
    font-size: 8px;
    color: #64748b;
    font-weight: 600;
  }

  .utility-btns {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .cooldown-test-btn, .cooldown-resume-btn, .theme-toggle-btn, .inspector-toggle-btn {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    color: #334155;
    padding: 4px 8px;
    font-size: 9px;
    font-family: var(--font-mono);
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }
  .night-theme .cooldown-test-btn, .night-theme .cooldown-resume-btn, .night-theme .theme-toggle-btn, .night-theme .inspector-toggle-btn {
    background: #1e2433;
    border: 1px solid #333d52;
    color: #cbd5e1;
  }

  .cooldown-test-btn {
    background: #78350f;
    color: #fde68a;
    border-color: #b45309;
  }

  .cooldown-resume-btn {
    background: #dc2626;
    color: #fee2e2;
    font-weight: 700;
    animation: pulseWarn 1s infinite alternate;
  }

  @keyframes pulseWarn {
    0% { box-shadow: 0 0 2px #dc2626; }
    100% { box-shadow: 0 0 12px #ef4444; }
  }

  .inspector-toggle-btn.active {
    background: #3b82f6;
    color: #fff;
    border-color: #60a5fa;
  }

  .emergency-cooldown-bar {
    background: linear-gradient(90deg, #7f1d1d, #991b1b);
    border-bottom: 2px solid #ef4444;
    padding: 6px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #fee2e2;
    font-size: 10px;
    flex-shrink: 0;
  }

  .btn-override {
    background: #ef4444;
    color: #fff;
    border: none;
    padding: 3px 8px;
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    border-radius: 3px;
    cursor: pointer;
  }

  .edit-layout-btn {
    background: #1e2433;
    border: 1px solid #333d52;
    color: #cbd5e1;
    padding: 4px 8px;
    font-size: 9px;
    font-family: 'JetBrains Mono', monospace;
    border-radius: 4px;
    cursor: pointer;
  }

  .edit-layout-btn.active {
    background: #7c3aed;
    border-color: #a78bfa;
    color: #fff;
    font-weight: 700;
  }

  .layout-editor-bar {
    background: #16112a;
    border-bottom: 2px solid #7c3aed;
    padding: 6px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .editor-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .editor-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #c4b5fd;
    white-space: nowrap;
  }

  .editor-target {
    font-size: 11px;
    font-weight: 600;
    color: #f8fafc;
    background: rgba(124, 58, 237, 0.25);
    border: 1px solid #7c3aed;
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .editor-hint {
    font-size: 11px;
    color: #a5b4fc;
  }

  .editor-fields {
    display: flex;
    gap: 6px;
  }

  .editor-field {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    font-family: 'JetBrains Mono', monospace;
    color: #a5b4fc;
  }

  .editor-field input {
    width: 58px;
    background: #0d111a;
    border: 1px solid #333d52;
    color: #f1f5f9;
    padding: 3px 5px;
    font-size: 10px;
    border-radius: 3px;
    font-family: 'JetBrains Mono', monospace;
  }

  .editor-size-btns {
    display: flex;
    gap: 4px;
  }

  .editor-size-btns button {
    background: #1e2433;
    border: 1px solid #4c1d95;
    color: #ddd6fe;
    padding: 3px 8px;
    font-size: 10px;
    border-radius: 3px;
    cursor: pointer;
  }

  .editor-size-btns button:hover {
    background: #4c1d95;
    color: #fff;
  }

  .editor-right {
    display: flex;
    gap: 6px;
  }

  .editor-action {
    background: #1e2433;
    border: 1px solid #333d52;
    color: #cbd5e1;
    padding: 4px 10px;
    font-size: 9px;
    font-family: 'JetBrains Mono', monospace;
    border-radius: 4px;
    cursor: pointer;
  }

  .editor-action.save {
    background: #059669;
    border-color: #10b981;
    color: #ecfdf5;
    font-weight: 700;
  }

  .editor-action.danger {
    background: #7f1d1d;
    border-color: #dc2626;
    color: #fee2e2;
  }

  .editor-action:hover { filter: brightness(1.18); }

  .layout-toast-popup {
    position: absolute;
    top: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: #2e1065;
    border: 1px solid #a78bfa;
    color: #ddd6fe;
    padding: 6px 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    border-radius: 4px;
    z-index: 999;
    box-shadow: 0 4px 16px rgba(0,0,0,0.7);
  }

  .edit-grid-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
    background-image:
      linear-gradient(rgba(167, 139, 250, 0.14) 1px, transparent 1px),
      linear-gradient(90deg, rgba(167, 139, 250, 0.14) 1px, transparent 1px);
    background-size: 10% 10%;
  }

  .isometric-canvas.edit-mode {
    outline: 2px dashed rgba(167, 139, 250, 0.5);
    outline-offset: -2px;
  }

  .furniture-piece.editable {
    cursor: grab;
    touch-action: none;
  }

  .furniture-piece.editable:active {
    cursor: grabbing;
  }

  .furniture-piece.editable::after {
    content: '';
    position: absolute;
    inset: -4px;
    border: 1px dashed rgba(167, 139, 250, 0.55);
    border-radius: 4px;
    pointer-events: none;
  }

  .furniture-piece.selected-furniture::after {
    border: 2px solid #a78bfa;
    box-shadow: 0 0 14px rgba(167, 139, 250, 0.75);
  }

  .character-entity.editable {
    cursor: grab;
    touch-action: none;
  }
  .character-entity.editable:active {
    cursor: grabbing;
  }
  .character-entity.selected-agent-edit {
    filter: drop-shadow(0 0 10px #38bdf8);
  }
  .character-entity.selected-agent-edit .sprite-container {
    outline: 2px dashed #38bdf8;
    outline-offset: 4px;
    border-radius: 6px;
  }

  .edit-item-tag {
    position: absolute;
    top: -16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(46, 16, 101, 0.95);
    border: 1px solid #7c3aed;
    color: #ddd6fe;
    font-size: 9px;
    font-family: 'JetBrains Mono', monospace;
    padding: 1px 5px;
    border-radius: 3px;
    white-space: nowrap;
    pointer-events: none;
  }

  .hotspot-toast-popup {
    position: absolute;
    top: 56px;
    left: 50%;
    transform: translateX(-50%);
    background: #1e293b;
    border: 1px solid #38bdf8;
    color: #38bdf8;
    padding: 6px 14px;
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    border-radius: 4px;
    z-index: 100;
    box-shadow: 0 4px 16px rgba(0,0,0,0.6);
  }

  /* Viewport Layout */
  .viewport-wrapper {
    flex: 1;
    display: flex;
    position: relative;
    overflow: hidden;
    min-height: 0;
    width: 100%;
  }

  .office-stage-container {
    flex: 1;
    position: relative;
    background: #06070a;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: auto;
    min-width: 0;
    min-height: 0;
    padding: 8px 12px 36px 12px;
  }

  .isometric-canvas {
    position: relative;
    width: min(100%, calc((100vh - 140px) * 1.333));
    aspect-ratio: 4 / 3;
    max-width: 1100px;
    background: #0d111a;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08);
    overflow: visible;
  }

  .stage-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    image-rendering: pixelated;
    border-radius: 8px;
    pointer-events: none;
  }

  /* Furniture Pieces */
  .furniture-piece {
    position: absolute;
    transform: translate(-50%, -80%);
    pointer-events: auto;
  }

  .furniture-piece.interactive {
    cursor: pointer;
  }

  .furniture-img {
    width: 100%;
    height: auto;
    image-rendering: pixelated;
    display: block;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.6));
  }

  .desk-monitor-glow {
    position: absolute;
    top: 40%;
    left: 18%;
    width: 64%;
    height: 22%;
    display: flex;
    gap: 4px;
    pointer-events: none;
  }

  .monitor-screen {
    flex: 1;
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.6), rgba(99, 102, 241, 0.4));
    border-radius: 1px;
    box-shadow: 0 0 6px rgba(56, 189, 248, 0.7);
    animation: monitorFlicker 2.5s infinite alternate;
  }

  @keyframes monitorFlicker {
    0% { opacity: 0.6; }
    50% { opacity: 0.85; box-shadow: 0 0 10px rgba(56, 189, 248, 0.8); }
    100% { opacity: 0.65; }
  }

  .interactive-marker {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    animation: bounceMarker 1s infinite alternate;
  }

  @keyframes bounceMarker {
    0% { transform: translate(-50%, 0); }
    100% { transform: translate(-50%, -4px); }
  }

  /* Flying Data Packets */
  .flight-packet {
    position: absolute;
    left: var(--from-x);
    top: var(--from-y);
    z-index: 80;
    pointer-events: none;
    animation: flyPacketAnim 1.8s ease-in-out forwards;
  }

  @keyframes flyPacketAnim {
    0% { left: var(--from-x); top: var(--from-y); opacity: 0; transform: scale(0.6); }
    20% { opacity: 1; transform: scale(1); }
    80% { opacity: 1; transform: scale(1); }
    100% { left: var(--to-x); top: var(--to-y); opacity: 0; transform: scale(0.6); }
  }

  .packet-tag {
    background: var(--pkt-color, #3b82f6);
    color: #fff;
    padding: 2px 6px;
    font-size: 7px;
    font-family: 'JetBrains Mono', monospace;
    border-radius: 3px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    white-space: nowrap;
  }

  /* Character Entities - Scaled Larger & Positioned Clear of Desks */
  .character-entity {
    position: absolute;
    transform: translate(-50%, -88%);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: left 0.1s linear, top 0.1s linear;
  }

  .character-entity.facing-left .sprite-container img {
    transform: scaleX(-1);
  }

  .sprite-container {
    position: relative;
    width: 78px;
    height: 108px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .character-sprite {
    width: 78px;
    height: 108px;
    object-fit: contain;
    image-rendering: pixelated;
    filter: drop-shadow(0 8px 14px rgba(0,0,0,0.85));
  }

  .character-sprite.typing-bounce {
    animation: subtleType 0.6s infinite alternate;
  }

  @keyframes subtleType {
    0% { transform: translateY(0); }
    100% { transform: translateY(-4px); }
  }

  .ground-shadow {
    position: absolute;
    bottom: -3px;
    width: 48px;
    height: 12px;
    background: rgba(0, 0, 0, 0.55);
    border-radius: 50%;
    z-index: -1;
  }

  /* Continuous Live Speech Bubble Above Character Head */
  .character-speech-bubble {
    position: absolute;
    bottom: 140px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.96);
    border: 2px solid var(--role-accent, #3b82f6);
    border-radius: 6px;
    padding: 6px 10px;
    width: 200px;
    max-width: 240px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.9);
    pointer-events: none;
    z-index: 150;
  }

  .bubble-header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3px;
  }

  .bubble-role-tag {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: var(--role-accent, #38bdf8);
  }

  .bubble-status-pill {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    background: rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .bubble-status-pill.typing {
    color: #10b981;
    background: rgba(16, 185, 129, 0.25);
  }

  .bubble-body-text {
    font-size: 10px;
    line-height: 1.3;
    color: #f8fafc;
    font-family: 'Inter', sans-serif;
    word-break: break-word;
  }

  .bubble-pointer {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid var(--role-accent, #3b82f6);
  }

  .overhead-effect {
    position: absolute;
    top: -34px;
    animation: effectFloat 0.8s infinite alternate;
  }

  .overhead-effect img {
    width: 28px;
    height: 28px;
    image-rendering: pixelated;
  }

  @keyframes effectFloat {
    0% { transform: translateY(0); }
    100% { transform: translateY(-5px); }
  }

  .character-nameplate {
    margin-top: 1px;
    background: rgba(10, 15, 26, 0.9);
    border: 1px solid var(--plate-color, #334155);
    padding: 1px 5px;
    border-radius: 3px;
    white-space: nowrap;
  }

  .nameplate-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    color: #cbd5e1;
  }

  /* Bottom Real-Time Event Banner on Floor */
  .floor-event-ticker {
    position: absolute;
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 24px);
    max-width: 1100px;
    background: rgba(15, 20, 31, 0.9);
    border: 1px solid #242b3d;
    border-radius: 4px;
    padding: 4px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    z-index: 120;
  }

  .ticker-prefix {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #10b981;
    font-weight: 700;
    font-size: 8px;
    font-family: 'Press Start 2P', monospace;
    white-space: nowrap;
  }

  .ticker-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
  }

  .ticker-scroll-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #e2e8f0;
  }

  .t-actor { color: #38bdf8; font-weight: 600; margin-right: 4px; }
  .t-msg { color: #f1f5f9; margin-right: 6px; }
  .t-time { color: #64748b; font-size: 8px; }

  /* Drawer Panel */
  .side-inspector-drawer {
    width: 360px;
    background: #0d111a;
    border-left: 1px solid #242b3d;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    transition: width 0.2s ease;
  }

  .side-inspector-drawer.expanded {
    width: 62%;
    min-width: 620px;
  }

  .drawer-header {
    height: 36px;
    flex-shrink: 0;
    background: #141924;
    border-bottom: 1px solid #242b3d;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
  }

  .drawer-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .drawer-expand-btn {
    background: #1e2433;
    border: 1px solid #333d52;
    color: #cbd5e1;
    padding: 3px 8px;
    font-size: 9px;
    font-family: 'JetBrains Mono', monospace;
    border-radius: 3px;
    cursor: pointer;
  }

  .drawer-expand-btn:hover {
    background: #2b3347;
    color: #fff;
    border-color: #3b82f6;
  }

  .drawer-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #10b981;
  }

  .drawer-close-btn {
    background: none;
    border: none;
    color: #64748b;
    font-size: 12px;
    cursor: pointer;
  }

  .agent-detail-card {
    padding: 12px;
    border-top: 3px solid #3b82f6;
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .detail-top-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .detail-avatar-box {
    width: 32px;
    height: 32px;
    background: #1a2233;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .detail-sprite-img {
    width: 26px;
    height: 34px;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .detail-name {
    margin: 0;
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    color: #f8fafc;
  }

  .detail-role {
    font-size: 9px;
    color: #94a3b8;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .detail-tile {
    background: #141924;
    border: 1px solid #232a3d;
    padding: 6px;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
  }

  .tile-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    color: #64748b;
  }

  .tile-value {
    font-size: 10px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .tile-value.mono { font-family: 'JetBrains Mono', monospace; font-size: 8px; }
  .tile-value.green { color: #10b981; }

  .quick-dispatch-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .dispatch-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #94a3b8;
  }

  .dispatch-row {
    display: flex;
    gap: 4px;
  }

  .dispatch-btn {
    flex: 1;
    background: #1a2233;
    border: 1px solid #2d3b55;
    color: #cbd5e1;
    padding: 4px 6px;
    font-size: 9px;
    border-radius: 3px;
    cursor: pointer;
  }

  .dispatch-btn:hover {
    background: #283550;
    color: #fff;
  }

  .thought-history-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 auto;
    min-height: 0;
  }

  .history-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #94a3b8;
    flex-shrink: 0;
  }

  .history-head-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    flex-shrink: 0;
    margin-bottom: 4px;
  }

  .scope-toggle {
    display: flex;
    gap: 3px;
  }

  .scope-btn {
    background: #1a202c;
    border: 1px solid #2d3748;
    color: #94a3b8;
    padding: 2px 6px;
    font-size: 8px;
    font-family: 'JetBrains Mono', monospace;
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;
  }

  .scope-btn.active {
    background: #3b82f6;
    border-color: #60a5fa;
    color: #fff;
    font-weight: 700;
  }

  .stream-hint {
    font-size: 9px;
    color: #64748b;
  }

  .history-action-tag {
    display: inline-block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.06);
    padding: 1px 4px;
    border-radius: 2px;
    margin-top: 2px;
  }

  .global-stream-panel {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    padding: 12px;
    gap: 4px;
  }

  .history-list.global {
    max-height: none;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1 1 auto;
    min-height: 90px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .history-empty {
    font-size: 10px;
    color: #64748b;
    background: #12161f;
    border: 1px dashed #242b3d;
    border-radius: 4px;
    padding: 10px 8px;
    text-align: center;
    line-height: 1.4;
  }

  .history-item {
    background: #141924;
    border-left: 2px solid #38bdf8;
    padding: 4px 6px;
    border-radius: 0 3px 3px 0;
    flex-shrink: 0;
  }

  .history-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    font-size: 7px;
  }

  .history-act {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 62%;
  }

  .history-txt {
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .history-act { font-family: 'Press Start 2P', monospace; color: #38bdf8; }
  .history-ts { color: #64748b; font-family: 'JetBrains Mono', monospace; }
  .history-txt { margin: 2px 0; font-size: 9px; color: #e2e8f0; }
  .history-tok { font-size: 7px; color: #94a3b8; font-family: 'JetBrains Mono', monospace; }

  .tool-trace {
    margin: 4px 0 3px;
    padding: 5px 6px;
    border-radius: 4px;
    background: rgba(15, 23, 42, 0.55);
    border: 1px solid rgba(56, 189, 248, 0.25);
  }
  .tool-trace.tool-write { border-color: rgba(251, 191, 36, 0.45); background: rgba(69, 45, 6, 0.35); }
  .tool-trace.tool-failed { border-color: rgba(248, 113, 113, 0.55); background: rgba(69, 10, 10, 0.35); }
  .tool-trace-head { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  .tool-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 6px;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 2px 4px;
    border-radius: 3px;
    background: rgba(56, 189, 248, 0.18);
    color: #7dd3fc;
  }
  .tool-badge.write { background: rgba(251, 191, 36, 0.2); color: #fcd34d; }
  .tool-name { font-family: 'JetBrains Mono', monospace; font-size: 8px; color: #e2e8f0; font-weight: 700; }
  .tool-dur { font-family: 'JetBrains Mono', monospace; font-size: 6.5px; color: #64748b; }
  .tool-status { margin-left: auto; font-size: 8px; color: #4ade80; }
  .tool-failed .tool-status { color: #f87171; }
  .tool-row { display: flex; gap: 4px; margin-top: 3px; align-items: flex-start; }
  .tool-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 6px;
    color: #64748b;
    text-transform: uppercase;
    flex-shrink: 0;
    padding-top: 1px;
  }
  .tool-row code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 6.5px;
    color: #cbd5f5;
    word-break: break-all;
    line-height: 1.4;
  }
  .run-summary { display: flex; flex-wrap: wrap; gap: 3px; margin: 4px 0 3px; }
  .run-chip {
    font-family: 'JetBrains Mono', monospace;
    font-size: 6px;
    padding: 2px 4px;
    border-radius: 3px;
    background: rgba(148, 163, 184, 0.15);
    color: #cbd5f5;
  }
  .run-chip.write { background: rgba(74, 222, 128, 0.18); color: #86efac; font-weight: 700; }
  .tool-chain { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; margin-bottom: 3px; }
  .chain-node {
    font-family: 'JetBrains Mono', monospace;
    font-size: 6px;
    color: #7dd3fc;
    background: rgba(56, 189, 248, 0.12);
    padding: 1px 3px;
    border-radius: 2px;
  }
  .chain-arrow { font-size: 6px; color: #475569; }

  .drawer-event-ticker {
    height: 150px;
    min-height: 150px;
    background: #080a0f;
    border-top: 1px solid #242b3d;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow: hidden;
    transition: height 0.2s ease;
  }

  .side-inspector-drawer.expanded .drawer-event-ticker {
    height: 45%;
    min-height: 260px;
  }

  .side-inspector-drawer.expanded .ticker-feed {
    font-size: 11px;
    line-height: 1.5;
    gap: 5px;
  }

  .side-inspector-drawer.expanded .history-list {
    min-height: 200px;
  }

  .side-inspector-drawer.expanded .history-txt {
    font-size: 11px;
    line-height: 1.45;
  }

  .side-inspector-drawer.expanded .detail-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .ticker-top {
    height: 20px;
    flex-shrink: 0;
    background: #10141d;
    border-bottom: 1px solid #242b3d;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
  }

  .ticker-title { font-family: 'Press Start 2P', monospace; font-size: 6px; color: #10b981; }

  .ticker-feed {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
  }

  .feed-entry {
    color: #94a3b8;
    line-height: 1.35;
    word-break: break-word;
    overflow-wrap: anywhere;
    flex-shrink: 0;
  }

  .feed-entry.warn { color: #f87171; }
  .feed-ts { color: #475569; margin-right: 3px; }
  .feed-actor { color: #cbd5e1; font-weight: 600; margin-right: 3px; }
  .feed-msg { color: #e2e8f0; }
</style>
