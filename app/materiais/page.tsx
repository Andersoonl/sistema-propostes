import { getMaterialStock, getMaterialEntries, getMonthlyConsumption } from '@/app/actions/materials'
import { getIngredients } from '@/app/actions/recipes'
import { MateriaisClient } from './MateriaisClient'

export default async function MateriaisPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [stock, entries, ingredients, consumption] = await Promise.all([
    getMaterialStock(),
    getMaterialEntries(),
    getIngredients(),
    getMonthlyConsumption(year, month),
  ])

  return (
    <MateriaisClient
      initialStock={stock}
      initialEntries={entries}
      ingredients={ingredients}
      initialConsumption={consumption}
      initialYear={year}
      initialMonth={month}
    />
  )
}
