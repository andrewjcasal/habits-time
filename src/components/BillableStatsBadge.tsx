import { useState } from 'react'
import { AlignJustify } from 'lucide-react'

interface BillableStatsBadgeProps {
  dayLabel: string
  dayIncome: number
  next7DaysIncome: number
  restOfMonthIncome: number
  last7DaysPaid: number
  prev7DaysPaid: number
}

export default function BillableStatsBadge({
  dayLabel,
  dayIncome,
  next7DaysIncome,
  restOfMonthIncome,
  last7DaysPaid,
  prev7DaysPaid,
}: BillableStatsBadgeProps) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <AlignJustify className="w-2 h-2 text-neutral-500" />
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg p-2 text-xs whitespace-nowrap z-50">
          <div className="flex justify-between gap-3">
            <span className="text-neutral-600">{dayLabel}:</span>
            <span className="font-medium text-neutral-900">${dayIncome.toFixed(0)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-neutral-600">Next 7 days:</span>
            <span className="font-medium text-neutral-900">${next7DaysIncome.toFixed(0)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-neutral-600">Rest of month:</span>
            <span className="font-medium text-neutral-900">${restOfMonthIncome.toFixed(0)}</span>
          </div>
          <div className="mt-1 pt-1 border-t border-dashed border-neutral-300">
            <div className="flex justify-between gap-3">
              <span className="text-neutral-600">Last 7 days:</span>
              <span className="font-medium text-neutral-900">${last7DaysPaid.toFixed(0)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-neutral-600">Day 14–7:</span>
              <span className="font-medium text-neutral-900">${prev7DaysPaid.toFixed(0)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
