import { getAllMachinesWithShifts } from '@/app/actions/shifts'
import { TurnosClient } from './TurnosClient'

export default async function TurnosPage() {
  const machines = await getAllMachinesWithShifts()

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Configuração de Turnos
        </h1>
        <p className="text-gray-600 mb-8">
          Configure os horários de turno para cada máquina. Os valores padrão serão usados quando não houver configuração específica.
        </p>
        <TurnosClient machines={machines} />
      </div>
    </main>
  )
}
