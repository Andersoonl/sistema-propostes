import { getMonthlyProductionData, getMonthlySummary, getMonthlyProductPiecesSummary, getMonthlyDowntimeData, getDowntimePareto } from '@/app/actions/dashboard'
import { ProductionDashClient } from './ProductionDashClient'

export default async function ProductionDashPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [productionData, summary, productPieces, downtimeData, paretoNV1] = await Promise.all([
    getMonthlyProductionData(year, month),
    getMonthlySummary(year, month),
    getMonthlyProductPiecesSummary(year, month),
    getMonthlyDowntimeData(year, month),
    getDowntimePareto(year, month, 1),
  ])

  return (
    <ProductionDashClient
      initialYear={year}
      initialMonth={month}
      initialProductionData={productionData}
      initialSummary={summary}
      initialProductPieces={productPieces}
      initialDowntimeData={downtimeData}
      initialParetoNV1={paretoNV1}
    />
  )
}
