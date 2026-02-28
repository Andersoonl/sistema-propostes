import {
  getCommercialKPIs,
  getMonthlyVolume,
  getConversionFunnel,
  getTopCustomers,
  getTopProducts,
} from '@/app/actions/commercial-dashboard'
import { ComercialDashClient } from './ComercialDashClient'

export default async function ComercialDashPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [kpis, monthlyVolume, funnel, topCustomers, topProducts] = await Promise.all([
    getCommercialKPIs(year, month),
    getMonthlyVolume(year, month),
    getConversionFunnel(year, month),
    getTopCustomers(year, month),
    getTopProducts(year, month),
  ])

  return (
    <ComercialDashClient
      initialYear={year}
      initialMonth={month}
      initialKPIs={kpis}
      initialMonthlyVolume={monthlyVolume}
      initialFunnel={funnel}
      initialTopCustomers={topCustomers}
      initialTopProducts={topProducts}
    />
  )
}
