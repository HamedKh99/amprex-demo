import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Dark square with the bolt (design: brand mark). */
export function LogoMark({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-touch bg-foreground text-white', className)}>
      <Zap className={cn('size-5', iconClassName)} strokeWidth={2} />
    </span>
  );
}
