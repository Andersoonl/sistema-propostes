import { getProductionChainSummary } from '@/app/actions/dashboard'
import { CadeiaClient } from './CadeiaClient'

export default async function CadeiaPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const chainData = await getProductionChainSummary(year, month)

  return (
    <CadeiaClient
      initialYear={year}
      initialMonth={month}
      initialData={chainData}
    />
  )
}
