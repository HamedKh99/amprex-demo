'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { addDaysIso, dayMonthYear, faNumber, tehranToday } from '@/lib/format';
import { cn } from '@/lib/utils';

/*
 * Jalali month view built on Intl (no calendar library). Days are Gregorian "YYYY-MM-DD"
 * strings, formatted in UTC so the calendar date never shifts with the time zone.
 */
const jParts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
const jTitle = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'UTC', year: 'numeric', month: 'long' });
const asDate = (iso: string) => new Date(`${iso}T12:00:00Z`);

function jalali(iso: string) {
  const p = Object.fromEntries(jParts.formatToParts(asDate(iso)).map((x) => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) };
}

/** First day of the Jalali month containing `iso`. */
export function jalaliMonthStart(iso: string) {
  return addDaysIso(iso, 1 - jalali(iso).day);
}

function monthDays(anyIso: string) {
  const first = jalaliMonthStart(anyIso);
  const { month } = jalali(first);
  const days: string[] = [];
  for (let d = first; jalali(d).month === month; d = addDaysIso(d, 1)) days.push(d);
  return days;
}

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export function JalaliDatePicker({
  value,
  onChange,
  prefix,
  min,
  max,
  label,
}: {
  value: string;
  onChange: (iso: string) => void;
  /** Shown before the date, e.g. «از» / «تا». */
  prefix?: string;
  min?: string;
  max?: string;
  /** Accessible name of the trigger. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(value);
  const days = useMemo(() => monthDays(view), [view]);
  // Saturday-first grid: JS getUTCDay() is 0 = Sunday … 6 = Saturday.
  const lead = (asDate(days[0]!).getUTCDay() + 1) % 7;
  const today = tehranToday();
  const text = value === today && !prefix ? 'امروز' : dayMonthYear(value);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setView(value);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-[38px] items-center gap-2 rounded-control border border-input bg-card px-3 text-[13px] whitespace-nowrap text-foreground"
        >
          <CalendarDays className="size-4 text-subtle-foreground" aria-hidden />
          {prefix && `${prefix} `}
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3" dir="rtl">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="ماه قبل" className="flex size-8 items-center justify-center rounded-control hover:bg-muted" onClick={() => setView(addDaysIso(days[0]!, -1))}>
            <ChevronRight className="size-4" />
          </button>
          <span className="text-sm font-bold">{jTitle.format(asDate(days[0]!))}</span>
          <button type="button" aria-label="ماه بعد" className="flex size-8 items-center justify-center rounded-control hover:bg-muted" onClick={() => setView(addDaysIso(days.at(-1)!, 1))}>
            <ChevronLeft className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1 text-subtle-foreground">
              {w}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {days.map((d) => {
            const disabled = (min && d < min) || (max && d > max);
            const on = d === value;
            return (
              <button
                key={d}
                type="button"
                disabled={!!disabled}
                aria-pressed={on}
                onClick={() => {
                  onChange(d);
                  setOpen(false);
                }}
                className={cn(
                  'h-8 rounded-control text-[13px]',
                  on ? 'bg-foreground font-bold text-white' : 'hover:bg-muted',
                  d === today && !on && 'border border-strong-border',
                  disabled && 'cursor-not-allowed opacity-30 hover:bg-transparent',
                )}
              >
                {faNumber(jalali(d).day)}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
