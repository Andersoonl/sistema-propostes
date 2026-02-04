import { PrismaClient } from '../app/generated/prisma/client.js'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({
  url: 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function main() {
  console.log('Limpando dados de lançamentos...')

  // Limpar dados existentes (na ordem correta por causa das foreign keys)
  await prisma.downtimeEvent.deleteMany()
  await prisma.productionItem.deleteMany()
  await prisma.productionDay.deleteMany()

  console.log('Dados limpos!')

  // Buscar máquinas
  const machines = await prisma.machine.findMany()
  if (machines.length === 0) {
    console.error('Nenhuma máquina encontrada. Execute npm run db:seed primeiro.')
    return
  }

  // Buscar produtos
  const products = await prisma.product.findMany()
  if (products.length === 0) {
    console.error('Nenhum produto encontrado. Execute npm run db:seed primeiro.')
    return
  }

  // Buscar motivos NV2 (ou NV3 se existirem) para cada máquina
  const reasonsByMachine: Record<string, { id: string; name: string }[]> = {}
  for (const machine of machines) {
    // Buscar motivos NV3 primeiro, senão NV2
    let reasons = await prisma.downtimeReason.findMany({
      where: { machineId: machine.id, level: 3 },
      select: { id: true, name: true },
    })
    if (reasons.length === 0) {
      reasons = await prisma.downtimeReason.findMany({
        where: { machineId: machine.id, level: 2 },
        select: { id: true, name: true },
      })
    }
    reasonsByMachine[machine.id] = reasons
  }

  // Gerar dados para dezembro 2024 (dias úteis: seg-sex)
  const year = 2024
  const month = 11 // Dezembro (0-indexed)
  const daysInMonth = 31

  console.log('Gerando lançamentos para Dezembro 2024...')

  let totalDays = 0
  let totalItems = 0
  let totalDowntimes = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dayOfWeek = date.getDay()

    // Pular sábado (6) e domingo (0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue
    }

    // Para cada máquina
    for (const machine of machines) {
      // Criar ProductionDay
      const productionDay = await prisma.productionDay.create({
        data: {
          machineId: machine.id,
          date: date,
          hasProductSwap: Math.random() > 0.7, // 30% chance de troca
        },
      })
      totalDays++

      // Decidir quantos produtos (1 ou 2)
      const numProducts = productionDay.hasProductSwap ? 2 : 1
      const selectedProducts = [...products].sort(() => Math.random() - 0.5).slice(0, numProducts)

      // Criar ProductionItems
      for (const product of selectedProducts) {
        const cycles = randomInt(0, 2200)
        await prisma.productionItem.create({
          data: {
            productionDayId: productionDay.id,
            productId: product.id,
            cycles: cycles,
          },
        })
        totalItems++
      }

      // Criar DowntimeEvents (0 a 3 eventos, total até 180 minutos)
      const machineReasons = reasonsByMachine[machine.id]
      if (machineReasons && machineReasons.length > 0) {
        const numEvents = randomInt(0, 3)
        let remainingMinutes = 180

        for (let i = 0; i < numEvents && remainingMinutes > 0; i++) {
          const maxDuration = Math.min(remainingMinutes, 90) // máximo 90 min por evento
          const duration = randomInt(5, maxDuration)
          remainingMinutes -= duration

          const reason = randomElement(machineReasons)

          await prisma.downtimeEvent.create({
            data: {
              productionDayId: productionDay.id,
              reasonId: reason.id,
              durationMinutes: duration,
              notes: Math.random() > 0.7 ? 'Observação de teste' : null,
            },
          })
          totalDowntimes++
        }
      }
    }
  }

  console.log('')
  console.log('=== Resumo ===')
  console.log(`Dias de produção criados: ${totalDays}`)
  console.log(`Itens de produção criados: ${totalItems}`)
  console.log(`Eventos de parada criados: ${totalDowntimes}`)
  console.log('')
  console.log('Dados de dezembro gerados com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
