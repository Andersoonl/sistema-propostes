import { prisma } from '@/lib/prisma'
import { MotivosClient } from './MotivosClient'

export default async function MotivosPage() {
  const machines = await prisma.machine.findMany({
    orderBy: { name: 'asc' },
  })

  return <MotivosClient machines={machines} />
}
