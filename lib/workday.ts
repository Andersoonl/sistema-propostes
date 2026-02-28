export function getNextWorkingDay(date: Date): Date {
  const result = new Date(date)
  do {
    result.setDate(result.getDate() + 1)
  } while (result.getDay() === 0 || result.getDay() === 6)
  return result
}

export function isWorkingDay(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 5
}
