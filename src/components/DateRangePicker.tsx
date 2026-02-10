'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek
} from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export type DateRangeValue = {
  start: Date | null;
  end: Date | null;
};

type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
};

const WEEK_START = 1;

const getDays = (month: Date) => {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_START });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: WEEK_START });
  return eachDayOfInterval({ start, end });
};

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [baseMonth, setBaseMonth] = useState<Date>(() => startOfMonth(value.start ?? new Date()));

  useEffect(() => {
    if (value.start) {
      setBaseMonth(startOfMonth(value.start));
    }
  }, [value.start]);

  const monthLeft = baseMonth;
  const monthRight = addMonths(baseMonth, 1);

  const weekdayLabels = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: WEEK_START });
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return format(date, 'EEEEE', { locale: pl });
    });
  }, []);

  const handleSelect = (day: Date) => {
    const { start, end } = value;
    if (!start || (start && end)) {
      onChange({ start: day, end: null });
      return;
    }

    if (isBefore(day, start)) {
      onChange({ start: day, end: null });
      return;
    }

    onChange({ start, end: day });
  };

  const renderMonth = (month: Date) => {
    const days = getDays(month);
    const { start, end } = value;

    return (
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-700">
            {format(month, 'LLLL yyyy', { locale: pl })}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs text-slate-400 mb-2">
          {weekdayLabels.map((label, idx) => (
            <div key={`${label}-${idx}`} className="text-center uppercase tracking-wide">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const isCurrentMonth = isSameMonth(day, month);
            const isStart = start ? isSameDay(day, start) : false;
            const isEnd = end ? isSameDay(day, end) : false;
            const isInRange = start && end ? isWithinInterval(day, { start, end }) : false;
            const isDisabled = !isCurrentMonth;

            return (
              <button
                key={format(day, 'yyyy-MM-dd')}
                type="button"
                onClick={() => !isDisabled && handleSelect(day)}
                className={cn(
                  'h-9 w-9 rounded-md text-sm font-medium transition-colors',
                  isDisabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100',
                  isInRange && isCurrentMonth && 'bg-slate-100 text-slate-900',
                  (isStart || isEnd) && 'bg-primary text-primary-foreground hover:bg-primary',
                  isStart && !end && 'ring-2 ring-primary/40'
                )}
                aria-label={format(day, 'yyyy-MM-dd')}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-500">
          Wybierz zakres dat
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBaseMonth((prev) => addMonths(prev, -1))}
            className="p-2 rounded-md border border-slate-200 hover:bg-slate-50"
            aria-label="Poprzedni miesiac"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setBaseMonth((prev) => addMonths(prev, 1))}
            className="p-2 rounded-md border border-slate-200 hover:bg-slate-50"
            aria-label="Nastepny miesiac"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-6 md:flex-row">
        {renderMonth(monthLeft)}
        {renderMonth(monthRight)}
      </div>
    </div>
  );
}
