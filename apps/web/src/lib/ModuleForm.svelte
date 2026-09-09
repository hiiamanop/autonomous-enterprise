<script lang="ts">
  /**
   * Declarative form for a single write endpoint.
   *
   * Every dashboard submits through this component so that request shaping,
   * validation, and result rendering behave identically everywhere. Fields are
   * described as data rather than markup, which keeps each module page focused
   * on *which* endpoint it calls instead of how to draw an input.
   */

  export type FieldType = 'text' | 'number' | 'select' | 'textarea' | 'date';

  export interface FormField {
    name: string;
    label: string;
    type?: FieldType;
    /** Options for a select. `value` is what gets submitted. */
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    required?: boolean;
    /** Prefilled value shown when the form resets. */
    initial?: string | number;
    help?: string;
    step?: string;
  }

  interface Props {
    title: string;
    description?: string;
    /** Endpoint shown to the operator so the form is traceable to the API. */
    endpoint?: string;
    fields: FormField[];
    submitLabel?: string;
    /** Receives the collected values; returns the raw ApiResponse. */
    onSubmit: (values: Record<string, any>) => Promise<any>;
    /** Called after a successful submit, e.g. to refresh a table. */
    onSuccess?: (data: any) => void;
    disabled?: boolean;
    disabledReason?: string;
  }

  let {
    title,
    description,
    endpoint,
    fields,
    submitLabel = 'Submit',
    onSubmit,
    onSuccess,
    disabled = false,
    disabledReason
  }: Props = $props();

  const buildInitialValues = () => {
    const seed: Record<string, any> = {};
    for (const field of fields) {
      seed[field.name] =
        field.initial !== undefined
          ? field.initial
          : field.type === 'select'
            ? (field.options?.[0]?.value ?? '')
            : '';
    }
    return seed;
  };

  let values = $state<Record<string, any>>(buildInitialValues());
  let submitting = $state(false);
  let result = $state<{ ok: boolean; message: string; payload?: any } | null>(null);

  // Select options are often loaded asynchronously (customers, products...).
  // When they arrive, fill in any select that the operator has not touched yet,
  // so the form is submittable without first opening every dropdown.
  let touched = $state<Record<string, boolean>>({});
  $effect(() => {
    for (const field of fields) {
      if (field.type !== 'select' || touched[field.name]) continue;
      const first = field.options?.[0]?.value;
      if (first && !values[field.name]) {
        values[field.name] = first;
      }
    }
  });

  function reset() {
    values = buildInitialValues();
    touched = {};
    result = null;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (submitting || disabled) return;

    const missing = fields
      .filter((f) => f.required && (values[f.name] === '' || values[f.name] === undefined || values[f.name] === null))
      .map((f) => f.label);

    if (missing.length > 0) {
      result = { ok: false, message: `Missing required field(s): ${missing.join(', ')}` };
      return;
    }

    submitting = true;
    result = null;

    try {
      // Numeric inputs arrive as strings from the DOM; the API validates types
      // strictly, so they are coerced before the request is built.
      const payload: Record<string, any> = {};
      for (const field of fields) {
        const raw = values[field.name];
        if (raw === '' || raw === undefined || raw === null) continue;
        payload[field.name] = field.type === 'number' ? Number(raw) : raw;
      }

      const response = await onSubmit(payload);

      if (response?.success) {
        result = {
          ok: true,
          message: 'Accepted by the API and persisted.',
          payload: response.data
        };
        onSuccess?.(response.data);
      } else {
        result = {
          ok: false,
          message: response?.error?.message || 'Request rejected by the API.',
          payload: response?.error
        };
      }
    } catch (err: any) {
      result = { ok: false, message: err?.message || 'Request failed before reaching the API.' };
    } finally {
      submitting = false;
    }
  }
</script>

<form class="module-form" onsubmit={handleSubmit}>
  <header class="form-head">
    <div>
      <h3 class="form-title">{title}</h3>
      {#if description}<p class="form-desc">{description}</p>{/if}
    </div>
    {#if endpoint}<code class="endpoint">{endpoint}</code>{/if}
  </header>

  {#if disabled && disabledReason}
    <p class="blocked">{disabledReason}</p>
  {/if}

  <div class="grid">
    {#each fields as field (field.name)}
      <label class="field" class:wide={field.type === 'textarea'}>
        <span class="label">
          {field.label}
          {#if field.required}<span class="req">*</span>{/if}
        </span>

        {#if field.type === 'select'}
          <select
            bind:value={values[field.name]}
            onchange={() => (touched[field.name] = true)}
            disabled={disabled || submitting}
          >
            {#if !field.options || field.options.length === 0}
              <option value="">— no options loaded —</option>
            {/if}
            {#each field.options ?? [] as opt (opt.value)}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        {:else if field.type === 'textarea'}
          <textarea
            bind:value={values[field.name]}
            placeholder={field.placeholder ?? ''}
            rows="3"
            disabled={disabled || submitting}
          ></textarea>
        {:else}
          <input
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            step={field.step ?? (field.type === 'number' ? 'any' : undefined)}
            bind:value={values[field.name]}
            placeholder={field.placeholder ?? ''}
            disabled={disabled || submitting}
          />
        {/if}

        {#if field.help}<span class="help">{field.help}</span>{/if}
      </label>
    {/each}
  </div>

  <div class="actions">
    <button type="submit" class="submit" disabled={disabled || submitting}>
      {submitting ? 'Submitting…' : submitLabel}
    </button>
    <button type="button" class="reset" onclick={reset} disabled={submitting}>Reset</button>
  </div>

  {#if result}
    <div class="result" class:ok={result.ok} class:err={!result.ok}>
      <strong>{result.ok ? 'Success' : 'Rejected'}</strong>
      <span>{result.message}</span>
      {#if result.payload}
        <pre>{JSON.stringify(result.payload, null, 2)}</pre>
      {/if}
    </div>
  {/if}
</form>

<style>
  .module-form {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.25rem 1.35rem 1.35rem;
    box-shadow: var(--shadow-sm);
  }

  .form-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .form-title {
    font-size: 0.98rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .form-desc {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-top: 0.2rem;
    line-height: 1.5;
    max-width: 54ch;
  }

  .endpoint {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--text-muted);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 5px;
    padding: 0.2rem 0.45rem;
    white-space: nowrap;
    font-weight: 500;
  }

  .blocked {
    font-size: 0.78rem;
    color: var(--accent-amber);
    background: var(--accent-amber-subtle);
    border: 1px solid var(--accent-amber-border);
    border-radius: 6px;
    padding: 0.5rem 0.65rem;
    margin-bottom: 0.85rem;
    font-weight: 500;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 0.85rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .field.wide {
    grid-column: 1 / -1;
  }

  .label {
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: 0.02em;
  }

  .req {
    color: var(--accent-rose);
    margin-left: 0.15rem;
  }

  input,
  select,
  textarea {
    background: #ffffff;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.5rem 0.65rem;
    color: var(--text-primary);
    font-size: 0.82rem;
    font-family: inherit;
    outline: none;
    width: 100%;
    transition: all 0.15s ease;
  }

  textarea {
    resize: vertical;
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  input:disabled,
  select:disabled,
  textarea:disabled {
    background: var(--bg-secondary);
    opacity: 0.7;
    cursor: not-allowed;
  }

  .help {
    font-size: 0.68rem;
    color: var(--text-muted);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.1rem;
  }

  .submit,
  .reset {
    border-radius: 6px;
    padding: 0.5rem 1.1rem;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--border-color);
    font-family: inherit;
    transition: all 0.15s ease;
  }

  .submit {
    background: var(--accent-blue);
    border-color: var(--accent-blue);
    color: #fff;
    box-shadow: 0 1px 2px rgba(37, 99, 235, 0.2);
  }

  .submit:hover:not(:disabled) {
    background: #1d4ed8;
    border-color: #1d4ed8;
  }

  .submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .reset {
    background: #ffffff;
    color: var(--text-secondary);
  }

  .reset:hover:not(:disabled) {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .result {
    margin-top: 1rem;
    border-radius: 7px;
    padding: 0.65rem 0.85rem;
    font-size: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    border: 1px solid;
  }

  .result.ok {
    background: var(--accent-emerald-subtle);
    border-color: var(--accent-emerald-border);
    color: #065f46;
  }

  .result.err {
    background: var(--accent-rose-subtle);
    border-color: var(--accent-rose-border);
    color: #9f1239;
  }

  .result pre {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-primary);
    background: #ffffff;
    border: 1px solid var(--border-color);
    border-radius: 5px;
    padding: 0.55rem;
    max-height: 220px;
    overflow: auto;
    margin-top: 0.25rem;
  }
</style>
