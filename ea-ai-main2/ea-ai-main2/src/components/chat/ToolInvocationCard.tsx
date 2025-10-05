"use client";

import React from 'react';
import type { ToolInvocationUIPart } from '@ai-sdk/ui-utils';
import { cn } from '@/lib/utils';

type Invocation = ToolInvocationUIPart['toolInvocation'];

interface ToolInvocationCardProps {
  invocation: Invocation;
}

const stateLabels: Record<Invocation['state'], string> = {
  call: 'Running',
  'partial-call': 'Queued',
  result: 'Completed',
};

const badgeClasses: Record<Invocation['state'], string> = {
  call: 'border-primary/50 bg-primary/10 text-primary',
  'partial-call': 'border-amber-400/50 bg-amber-400/10 text-amber-500',
  result: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500',
};

export function ToolInvocationCard({ invocation }: ToolInvocationCardProps) {
  const { toolName, state, args, result } = invocation;
  const titleText = typeof toolName === 'string' ? toolName : 'Tool';

  return (
    <section className="rounded-design-md border border-border/60 bg-muted/40 p-3 space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-medium text-primary">{titleText}</span>
          {renderSummary(result)}
        </div>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide',
            badgeClasses[state] ?? badgeClasses.call
          )}
        >
          {stateLabels[state] ?? state}
        </span>
      </header>

      {renderSection('Inputs', args)}
      {renderSection('Result', result)}
    </section>
  );
}

function renderSection(label: string, value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">{label}</p>
      <div className="rounded-md border border-border/40 bg-background/70 p-3 text-sm leading-relaxed text-primary">
        {renderValue(value)}
      </div>
    </div>
  );
}

function renderSummary(result: unknown) {
  if (result == null) return null;
  if (typeof result === 'string') {
    const trimmed = result.trim();
    if (!trimmed) return null;
    if (trimmed.length > 80) {
      return <span className="text-xs text-muted-foreground">{trimmed.slice(0, 80)}…</span>;
    }
    return <span className="text-xs text-muted-foreground">{trimmed}</span>;
  }

  if (Array.isArray(result)) {
    if (!result.length) return null;
    const preview = summarizeObject(result[0]);
    if (!preview) return null;
    return <span className="text-xs text-muted-foreground">{preview}</span>;
  }

  if (typeof result === 'object') {
    const preview = summarizeObject(result as Record<string, unknown>);
    if (!preview) return null;
    return <span className="text-xs text-muted-foreground">{preview}</span>;
  }

  return null;
}

function summarizeObject(value: Record<string, unknown> | unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return null;
  for (const [key, raw] of entries) {
    if (typeof raw === 'string' && raw.trim()) {
      return `${formatKey(key)}: ${raw.trim().slice(0, 60)}`;
    }
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      return `${formatKey(key)}: ${String(raw)}`;
    }
  }
  return null;
}

function renderValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null) return <span className="text-muted-foreground">None</span>;
  if (typeof value === 'string') {
    return <span className="whitespace-pre-wrap break-words">{value}</span>;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      return <span className="text-muted-foreground">Empty list</span>;
    }
    return (
      <ul className={cn('space-y-2', depth === 0 ? 'pl-1' : 'pl-3')}>
        {value.map((item, index) => (
          <li key={index} className="border-l border-border/40 pl-2">
            {renderValue(item, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object' && value) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) {
      return <span className="text-muted-foreground">Empty object</span>;
    }
    return (
      <dl className={cn('space-y-2', depth === 0 ? 'pl-1' : 'pl-3')}>
        {entries.map(([key, val]) => (
          <div key={key} className="flex flex-col gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {formatKey(key)}
            </dt>
            <dd>{renderValue(val, depth + 1)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  try {
    return <span>{JSON.stringify(value)}</span>;
  } catch {
    return <span>{String(value)}</span>;
  }
}

function formatKey(key: string): string {
  if (!key) return 'value';
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}
