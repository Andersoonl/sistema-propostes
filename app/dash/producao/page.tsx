import { getMonthlyProductionData, getMonthlySummary, getMonthlyProductPiecesSummary } from '@/app/actions/dashboard'
import { ProductionDashClient } from './ProductionDashClient'

export default async function ProductionDashPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [productionData, summary, productPieces] = await Promise.all([
    getMonthlyProductionData(year, month),
    getMonthlySummary(year, month),
    getMonthlyProductPiecesSummary(year, month),
  ])

  return (
    <ProductionDashClient
      initialYear={year}
      initialMonth={month}
      initialProductionData={productionData}
      initialSummary={summary}
      initialProductPieces={productPieces}
    />
  )
}
