'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/lib/queries';
import { type LoginInput, type LoginValues, loginSchema } from '@/lib/schemas';

export default function TechLoginPage() {
  const router = useRouter();
  const login = useLogin();
  const form = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '', remember: true },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((v) =>
    login.mutate(v, { onSuccess: () => router.replace('/tech') }),
  );

  return (
    <main className="flex min-h-dvh flex-col bg-card px-5 pt-14 pb-8">
      <div className="mb-10 flex flex-col gap-3.5">
        <LogoMark className="size-[52px] rounded-sheet" iconClassName="size-7" />
        <div>
          <h1 className="m-0 text-[26px] font-extrabold">آمپرکس · تکنسین</h1>
          <p className="mt-1.5 mb-0 text-[15px] text-muted-foreground">برای دیدن مأموریت‌های امروز وارد شوید.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div>
          <Label htmlFor="m" className="mb-2 text-sm">شماره موبایل</Label>
          <Input
            id="m"
            dir="ltr"
            inputMode="numeric"
            autoComplete="username"
            aria-invalid={!!errors.phone}
            className="h-[52px] rounded-touch text-right text-[17px] tracking-wide"
            {...form.register('phone')}
          />
          {errors.phone && <p className="mt-1.5 mb-0 text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        <div>
          <Label htmlFor="pw" className="mb-2 text-sm">رمز عبور</Label>
          <Input
            id="pw"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            className="h-[52px] rounded-touch text-[17px]"
            {...form.register('password')}
          />
          {errors.password && <p className="mt-1.5 mb-0 text-xs text-destructive">{errors.password.message}</p>}
        </div>
        {login.error && (
          <p role="alert" className="m-0 rounded-touch border border-destructive-border bg-destructive-muted p-3 text-sm text-destructive">
            {login.error.message}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={login.isPending} className="mt-2 h-14 rounded-xl text-[17px] font-bold">
          ورود
        </Button>
      </form>

      <p className="mt-auto mb-0 pt-8 text-center text-[13px] leading-7 text-subtle-foreground">
        رمز را فراموش کرده‌اید؟ با مدیر شعبه تماس بگیرید.
      </p>
    </main>
  );
}
