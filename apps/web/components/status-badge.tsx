import { ORDER_STATUS_LABELS, TECH_STATUS_LABELS, type OrderStatus } from '@amprex/shared';
import { Badge } from '@/components/ui/badge';

type Variant = 'outline' | 'neutral' | 'dark' | 'success' | 'destructive';

/** Design: waiting = outline, assigned = neutral (slate), in progress = dark, done = green, cancelled = red. */
export const STATUS_VARIANT: Record<OrderStatus, Variant> = {
  CREATED: 'outline',
  ASSIGNED: 'neutral',
  ACCEPTED: 'neutral',
  EN_ROUTE: 'dark',
  ON_SITE: 'dark',
  INSTALLING: 'dark',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
};

/** Technician app: an assignment waiting for acceptance is the outline state. */
const TECH_VARIANT: Record<OrderStatus, Variant> = { ...STATUS_VARIANT, ASSIGNED: 'outline' };

export function StatusBadge({
  status,
  audience = 'office',
  className,
}: {
  status: OrderStatus;
  audience?: 'office' | 'tech';
  className?: string;
}) {
  const tech = audience === 'tech';
  return (
    <Badge dot variant={(tech ? TECH_VARIANT : STATUS_VARIANT)[status]} className={className}>
      {(tech ? TECH_STATUS_LABELS : ORDER_STATUS_LABELS)[status]}
    </Badge>
  );
}
