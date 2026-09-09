<script lang="ts">
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import type { Snippet } from 'svelte';
  import '../lib/styles.css';

  let { children }: { children?: Snippet } = $props();

  let actorRole = $state('ADMIN');
  let actorId = $state('usr-admin-01');

  const navItems = [
    { href: '/', label: 'Observability', icon: 'dashboard', badge: '3-Layer' },
    { href: '/office', label: 'Virtual Office', icon: 'office', badge: '2D Sim' },
    { href: '/console', label: 'Operator Console', icon: 'workflow', badge: 'Input' },
    { href: '/modules', label: 'Business Modules', icon: 'dashboard', badge: 'Live Data' },
    { href: '/sales', label: 'Sales Performance', icon: 'dashboard', badge: 'KPI' },
    { href: '/operations', label: 'Operations', icon: 'workflow', badge: 'Workforce' },
    { href: '/agents', label: 'AI Agents', icon: 'agent', badge: 'Registry' },
    { href: '/finops', label: 'AI FinOps', icon: 'finops', badge: 'Budget' },
    { href: '/tickets', label: 'Ticketing', icon: 'tickets', badge: 'HITL' },
    { href: '/experiments', label: 'Experiments', icon: 'experiment', badge: 'Testbed' },
    { href: '/workflows', label: 'Workflows', icon: 'workflow', badge: 'Triggers' },
    { href: '/events', label: 'Live Events', icon: 'events', badge: 'SSE' }
  ];
</script>

<div class="app-container">
  <!-- Left Navigation Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <div class="logo-text">
        <h2>AutoEnterprise</h2>
        <span>Autonomous OS</span>
      </div>
    </div>

    <div class="nav-section">
      <span class="section-label">Core Operations</span>
      <nav class="nav-links">
        {#each navItems as item}
          <a
            href={item.href}
            class="nav-item"
            class:active={page.url.pathname === item.href || (item.href !== '/' && page.url.pathname.startsWith(item.href))}
          >
            <div class="icon-wrap">
              {#if item.icon === 'dashboard'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              {:else if item.icon === 'office'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 21h18M3 7v14M21 7v14M6 3h12v4H6zM9 11v2M9 17v2M15 11v2M15 17v2"></path>
                </svg>
              {:else if item.icon === 'agent'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 8V4m0 0a3 3 0 10-6 0 3 3 0 006 0zm0 0a3 3 0 106 0 3 3 0 00-6 0zM4 20h16a2 2 0 002-2V8a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
              {:else if item.icon === 'finops'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"></path>
                </svg>
              {:else if item.icon === 'tickets'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              {:else if item.icon === 'events'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1m0-14.2-2.1 2.1m-10 10-2.1 2.1"></path>
                </svg>
              {:else if item.icon === 'experiment'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 2v7.31M14 2v7.31M8.5 2h7M14 9.3a6.5 6.5 0 11-4 0"></path>
                </svg>
              {:else}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              {/if}
            </div>
            <span class="nav-label">{item.label}</span>
            <span class="nav-badge">{item.badge}</span>
          </a>
        {/each}
      </nav>
    </div>

    <div class="sidebar-footer">
      <div class="system-status">
        <span class="status-dot"></span>
        <div class="status-info">
          <span class="status-title">System Mesh Online</span>
          <span class="status-sub">Phase 9A Admin UI</span>
        </div>
      </div>
    </div>
  </aside>

  <!-- Main Content Shell -->
  <div class="main-shell">
    <!-- Top Global Header -->
    <header class="top-header">
      <div class="header-left">
        <h1 class="page-title">
          {#if page.url.pathname === '/'}
            Executive Observability
          {:else if page.url.pathname.startsWith('/agents')}
            AI Agent Governance & Trust Registry
          {:else if page.url.pathname.startsWith('/finops')}
            AI FinOps & Cognitive Budget Meter
          {:else if page.url.pathname.startsWith('/tickets')}
            Human-in-the-Loop Ticketing Center
          {:else if page.url.pathname.startsWith('/experiments')}
            Research Experiment Testbed
           {:else if page.url.pathname.startsWith('/workflows')}
             Autonomous Workflow Execution Hub
           {:else if page.url.pathname.startsWith('/events')}
             Live Event Stream

          {:else}
            Autonomous Enterprise Admin
          {/if}
        </h1>
      </div>

      <div class="header-right">
        <!-- Enterprise Organization Badge -->
        <div class="identity-badge org-badge">
          <span class="role-tag live">PROD</span>
          <span class="user-id">AUTONOMOUS ENTERPRISE</span>
        </div>

        <!-- Role Badge -->
        <div class="identity-badge">
          <span class="role-tag">{actorRole}</span>
          <span class="user-id">{actorId}</span>
        </div>
      </div>
    </header>

    <!-- Page Body Outlet -->
    <main class="content-area" class:office-no-padding={page.url.pathname === '/office'}>
      {#if children}
        {@render children()}
      {/if}
    </main>
  </div>
</div>

<style>
  .app-container {
    display: flex;
    min-height: 100vh;
    height: 100vh;
    background-color: var(--bg-primary);
    overflow: hidden;
  }

  .sidebar {
    width: 260px;
    background-color: var(--bg-card);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .sidebar-header {
    padding: 1.25rem 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .logo-icon {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, #2563eb, #0284c7);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
  }
  .logo-icon svg {
    width: 20px;
    height: 20px;
  }

  .logo-text h2 {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
    letter-spacing: -0.01em;
  }
  .logo-text span {
    font-size: 0.7rem;
    color: var(--accent-blue);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
  }

  .nav-section {
    padding: 1.25rem 0.75rem;
    flex: 1;
    overflow-y: auto;
  }

  .section-label {
    font-size: 0.68rem;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 700;
    letter-spacing: 0.08em;
    padding-left: 0.75rem;
    margin-bottom: 0.5rem;
    display: block;
  }

  .nav-links {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.75rem;
    border-radius: 7px;
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.15s ease;
    border: 1px solid transparent;
  }

  .nav-item:hover {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--accent-blue-subtle);
    color: var(--accent-blue);
    border: 1px solid var(--accent-blue-border);
    font-weight: 600;
  }

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon-wrap svg {
    width: 18px;
    height: 18px;
  }

  .nav-label {
    flex: 1;
  }

  .nav-badge {
    font-size: 0.65rem;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    font-weight: 600;
  }

  .nav-item.active .nav-badge {
    background: #dbeafe;
    border-color: #bfdbfe;
    color: #1e40af;
  }

  .sidebar-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-card);
  }

  .system-status {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--accent-emerald);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-emerald) 25%, transparent);
  }

  .status-info {
    display: flex;
    flex-direction: column;
  }

  .status-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  .status-sub {
    font-size: 0.65rem;
    color: var(--text-muted);
  }

  .main-shell {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
  }

  .top-header {
    height: 60px;
    border-bottom: 1px solid var(--border-color);
    background-color: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 2rem;
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .page-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .identity-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.35rem 0.65rem;
    box-shadow: var(--shadow-xs);
  }

  .role-tag {
    font-size: 0.65rem;
    font-weight: 700;
    background: var(--accent-blue-subtle);
    color: var(--accent-blue);
    border: 1px solid var(--accent-blue-border);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }

  .user-id {
    font-size: 0.78rem;
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }

  .content-area {
    flex: 1;
    padding: 2rem;
    background: var(--bg-primary);
    overflow-y: auto;
    min-height: 0;
  }

  .content-area.office-no-padding {
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
