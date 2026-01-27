import { getMonthlyProductionData, getMonthlySummary } from '@/app/actions/dashboard'
import { ProductionDashClient } from './ProductionDashClient'

export default async function ProductionDashPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [productionData, summary] = await Promise.all([
    getMonthlyProductionData(year, month),
    getMonthlySummary(year, month),
  ])

  return (
    <ProductionDashClient
      initialYear={year}
      initialMonth={month}
      initialProductionData={productionData}
      initialSummary={summary}
    />
  )
}
