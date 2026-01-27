'use client'

import { useState } from 'react'

interface DatePickerProps {
  value: Date
  onChange: (date: Date) => void
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  return (
    <input
      type="date"
      value={formatDate(value)}
      onChange={(e) => {
        const newDate = new Date(e.target.value + 'T12:00:00')
        onChange(newDate)
      }}
      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#3bbfb5] focus:ring-[#3bbfb5] sm:text-sm px-3 py-2 border"
    />
  )
}

interface MonthPickerProps {
  year: number
  month: number
  onChange: (year: number, month: number) => void
}

export function MonthPicker({ year, month, onChange }: MonthPickerProps) {
  const handlePrev = () => {
    if (month === 1) {
      onChange(year - 1, 12)
    } else {
      onChange(year, month - 1)
    }
  }

  const handleNext = () => {
    if (month === 12) {
      onChange(year + 1, 1)
    } else {
      onChange(year, month + 1)
    }
  }

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handlePrev}
        className="p-2 rounded-md hover:bg-gray-100"
      >
        &larr;
      </button>
      <span className="text-lg font-medium min-w-[180px] text-center">
        {monthNames[month - 1]} {year}
      </span>
      <button
        onClick={handleNext}
        className="p-2 rounded-md hover:bg-gray-100"
      >
        &rarr;
      </button>
    </div>
  )
}
