import { cn } from '@/lib/utils';

/** Design admin card: header row (title + aside) over a padded body. */
export function Panel({
  title,
  aside,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Body without padding (tables, timelines). */
  flush?: boolean;
}) {
  return (
    <section className={cn('min-w-0 rounded-card border border-border bg-card', className)}>
      <div className="flex items-center justify-between border-b border-muted px-[18px] py-3.5">
        <h2 className="m-0 text-[15px] font-bold">{title}</h2>
        {aside}
      </div>
      <div className={cn(!flush && 'flex flex-col gap-2.5 px-[18px] py-3.5', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Label / value row (value aligned to the end, bold). */
export function KV({ label, children, className, muted }: { label: React.ReactNode; children: React.ReactNode; className?: string; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3 text-[13px]', className)}>
      <span className="text-subtle-foreground">{label}</span>
      <span className={cn('text-left', muted ? 'font-medium text-subtle-foreground' : 'font-semibold')}>{children}</span>
    </div>
  );
}

/** Small caption / value block used in grids. */
export function Fact({ label, children, muted }: { label: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <div>
      <div className="text-xs text-subtle-foreground">{label}</div>
      <div className={cn('text-sm', muted ? 'text-subtle-foreground' : 'font-bold')}>{children}</div>
    </div>
  );
}
