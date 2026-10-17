'use client';

import { FlowHeader } from '@/components/site/site-chrome';
import { Stepper } from '@/components/stepper';
import { faDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

export const STEP_LABELS = ['وسیله', 'باتری', 'آدرس', 'زمان', 'ثبت'] as const;

/** Header, stepper, content and a bottom action bar fixed to the viewport. */
export function StepShell({
  step,
  onBack,
  bottom,
  children,
}: {
  step: number;
  onBack: () => void;
  bottom: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-background sm:border-x sm:border-border">
      <FlowHeader title="ثبت سفارش" aside={`مرحله ${faDigits(step)} از ${faDigits(5)}`} onBack={onBack} />
      <nav aria-label="مراحل سفارش" className="border-b border-border bg-card px-4 pt-3.5 pb-4">
        <Stepper labels={STEP_LABELS} current={step - 1} label="مراحل سفارش" />
      </nav>
      <main className="flex flex-col gap-4 px-4 pt-4 pb-36">{children}</main>
      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-[560px] flex-col gap-2.5 border-t border-border bg-card px-4 pt-3 pb-5">
        {bottom}
      </div>
    </div>
  );
}

/** Design «opt»: large tappable option; selected = 2px dark border. */
export function Opt({ on, className, children, ...props }: React.ComponentProps<'button'> & { on: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'flex min-h-[52px] w-full cursor-pointer items-center justify-between rounded-touch border bg-card px-3.5 text-start text-sm text-foreground',
        on ? 'border-2 border-foreground px-[13px] font-bold' : 'border-border font-medium',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function RadioDot({ on }: { on: boolean }) {
  return <span aria-hidden className={cn('size-[18px] shrink-0 rounded-full', on ? 'border-[5px] border-foreground' : 'border-[1.5px] border-strong-border')} />;
}

export function FieldError({ children }: { children?: string }) {
  return children ? <p className="mt-1.5 mb-0 text-xs text-destructive">{children}</p> : null;
}
