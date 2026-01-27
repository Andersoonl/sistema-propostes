import { getMonthlyDowntimeData, getDowntimePareto } from '@/app/actions/dashboard'
import { DowntimeDashClient } from './DowntimeDashClient'

export default async function DowntimeDashPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [downtimeData, paretoNV1, paretoNV2, paretoNV3] = await Promise.all([
    getMonthlyDowntimeData(year, month),
    getDowntimePareto(year, month, 1),
    getDowntimePareto(year, month, 2),
    getDowntimePareto(year, month, 3),
  ])

  return (
    <DowntimeDashClient
      initialYear={year}
      initialMonth={month}
      initialDowntimeData={downtimeData}
      initialParetoNV1={paretoNV1}
      initialParetoNV2={paretoNV2}
      initialParetoNV3={paretoNV3}
    />
  )
}
