import { Check } from 'lucide-react';
import { faDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Design «استپر»: done = dark filled with ✓, current = white with dark ring, next = muted.
 * Used by the customer order flow and the technician mission.
 */
export function Stepper({ labels, current, label }: { labels: readonly string[]; current: number; label: string }) {
  return (
    <ol aria-label={label} className="m-0 grid list-none p-0" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
      {labels.map((text, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={text} className="relative flex flex-col items-center gap-1.5" aria-current={on ? 'step' : undefined}>
            {i > 0 && (
              <span
                aria-hidden
                className={cn('absolute top-[13px] h-0.5 w-full', i <= current ? 'bg-foreground' : 'bg-border')}
                style={{ insetInlineEnd: '50%' }}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex size-7 items-center justify-center rounded-full text-[13px] font-bold',
                done && 'bg-foreground text-white',
                on && 'border-2 border-foreground bg-card text-foreground',
                !done && !on && 'border border-border bg-muted text-subtle-foreground',
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} aria-label="انجام‌شده" /> : faDigits(i + 1)}
            </span>
            <span className={cn('text-xs', on ? 'font-bold text-foreground' : done ? 'text-slate-700' : 'text-subtle-foreground')}>
              {text}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
