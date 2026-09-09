<script lang="ts">
  /**
   * Read-back table shown next to each form, so a submitted record can be
   * confirmed as actually persisted rather than merely accepted.
   */

  export interface Column {
    key: string;
    label: string;
    /** Optional formatter; receives the whole row. */
    render?: (row: any) => string;
    mono?: boolean;
  }

  interface Props {
    title: string;
    columns: Column[];
    rows: any[];
    loading?: boolean;
    emptyText?: string;
    onRefresh?: () => void;
    limit?: number;
  }

  let {
    title,
    columns,
    rows,
    loading = false,
    emptyText = 'No records yet.',
    onRefresh,
    limit = 12
  }: Props = $props();

  // Newest first: these tables exist to confirm what was just written.
  const visible = $derived([...(rows ?? [])].reverse().slice(0, limit));

  function cell(row: any, col: Column): string {
    if (col.render) return col.render(row);
    const value = row?.[col.key];
    if (value === undefined || value === null) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
</script>

<section class="table-card">
  <header>
    <h3>{title}</h3>
    <div class="head-right">
      <span class="count">{rows?.length ?? 0}</span>
      {#if onRefresh}
        <button onclick={onRefresh} disabled={loading}>{loading ? '…' : 'Refresh'}</button>
      {/if}
    </div>
  </header>

  {#if visible.length === 0}
    <p class="empty">{loading ? 'Loading…' : emptyText}</p>
  {:else}
    <div class="scroll">
      <table>
        <thead>
          <tr>
            {#each columns as col (col.key)}<th>{col.label}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each visible as row, i (row?.id ?? i)}
            <tr>
              {#each columns as col (col.key)}
                <td class:mono={col.mono}>{cell(row, col)}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if (rows?.length ?? 0) > limit}
      <p class="more">Showing newest {limit} of {rows.length}.</p>
    {/if}
  {/if}
</section>

<style>
  .table-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.1rem 1.25rem 1.25rem;
    box-shadow: var(--shadow-sm);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    gap: 1rem;
  }

  h3 {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .head-right {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .count {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0.1rem 0.4rem;
    font-weight: 600;
  }

  button {
    background: #ffffff;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    border-radius: 5px;
    padding: 0.25rem 0.65rem;
    font-size: 0.74rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  button:hover:not(:disabled) {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .empty {
    font-size: 0.8rem;
    color: var(--text-muted);
    padding: 1.2rem 0.2rem;
    text-align: center;
  }

  .scroll {
    overflow-x: auto;
    max-height: 360px;
    overflow-y: auto;
    border: 1px solid var(--border-subtle);
    border-radius: 7px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
  }

  th {
    text-align: left;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.5rem 0.65rem;
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    background: var(--bg-secondary);
    z-index: 1;
  }

  td {
    padding: 0.5rem 0.65rem;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-subtle);
    white-space: nowrap;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  tr:hover td {
    background-color: var(--bg-secondary);
  }

  td.mono {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  .more {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-top: 0.6rem;
  }
</style>
