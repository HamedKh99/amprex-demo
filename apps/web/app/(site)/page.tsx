import { BatteryCharging, Check, CreditCard, Recycle, ShieldCheck, Wrench } from 'lucide-react';
import Link from 'next/link';
import { QuickVehiclePicker } from '@/components/site/quick-vehicle-picker';
import { SiteFooter, SiteHeader } from '@/components/site/site-chrome';
import { Button } from '@/components/ui/button';

const FEATURES = [
  { icon: Wrench, title: 'نصب رایگان در محل', text: 'در خانه، محل کار یا پارکینگ؛ نصب، تست شارژ دینام و تحویل.' },
  { icon: ShieldCheck, title: 'گارانتی رسمی', text: 'کارت گارانتی شرکت سازنده با شماره سریال ثبت‌شده در سفارش.' },
  { icon: Recycle, title: 'تحویل باتری داغی', text: 'باتری کهنه را تحویل بدهید؛ متناسب با آمپر آن از مبلغ کم می‌شود.' },
];

const STEPS = [
  { title: 'وسیله و باتری را انتخاب کنید', text: 'فقط باتری‌های سازگار با قیمت نهایی نمایش داده می‌شوند.' },
  { title: 'آدرس و زمان را ثبت کنید', text: 'بازه‌های سه‌ساعته هفت روز آینده، با ظرفیت واقعی.' },
  { title: 'نصب و تست در محل', text: 'تکنسین باتری کهنه را تحویل می‌گیرد و مبلغ را نهایی می‌کند.' },
  { title: 'بعد از نصب پرداخت کنید', text: 'نقدی، کارت‌خوان یا کارت‌به‌کارت.' },
];

const POINTS = [
  { icon: BatteryCharging, text: 'تکنسین با ابزار تست باتری و دینام' },
  { icon: Check, text: 'هفت روز هفته، بازه‌های سه‌ساعته از ۸ تا ۲۰' },
  { icon: CreditCard, text: 'نقدی، کارت‌خوان یا کارت‌به‌کارت' },
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <section className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-8 px-4 pt-8 pb-10 md:gap-14 md:px-6 md:pt-[72px] md:pb-14">
        <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-4 md:gap-5">
          <span className="text-[13px] font-semibold text-muted-foreground md:text-sm">باتری خودرو و موتورسیکلت — تهران</span>
          <h1 className="m-0 text-[30px] leading-[1.4] font-extrabold md:text-[46px] md:leading-[1.35] md:tracking-[-0.5px]">
            باتری مناسب، نصب رایگان در محل شما.
          </h1>
          <p className="m-0 max-w-[520px] text-[15px] leading-8 text-muted-foreground md:text-lg md:leading-[1.9]">
            وسیله نقلیه را انتخاب کنید؛ باتری‌های سازگار، قیمت نهایی و نزدیک‌ترین زمان نصب را همین‌جا می‌بینید. پرداخت بعد از نصب.
          </p>
          <ul className="m-0 mt-2 hidden list-none flex-col gap-3 p-0 text-[15px] md:flex">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-2.5">
                <p.icon className="size-5 text-slate-700" aria-hidden />
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <QuickVehiclePicker />
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-8 md:gap-8 md:px-6 md:py-10" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-card bg-muted">
                <f.icon className="size-[22px]" aria-hidden />
              </span>
              <div>
                <h3 className="mt-0 mb-1 text-[17px] font-bold">{f.title}</h3>
                <p className="m-0 text-sm leading-[1.9] text-muted-foreground">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-4 py-12 md:px-6 md:py-16">
        <h2 className="m-0 text-2xl font-extrabold md:text-[28px]">چطور کار می‌کند</h2>
        <ol className="m-0 grid list-none gap-4 p-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-[22px]">
              <span className="flex size-9 items-center justify-center rounded-full bg-foreground font-bold text-white">
                {['۱', '۲', '۳', '۴'][i]}
              </span>
              <div className="text-base font-bold">{s.title}</div>
              <p className="m-0 text-sm leading-[1.9] text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-card p-5">
          <div>
            <div className="text-base font-bold">سفارش قبلی دارید؟</div>
            <p className="mt-1 mb-0 text-sm text-muted-foreground">با کد پیگیری و شماره موبایل، وضعیت سفارش و تکنسین را ببینید.</p>
          </div>
          <Button asChild>
            <Link href="/track">پیگیری سفارش</Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
