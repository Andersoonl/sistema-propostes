import { getCashFlowData } from '@/app/actions/cash-flow'
import { FluxoCaixaClient } from './FluxoCaixaClient'

export default async function FluxoCaixaPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const initialData = await getCashFlowData(year, month)

  return (
    <FluxoCaixaClient
      initialYear={year}
      initialMonth={month}
      initialData={initialData}
    />
  )
}
