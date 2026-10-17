'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/lib/queries';
import { type LoginInput, type LoginValues, loginSchema } from '@/lib/schemas';

export default function AdminLoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [show, setShow] = useState(false);
  const form = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '', remember: false },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((v) =>
    login.mutate(v, { onSuccess: (user) => router.replace(user.role === 'TECHNICIAN' ? '/tech' : '/admin') }),
  );

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted px-4 py-12">
      <div className="flex items-center gap-2.5">
        <LogoMark />
        <span className="text-[22px] font-extrabold">آمپرکس</span>
        <span className="ms-0.5 border-s border-slate-300 ps-2.5 text-[13px] text-subtle-foreground">پنل مدیریت</span>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="flex w-full max-w-[400px] flex-col gap-[18px] rounded-sheet border border-border bg-card p-8 shadow-[0_1px_2px_rgba(15,23,42,.04),0_12px_32px_rgba(15,23,42,.06)]"
      >
        <div>
          <h1 className="m-0 text-[22px] font-extrabold">ورود</h1>
          <p className="mt-1 mb-0 text-[13px] text-subtle-foreground">برای مدیران، اپراتورها و انبارداران</p>
        </div>
        <div>
          <Label htmlFor="u" className="mb-1.5">
            نام کاربری یا شماره موبایل
          </Label>
          <Input id="u" dir="ltr" autoComplete="username" aria-invalid={!!errors.phone} className="text-right" {...form.register('phone')} />
          {errors.phone && <p className="mt-1.5 mb-0 text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        <div>
          <Label htmlFor="p" className="mb-1.5">
            رمز عبور
          </Label>
          <div className="relative">
            <Input
              id="p"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              className="ps-11"
              {...form.register('password')}
            />
            <button
              type="button"
              aria-label="نمایش رمز"
              aria-pressed={show}
              onClick={() => setShow((s) => !s)}
              className="absolute top-1 left-1 flex size-9 items-center justify-center rounded-control text-subtle-foreground"
            >
              {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 mb-0 text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-slate-700">
          <Checkbox checked={form.watch('remember')} onCheckedChange={(v) => form.setValue('remember', v === true)} />
          مرا در این دستگاه به خاطر بسپار
        </label>
        {login.error && (
          <p role="alert" className="m-0 rounded-control border border-destructive-border bg-destructive-muted p-3 text-[13px] text-destructive">
            {login.error.message}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={login.isPending} className="h-[46px] text-[15px]">
          ورود
        </Button>
        <p className="m-0 border-t border-muted pt-3.5 text-xs leading-7 text-subtle-foreground">
          دسترسی شما بر اساس نقش و شعبه، پس از ورود اعمال می‌شود. تکنسین‌ها از اپ تکنسین وارد شوند.
        </p>
      </form>
      <span className="text-xs text-subtle-foreground">
        نسخه <span dir="ltr">1.0.0</span>
      </span>
    </main>
  );
}
