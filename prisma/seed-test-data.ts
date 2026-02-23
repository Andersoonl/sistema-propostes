import { PrismaClient } from '../app/generated/prisma/client.js'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({ url: 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

// ============ HELPERS ============

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, n)
}

function isWorkday(date: Date): boolean {
  const day = date.getUTCDay()
  return day >= 1 && day <= 5 // Mon-Fri
}

function isFriday(date: Date): boolean {
  return date.getUTCDay() === 5
}

// Simulate holidays in Brazil 2025
function isHoliday(date: Date): boolean {
  const holidays = [
    '2025-01-01', // Confraternização Universal
    '2025-03-03', // Carnaval
    '2025-03-04', // Carnaval
    '2025-04-18', // Sexta-feira Santa
    '2025-04-21', // Tiradentes
    '2025-05-01', // Dia do Trabalho
    '2025-06-19', // Corpus Christi
    '2025-09-07', // Independência
    '2025-10-12', // N.S. Aparecida
    '2025-11-02', // Finados
    '2025-11-15', // Proclamação da República
    '2025-12-25', // Natal
    '2025-12-31', // Reveillon (many factories close)
  ]
  const dateStr = date.toISOString().split('T')[0]
  return holidays.includes(dateStr)
}

// ============ MAIN ============

async function main() {
  console.log('=== Limpando dados existentes ===')

  // Delete in order of dependencies
  await prisma.inventoryMovement.deleteMany({})
  console.log('  InventoryMovement deletados')
  await prisma.downtimeEvent.deleteMany({})
  console.log('  DowntimeEvent deletados')
  await prisma.productionItem.deleteMany({})
  console.log('  ProductionItem deletados')
  await prisma.productionDay.deleteMany({})
  console.log('  ProductionDay deletados')
  await prisma.materialEntry.deleteMany({})
  console.log('  MaterialEntry deletados')

  console.log('\n=== Buscando dados mestres ===')

  const machines = await prisma.machine.findMany()
  const machineMap = new Map(machines.map(m => [m.name, m]))
  console.log(`  Máquinas: ${machines.map(m => m.name).join(', ')}`)

  const products = await prisma.product.findMany({
    include: { costRecipe: true },
  })
  console.log(`  Produtos: ${products.length}`)

  const ingredients = await prisma.ingredient.findMany()
  console.log(`  Ingredientes: ${ingredients.length}`)

  // Separate products by category
  const pisos = products.filter(p => p.category === 'PISO INTERTRAVADO')
  const blocos = products.filter(p => p.category === 'BLOCO DE CONCRETO')

  // Products with recipes (for proper calculations)
  const pisosComReceita = pisos.filter(p => p.costRecipe)
  const blocosComReceita = blocos.filter(p => p.costRecipe)

  // Common products for each machine (realistic distribution)
  // VP1/VP2: mostly pisos (PAVER, UNISTEIN)
  const vp1Products = pisos.filter(p =>
    p.name.includes('VP') || p.subcategory === 'PAVER' && !p.name.includes('HZ')
  )
  const vp2Products = pisos.filter(p =>
    p.name.includes('VP') || p.subcategory === 'UNISTEIN' && !p.name.includes('HZ')
  )
  // HZEN: pisos HZ + blocos
  const hzenProducts = [
    ...pisos.filter(p => p.name.includes('HZ') || p.subcategory === 'PISOGRAMA' || p.subcategory === 'CITYPLAC'),
    ...blocos,
  ]

  // If filtered lists are empty, use all products
  const machineProducts: Record<string, typeof products> = {
    VP1: vp1Products.length > 3 ? vp1Products : pisos,
    VP2: vp2Products.length > 3 ? vp2Products : pisos,
    HZEN: hzenProducts.length > 3 ? hzenProducts : [...pisos, ...blocos],
  }

  // Get downtime reasons per machine
  const allReasons = await prisma.downtimeReason.findMany({
    where: { level: 2 }, // Use NV2 reasons (they always exist, NV3 may not)
  })
  const reasonsByMachine = new Map<string, typeof allReasons>()
  for (const m of machines) {
    reasonsByMachine.set(m.id, allReasons.filter(r => r.machineId === m.id))
  }

  console.log('\n=== Gerando dados de produção para 2025 ===')

  // Generate all working days of 2025
  const startDate = new Date('2025-01-01')
  const endDate = new Date('2025-12-31')
  const workdays: Date[] = []

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (isWorkday(d) && !isHoliday(d)) {
      workdays.push(new Date(d))
    }
  }

  console.log(`  Dias úteis em 2025: ${workdays.length}`)

  let totalProductionDays = 0
  let totalItems = 0
  let totalDowntimeEvents = 0
  let totalInventoryMovements = 0

  // For each workday, create production for each machine
  for (const date of workdays) {
    const dateStr = date.toISOString().split('T')[0]

    // Decide which machines skip today (max 2, at least 1 must produce)
    const skippedMachines = new Set<string>()
    for (const m of machines) {
      if (Math.random() > 0.90) skippedMachines.add(m.id)
    }
    if (skippedMachines.size === machines.length) {
      // All would skip — force one random machine to produce
      const forced = pick(machines)
      skippedMachines.delete(forced.id)
    }

    for (const machine of machines) {
      if (skippedMachines.has(machine.id)) continue

      const machineProds = machineProducts[machine.name] || products
      const hasSwap = Math.random() < 0.15 // 15% chance of product swap
      const numProducts = hasSwap ? 2 : 1

      const selectedProducts = pickN(machineProds, numProducts)

      // Ciclos por dia por máquina: 800-1200
      const getCycles = () => {
        return rand(800, 1200)
      }

      const productionDay = await prisma.productionDay.create({
        data: {
          machineId: machine.id,
          date,
          hasProductSwap: hasSwap,
          notes: Math.random() < 0.05 ? pick([
            'Produção normal',
            'Demanda alta',
            'Pedido urgente',
            'Lote especial',
            'Teste de qualidade OK',
          ]) : undefined,
        },
      })
      totalProductionDays++

      for (const product of selectedProducts) {
        const cycles = getCycles()
        const recipe = product.costRecipe

        // For ProductionItem: pieces is null if no recipe
        const itemPieces = recipe ? cycles * recipe.piecesPerCycle : null
        const itemAreaM2 = itemPieces && recipe?.piecesPerM2 ? itemPieces / recipe.piecesPerM2 : null
        let itemPallets: number | null = null
        if (recipe?.m2PerPallet && itemAreaM2) {
          itemPallets = itemAreaM2 / recipe.m2PerPallet
        } else if (recipe?.piecesPerPallet && itemPieces) {
          itemPallets = itemPieces / recipe.piecesPerPallet
        }

        // Start/end times
        const startHour = hasSwap && selectedProducts.indexOf(product) === 1 ? rand(12, 13) : 7
        const startMin = rand(0, 30)
        const endHour = hasSwap && selectedProducts.indexOf(product) === 0 ? rand(11, 12) : (isFriday(date) ? 16 : 17)
        const endMin = rand(0, 59)

        await prisma.productionItem.create({
          data: {
            productionDayId: productionDay.id,
            productId: product.id,
            cycles,
            pieces: itemPieces,
            pallets: itemPallets,
            areaM2: itemAreaM2,
            startTime: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
          },
        })
        totalItems++

        // For Inventory: fallback pieces = cycles when no recipe (same as saveProductionDay)
        const invPieces = recipe ? cycles * recipe.piecesPerCycle : cycles
        const invAreaM2 = invPieces && recipe?.piecesPerM2 ? invPieces / recipe.piecesPerM2 : null
        let invPallets: number | null = null
        if (recipe?.m2PerPallet && invAreaM2) {
          invPallets = invAreaM2 / recipe.m2PerPallet
        } else if (recipe?.piecesPerPallet && invPieces) {
          invPallets = invPieces / recipe.piecesPerPallet
        }

        // Create inventory IN movement
        if (invPieces > 0) {
          await prisma.inventoryMovement.create({
            data: {
              productId: product.id,
              date,
              type: 'IN',
              quantityPieces: invPieces,
              quantityPallets: invPallets,
              areaM2: invAreaM2,
              productionDayId: productionDay.id,
              notes: `Produção automática - ${cycles} ciclos`,
            },
          })
          totalInventoryMovements++
        }
      }

      // Downtime events: sempre entre 30-180 minutos totais por máquina/dia
      {
        const machineReasons = reasonsByMachine.get(machine.id) || []
        if (machineReasons.length > 0) {
          const targetMinutes = rand(30, 180) // total de parada no dia
          const numEvents = rand(1, 4)
          let remaining = targetMinutes
          for (let i = 0; i < numEvents; i++) {
            const isLast = i === numEvents - 1
            const duration = isLast ? remaining : Math.min(remaining, rand(10, Math.max(15, Math.floor(remaining / 2))))
            if (duration <= 0) break
            remaining -= duration

            const reason = pick(machineReasons)
            await prisma.downtimeEvent.create({
              data: {
                productionDayId: productionDay.id,
                reasonId: reason.id,
                durationMinutes: duration,
                notes: Math.random() < 0.3 ? pick([
                  'Aguardando peça de reposição',
                  'Manutenção preventiva',
                  'Problema elétrico resolvido',
                  'Troca de componente',
                  'Ajuste mecânico',
                  'Falta de operador',
                  'Aguardando material',
                  'Limpeza da forma',
                  'Vazamento hidráulico',
                  'Sensor desregulado',
                ]) : undefined,
              },
            })
            totalDowntimeEvents++
          }
        }
      }
    }

    // Progress log every 30 days
    if (workdays.indexOf(date) % 30 === 0) {
      console.log(`  Processado até ${dateStr} (${workdays.indexOf(date) + 1}/${workdays.length})`)
    }
  }

  console.log(`\n  Total ProductionDays: ${totalProductionDays}`)
  console.log(`  Total ProductionItems: ${totalItems}`)
  console.log(`  Total DowntimeEvents: ${totalDowntimeEvents}`)
  console.log(`  Total InventoryMovements (IN): ${totalInventoryMovements}`)

  // ============ INVENTORY OUT MOVEMENTS ============
  console.log('\n=== Gerando saídas de estoque (vendas) ===')

  let totalOutMovements = 0

  // For each month, create some OUT movements (sales/deliveries)
  for (let month = 0; month < 12; month++) {
    // Get products that had production this month
    const monthStart = new Date(2025, month, 1)
    const monthEnd = new Date(2025, month + 1, 0)

    const monthMovements = await prisma.inventoryMovement.findMany({
      where: {
        type: 'IN',
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { productId: true, quantityPieces: true },
    })

    // Aggregate IN by product
    const productTotals = new Map<string, number>()
    for (const m of monthMovements) {
      productTotals.set(m.productId, (productTotals.get(m.productId) || 0) + m.quantityPieces)
    }

    // Create 8-15 OUT movements per month (sales)
    const numSales = rand(8, 15)
    const productIds = [...productTotals.keys()]

    for (let i = 0; i < numSales && productIds.length > 0; i++) {
      const productId = pick(productIds)
      const totalIn = productTotals.get(productId) || 0
      if (totalIn <= 0) continue

      // Sell 5-40% of monthly production
      const sellPct = randFloat(0.05, 0.40)
      const sellPieces = Math.max(1, Math.round(totalIn * sellPct))

      // Random date within the month
      const saleDay = rand(1, monthEnd.getDate())
      const saleDate = new Date(2025, month, saleDay)
      if (!isWorkday(saleDate)) continue

      const product = products.find(p => p.id === productId)
      const recipe = product?.costRecipe

      const areaM2 = sellPieces && recipe?.piecesPerM2 ? sellPieces / recipe.piecesPerM2 : null
      let pallets: number | null = null
      if (recipe?.m2PerPallet && areaM2) {
        pallets = areaM2 / recipe.m2PerPallet
      } else if (recipe?.piecesPerPallet && sellPieces) {
        pallets = sellPieces / recipe.piecesPerPallet
      }

      await prisma.inventoryMovement.create({
        data: {
          productId,
          date: saleDate,
          type: 'OUT',
          quantityPieces: sellPieces,
          quantityPallets: pallets,
          areaM2,
          notes: pick([
            'Venda cliente A',
            'Venda cliente B',
            'Entrega obra centro',
            'Pedido licitação',
            'Venda balcão',
            'Entrega condomínio',
            'Pedido atacado',
            'Venda construtora',
          ]),
        },
      })
      totalOutMovements++

      // Reduce available to avoid over-selling
      productTotals.set(productId, totalIn - sellPieces)
    }
  }

  console.log(`  Total InventoryMovements (OUT): ${totalOutMovements}`)

  // ============ MATERIAL ENTRIES ============
  console.log('\n=== Gerando entradas de matéria prima ===')

  let totalMaterialEntries = 0
  const suppliers = [
    'Cimento Montes Claros',
    'Areial São José',
    'Pedreira Central',
    'Brita Norte',
    'Pigmentos Brasil',
    'Quimix Aditivos',
    'Água Municipal',
    'Concreteira Mix',
    'Mineração Sul',
    'Agregados Minas',
  ]

  for (const ingredient of ingredients) {
    // Monthly purchases (2-4 per month per ingredient)
    for (let month = 0; month < 12; month++) {
      const numPurchases = rand(2, 4)

      for (let i = 0; i < numPurchases; i++) {
        const day = rand(1, 28)
        const purchaseDate = new Date(2025, month, day)

        // Quantities based on ingredient type
        let qty: number
        let price: number

        switch (ingredient.name) {
          case 'Cimento':
            qty = rand(20000, 60000) // kg
            price = randFloat(0.48, 0.62)
            break
          case 'Areia Fina':
            qty = rand(30000, 80000)
            price = randFloat(0.028, 0.042)
            break
          case 'Pó de Pedra':
            qty = rand(25000, 70000)
            price = randFloat(0.035, 0.055)
            break
          case 'Brita 9,5"':
            qty = rand(15000, 45000)
            price = randFloat(0.06, 0.09)
            break
          case 'Pigmento':
            qty = rand(500, 3000)
            price = randFloat(3.0, 6.0)
            break
          case 'Aditivo':
            qty = rand(2000, 8000) // ml
            price = randFloat(0.004, 0.007)
            break
          case 'Água':
            qty = rand(10000, 40000) // kg
            price = 0
            break
          default:
            qty = rand(1000, 10000)
            price = randFloat(0.01, 1.0)
        }

        // Add some price variation through the year (inflation)
        const inflationFactor = 1 + (month * 0.003) // ~3.6% annual
        price = parseFloat((price * inflationFactor).toFixed(4))

        await prisma.materialEntry.create({
          data: {
            ingredientId: ingredient.id,
            date: purchaseDate,
            quantity: qty,
            unitPrice: price,
            supplier: pick(suppliers),
            invoiceNumber: `NF-${2025}${String(month + 1).padStart(2, '0')}-${rand(1000, 9999)}`,
            notes: Math.random() < 0.1 ? pick([
              'Entrega parcial',
              'Preço negociado',
              'Urgente',
              'Contrato anual',
            ]) : undefined,
          },
        })
        totalMaterialEntries++
      }
    }
  }

  console.log(`  Total MaterialEntries: ${totalMaterialEntries}`)

  console.log('\n=== Seed de teste concluído! ===')
  console.log(`  Período: Jan/2025 - Dez/2025`)
  console.log(`  ProductionDays: ${totalProductionDays}`)
  console.log(`  ProductionItems: ${totalItems}`)
  console.log(`  DowntimeEvents: ${totalDowntimeEvents}`)
  console.log(`  InventoryMovements: ${totalInventoryMovements + totalOutMovements}`)
  console.log(`  MaterialEntries: ${totalMaterialEntries}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
