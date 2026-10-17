import type { Metadata, Viewport } from 'next';
import { Vazirmatn } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-vazirmatn',
});

export const metadata: Metadata = {
  title: 'آمپرکس — فروش و نصب باتری در محل',
  description: 'باتری مناسب، نصب رایگان در محل شما.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0F172A' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
