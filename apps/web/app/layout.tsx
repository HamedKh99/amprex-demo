import type { Metadata } from 'next';
import { Vazirmatn } from 'next/font/google';
import './globals.css';

const vazirmatn = Vazirmatn({ subsets: ['arabic', 'latin'], variable: '--font-vazirmatn' });

export const metadata: Metadata = {
  title: 'آمپرکس — فروش و نصب باتری در محل',
  description: 'سفارش باتری خودرو با نصب در محل در تهران',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="min-h-dvh bg-white font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
