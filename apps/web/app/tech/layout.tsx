import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'آمپرکس · تکنسین' };

/** Phone-sized column; on wider screens it stays centred. */
export default function TechLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-background sm:border-x sm:border-border">{children}</div>;
}
