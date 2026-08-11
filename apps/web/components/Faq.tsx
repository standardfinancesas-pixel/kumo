'use client';

import { useState } from 'react';
import type { Faq as FaqType } from '@kumo/shared';

export function Faq({ items }: { items: FaqType[] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  return (
    <div className="mx-auto max-w-3xl divide-y divide-violet-200 rounded-xl border border-violet-200 bg-surface">
      {items.map((f) => {
        const isOpen = open === f.id;
        return (
          <div key={f.id}>
            <button
              onClick={() => setOpen(isOpen ? null : f.id)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-heading font-semibold text-ink"
              aria-expanded={isOpen}
            >
              {f.question}
              <span className={`text-brand transition-transform ${isOpen ? 'rotate-45' : ''}`}>+</span>
            </button>
            {isOpen && <p className="px-6 pb-5 text-ink-muted">{f.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}
