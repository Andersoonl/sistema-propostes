// Turno padrão:
// Seg–Qui: 07:00–17:00 (10h = 600min) - 75min pausas = 525min úteis
// Sex: 07:00–16:00 (9h = 540min) - 75min pausas = 465min úteis
// Pausas padrão: 75 min (60 almoço + 15 merenda)

export interface ShiftConfig {
  startTime: string  // HH:mm
  endTime: string    // HH:mm
  breakMinutes: number
}

export const DEFAULT_BREAK_MINUTES = 75 // 60 almoço + 15 merenda

export const DEFAULT_SHIFTS: Record<number, ShiftConfig> = {
  0: { startTime: '07:00', endTime: '07:00', breakMinutes: 0 },     // Domingo (não trabalha)
  1: { startTime: '07:00', endTime: '17:00', breakMinutes: 75 },    // Segunda
  2: { startTime: '07:00', endTime: '17:00', breakMinutes: 75 },    // Terça
  3: { startTime: '07:00', endTime: '17:00', breakMinutes: 75 },    // Quarta
  4: { startTime: '07:00', endTime: '17:00', breakMinutes: 75 },    // Quinta
  5: { startTime: '07:00', endTime: '16:00', breakMinutes: 75 },    // Sexta
  6: { startTime: '07:00', endTime: '07:00', breakMinutes: 0 },     // Sábado (não trabalha)
}

export const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function getDefaultShiftMinutes(dayOfWeek: number): number {
  const shift = DEFAULT_SHIFTS[dayOfWeek]
  if (!shift || shift.startTime === shift.endTime) return 0

  const [startHour, startMin] = shift.startTime.split(':').map(Number)
  const [endHour, endMin] = shift.endTime.split(':').map(Number)

  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
  return totalMinutes - shift.breakMinutes
}

export function getShiftMinutes(
  date: Date,
  override?: { startTime: string; endTime: string; breakMinutes: number } | null
): number {
  if (override) {
    const [startHour, startMin] = override.startTime.split(':').map(Number)
    const [endHour, endMin] = override.endTime.split(':').map(Number)
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
    return totalMinutes - override.breakMinutes
  }

  return getDefaultShiftMinutes(date.getDay())
}

export function getShiftConfig(
  date: Date,
  override?: { startTime: string; endTime: string; breakMinutes: number } | null
): ShiftConfig {
  if (override) {
    return {
      startTime: override.startTime,
      endTime: override.endTime,
      breakMinutes: override.breakMinutes,
    }
  }

  return DEFAULT_SHIFTS[date.getDay()]
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}min`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}min`
}

export function getDayOfWeekName(dayOfWeek: number): string {
  const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  return names[dayOfWeek]
}
