import { PrismaClient } from '../app/generated/prisma/client.js'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({ url: 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })

// ============ HELPERS ============

/** Calcula os 2 dígitos verificadores de um CNPJ a partir dos 12 primeiros dígitos */
function makeCNPJ(base12: string): string {
  const digits = base12.replace(/\D/g, '').padStart(12, '0').split('').map(Number)
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const sum1 = digits.reduce((acc, d, i) => acc + d * weights1[i], 0)
  const d1 = sum1 % 11 < 2 ? 0 : 11 - (sum1 % 11)
  digits.push(d1)
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const sum2 = digits.reduce((acc, d, i) => acc + d * weights2[i], 0)
  const d2 = sum2 % 11 < 2 ? 0 : 11 - (sum2 % 11)
  return base12 + d1.toString() + d2.toString()
}

/** Busca produto por nome (lança erro se não encontrar) */
async function requireProduct(name: string) {
  const product = await prisma.product.findUnique({ where: { name } })
  if (!product) throw new Error(`Produto não encontrado: ${name}`)
  return product
}

/** Busca ingrediente por nome (lança erro se não encontrar) */
async function requireIngredient(name: string) {
  const ingredient = await prisma.ingredient.findUnique({ where: { name } })
  if (!ingredient) throw new Error(`Ingrediente não encontrado: ${name}`)
  return ingredient
}

/** Busca máquina por nome (lança erro se não encontrar) */
async function requireMachine(name: string) {
  const machine = await prisma.machine.findUnique({ where: { name } })
  if (!machine) throw new Error(`Máquina não encontrada: ${name}`)
  return machine
}

/** Retorna próximo dia útil a partir de uma data */
function getNextWorkingDay(date: Date): Date {
  const next = new Date(date)
  do {
    next.setUTCDate(next.getUTCDate() + 1)
  } while (next.getUTCDay() === 0 || next.getUTCDay() === 6) // pula sab/dom
  return next
}

// ============ MAIN ============

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║   SEED COMPLETA — Dados Complementares   ║')
  console.log('╚══════════════════════════════════════════╝')

  // ============================================================
  // 0. LOOKUP DADOS MESTRES
  // ============================================================
  console.log('\n=== 0. Buscando dados mestres ===')

  const vp1 = await requireMachine('VP1')
  const vp2 = await requireMachine('VP2')
  const hzen = await requireMachine('HZEN')
  const machines = [vp1, vp2, hzen]
  console.log(`  Máquinas: ${machines.map(m => m.name).join(', ')}`)

  const cimento = await requireIngredient('Cimento')
  const areiaFina = await requireIngredient('Areia Fina')
  const poDePedra = await requireIngredient('Pó de Pedra')
  const brita = await requireIngredient('Brita 9,5"')
  const aditivo = await requireIngredient('Aditivo')
  const agua = await requireIngredient('Água')
  console.log('  Ingredientes carregados')

  // ============================================================
  // 1. COST RECIPES + RECIPE ITEMS
  // ============================================================
  console.log('\n=== 1. CostRecipes + RecipeItems ===')

  interface RecipeDef {
    productName: string
    piecesPerCycle: number
    cyclesPerBatch: number
    piecesPerM2: number
    avgPieceWeightKg: number
    m2PerPallet?: number
    piecesPerPallet?: number
    density: number
    palletCost: number
    strappingCost: number
    plasticCost: number
    ingredients: { ingredientId: string; quantity: number }[]
  }

  // Ingredientes comuns por tipo de produto
  // Pisos H4 (25Mpa) — menos cimento
  const pisoH4Ingredients = [
    { ingredientId: cimento.id, quantity: 250 },
    { ingredientId: areiaFina.id, quantity: 450 },
    { ingredientId: poDePedra.id, quantity: 600 },
    { ingredientId: brita.id, quantity: 350 },
    { ingredientId: aditivo.id, quantity: 800 },
    { ingredientId: agua.id, quantity: 120 },
  ]

  // Pisos H6 (35Mpa) — cimento médio
  const pisoH6Ingredients = [
    { ingredientId: cimento.id, quantity: 320 },
    { ingredientId: areiaFina.id, quantity: 420 },
    { ingredientId: poDePedra.id, quantity: 580 },
    { ingredientId: brita.id, quantity: 380 },
    { ingredientId: aditivo.id, quantity: 900 },
    { ingredientId: agua.id, quantity: 130 },
  ]

  // Pisos H8 (35Mpa) — mais cimento
  const pisoH8Ingredients = [
    { ingredientId: cimento.id, quantity: 380 },
    { ingredientId: areiaFina.id, quantity: 400 },
    { ingredientId: poDePedra.id, quantity: 550 },
    { ingredientId: brita.id, quantity: 420 },
    { ingredientId: aditivo.id, quantity: 1000 },
    { ingredientId: agua.id, quantity: 140 },
  ]

  // Unistein H6 (35Mpa)
  const unisteinH6Ingredients = [
    { ingredientId: cimento.id, quantity: 330 },
    { ingredientId: areiaFina.id, quantity: 410 },
    { ingredientId: poDePedra.id, quantity: 570 },
    { ingredientId: brita.id, quantity: 400 },
    { ingredientId: aditivo.id, quantity: 950 },
    { ingredientId: agua.id, quantity: 135 },
  ]

  // Unistein H8 (35Mpa)
  const unisteinH8Ingredients = [
    { ingredientId: cimento.id, quantity: 390 },
    { ingredientId: areiaFina.id, quantity: 390 },
    { ingredientId: poDePedra.id, quantity: 540 },
    { ingredientId: brita.id, quantity: 430 },
    { ingredientId: aditivo.id, quantity: 1050 },
    { ingredientId: agua.id, quantity: 145 },
  ]

  // Pisograma H8
  const pisogramaIngredients = [
    { ingredientId: cimento.id, quantity: 360 },
    { ingredientId: areiaFina.id, quantity: 380 },
    { ingredientId: poDePedra.id, quantity: 560 },
    { ingredientId: brita.id, quantity: 440 },
    { ingredientId: aditivo.id, quantity: 1100 },
    { ingredientId: agua.id, quantity: 150 },
  ]

  // Blocos BV09 (3,0Mpa) — menos cimento
  const blocoV09Ingredients = [
    { ingredientId: cimento.id, quantity: 180 },
    { ingredientId: areiaFina.id, quantity: 500 },
    { ingredientId: poDePedra.id, quantity: 650 },
    { ingredientId: brita.id, quantity: 300 },
    { ingredientId: aditivo.id, quantity: 600 },
    { ingredientId: agua.id, quantity: 110 },
  ]

  // Blocos V14 (3,0Mpa)
  const blocoV14Ingredients = [
    { ingredientId: cimento.id, quantity: 200 },
    { ingredientId: areiaFina.id, quantity: 480 },
    { ingredientId: poDePedra.id, quantity: 630 },
    { ingredientId: brita.id, quantity: 320 },
    { ingredientId: aditivo.id, quantity: 650 },
    { ingredientId: agua.id, quantity: 115 },
  ]

  // Blocos E14 (4,5Mpa) — mais cimento
  const blocoE14Ingredients = [
    { ingredientId: cimento.id, quantity: 240 },
    { ingredientId: areiaFina.id, quantity: 460 },
    { ingredientId: poDePedra.id, quantity: 610 },
    { ingredientId: brita.id, quantity: 340 },
    { ingredientId: aditivo.id, quantity: 700 },
    { ingredientId: agua.id, quantity: 120 },
  ]

  // Blocos V19 (3,0Mpa)
  const blocoV19Ingredients = [
    { ingredientId: cimento.id, quantity: 220 },
    { ingredientId: areiaFina.id, quantity: 490 },
    { ingredientId: poDePedra.id, quantity: 640 },
    { ingredientId: brita.id, quantity: 330 },
    { ingredientId: aditivo.id, quantity: 680 },
    { ingredientId: agua.id, quantity: 118 },
  ]

  // Blocos E19 (4,5Mpa)
  const blocoE19Ingredients = [
    { ingredientId: cimento.id, quantity: 260 },
    { ingredientId: areiaFina.id, quantity: 450 },
    { ingredientId: poDePedra.id, quantity: 600 },
    { ingredientId: brita.id, quantity: 360 },
    { ingredientId: aditivo.id, quantity: 750 },
    { ingredientId: agua.id, quantity: 125 },
  ]

  const recipes: RecipeDef[] = [
    // PISOS (m2PerPallet)
    { productName: 'PAVER H4 25Mpa', piecesPerCycle: 18, cyclesPerBatch: 25, piecesPerM2: 50, avgPieceWeightKg: 1.6, m2PerPallet: 5.76, density: 2.20, palletCost: 18, strappingCost: 3.50, plasticCost: 2, ingredients: pisoH4Ingredients },
    { productName: 'PAVER H6 35Mpa VP', piecesPerCycle: 12, cyclesPerBatch: 22, piecesPerM2: 50, avgPieceWeightKg: 2.4, m2PerPallet: 4.80, density: 2.25, palletCost: 18, strappingCost: 3.50, plasticCost: 2, ingredients: pisoH6Ingredients },
    { productName: 'PAVER H6 35Mpa HZ', piecesPerCycle: 12, cyclesPerBatch: 22, piecesPerM2: 50, avgPieceWeightKg: 2.4, m2PerPallet: 4.80, density: 2.25, palletCost: 18, strappingCost: 3.50, plasticCost: 2, ingredients: pisoH6Ingredients },
    { productName: 'PAVER H8 35Mpa VP', piecesPerCycle: 8, cyclesPerBatch: 20, piecesPerM2: 50, avgPieceWeightKg: 3.2, m2PerPallet: 3.20, density: 2.30, palletCost: 18, strappingCost: 3.50, plasticCost: 2, ingredients: pisoH8Ingredients },
    { productName: 'PAVER H8 35Mpa HZ', piecesPerCycle: 8, cyclesPerBatch: 20, piecesPerM2: 50, avgPieceWeightKg: 3.2, m2PerPallet: 3.20, density: 2.30, palletCost: 18, strappingCost: 3.50, plasticCost: 2, ingredients: pisoH8Ingredients },
    { productName: 'UNISTEIN H6 35Mpa VP', piecesPerCycle: 10, cyclesPerBatch: 22, piecesPerM2: 42, avgPieceWeightKg: 2.8, m2PerPallet: 5.00, density: 2.25, palletCost: 18, strappingCost: 3.50, plasticCost: 2, ingredients: unisteinH6Ingredients },
    { productName: 'UNISTEIN H6 35Mpa HZ', piecesPerCycle: 10, cyclesPerBatch: 22, piecesPerM2: 42, avgPieceWeightKg: 2.8, m2PerPallet: 5.00, density: 2.25, palletCost: 18, strappingCost: 3.50, plasticCost: 2, ingredients: unisteinH6Ingredients },
    { productName: 'UNISTEIN H8 35Mpa (VP)', piecesPerCycle: 7, cyclesPerBatch: 20, piecesPerM2: 42, avgPieceWeightKg: 3.5, m2PerPallet: 3.50, density: 2.30, palletCost: 18, strappingCost: 3.50, plasticCost: 2, ingredients: unisteinH8Ingredients },
    { productName: 'UNISTEIN H8 35Mpa (HZ)', piecesPerCycle: 7, cyclesPerBatch: 20, piecesPerM2: 42, avgPieceWeightKg: 3.5, m2PerPallet: 3.50, density: 2.30, palletCost: 18, strappingCost: 3.50, plasticCost: 2, ingredients: unisteinH8Ingredients },
    { productName: 'PISOGRAMA H8 35Mpa', piecesPerCycle: 6, cyclesPerBatch: 18, piecesPerM2: 8, avgPieceWeightKg: 12.0, m2PerPallet: 6.00, density: 2.30, palletCost: 18, strappingCost: 3.50, plasticCost: 2, ingredients: pisogramaIngredients },
    // BLOCOS (piecesPerPallet)
    { productName: 'BV09 3,0Mpa', piecesPerCycle: 8, cyclesPerBatch: 22, piecesPerM2: 16.5, avgPieceWeightKg: 6.0, piecesPerPallet: 120, density: 2.05, palletCost: 15, strappingCost: 2.50, plasticCost: 1.50, ingredients: blocoV09Ingredients },
    { productName: 'BV14 3,0Mpa', piecesPerCycle: 6, cyclesPerBatch: 20, piecesPerM2: 12.5, avgPieceWeightKg: 9.5, piecesPerPallet: 90, density: 2.10, palletCost: 15, strappingCost: 2.50, plasticCost: 1.50, ingredients: blocoV14Ingredients },
    { productName: 'BE14 4,5Mpa', piecesPerCycle: 6, cyclesPerBatch: 20, piecesPerM2: 12.5, avgPieceWeightKg: 10.0, piecesPerPallet: 84, density: 2.15, palletCost: 15, strappingCost: 2.50, plasticCost: 1.50, ingredients: blocoE14Ingredients },
    { productName: 'BV19 3,0Mpa', piecesPerCycle: 4, cyclesPerBatch: 18, piecesPerM2: 12.5, avgPieceWeightKg: 13.0, piecesPerPallet: 60, density: 2.10, palletCost: 15, strappingCost: 2.50, plasticCost: 1.50, ingredients: blocoV19Ingredients },
    { productName: 'BE19 4,5Mpa', piecesPerCycle: 4, cyclesPerBatch: 18, piecesPerM2: 12.5, avgPieceWeightKg: 14.0, piecesPerPallet: 54, density: 2.15, palletCost: 15, strappingCost: 2.50, plasticCost: 1.50, ingredients: blocoE19Ingredients },
  ]

  let recipesCreated = 0
  let recipeItemsCreated = 0

  for (const r of recipes) {
    const product = await requireProduct(r.productName)

    // Upsert CostRecipe
    const existing = await prisma.costRecipe.findUnique({ where: { productId: product.id } })
    let recipe
    if (existing) {
      recipe = await prisma.costRecipe.update({
        where: { productId: product.id },
        data: {
          piecesPerCycle: r.piecesPerCycle,
          cyclesPerBatch: r.cyclesPerBatch,
          piecesPerM2: r.piecesPerM2,
          avgPieceWeightKg: r.avgPieceWeightKg,
          m2PerPallet: r.m2PerPallet ?? null,
          piecesPerPallet: r.piecesPerPallet ?? null,
          density: r.density,
          palletCost: r.palletCost,
          strappingCost: r.strappingCost,
          plasticCost: r.plasticCost,
        },
      })
    } else {
      recipe = await prisma.costRecipe.create({
        data: {
          productId: product.id,
          piecesPerCycle: r.piecesPerCycle,
          cyclesPerBatch: r.cyclesPerBatch,
          piecesPerM2: r.piecesPerM2,
          avgPieceWeightKg: r.avgPieceWeightKg,
          m2PerPallet: r.m2PerPallet ?? null,
          piecesPerPallet: r.piecesPerPallet ?? null,
          density: r.density,
          palletCost: r.palletCost,
          strappingCost: r.strappingCost,
          plasticCost: r.plasticCost,
        },
      })
    }
    recipesCreated++

    // Upsert RecipeItems
    for (const item of r.ingredients) {
      const existingItem = await prisma.recipeItem.findUnique({
        where: { recipeId_ingredientId: { recipeId: recipe.id, ingredientId: item.ingredientId } },
      })
      if (existingItem) {
        await prisma.recipeItem.update({
          where: { id: existingItem.id },
          data: { quantity: item.quantity },
        })
      } else {
        await prisma.recipeItem.create({
          data: { recipeId: recipe.id, ingredientId: item.ingredientId, quantity: item.quantity },
        })
      }
      recipeItemsCreated++
    }
  }

  console.log(`  CostRecipes: ${recipesCreated}`)
  console.log(`  RecipeItems: ${recipeItemsCreated}`)

  // ============================================================
  // 2. MACHINE SHIFTS
  // ============================================================
  console.log('\n=== 2. MachineShifts ===')

  let shiftsCreated = 0

  for (const machine of machines) {
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      let startTime: string
      let endTime: string
      let breakMinutes: number

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Sábado e Domingo — sem turno
        startTime = '07:00'
        endTime = '07:00'
        breakMinutes = 0
      } else if (dayOfWeek === 5) {
        // Sexta-feira
        startTime = '07:00'
        endTime = '16:00'
        breakMinutes = 75
      } else {
        // Segunda a Quinta
        startTime = '07:00'
        endTime = '17:00'
        breakMinutes = 75
      }

      const existing = await prisma.machineShift.findUnique({
        where: { machineId_dayOfWeek: { machineId: machine.id, dayOfWeek } },
      })
      if (existing) {
        await prisma.machineShift.update({
          where: { id: existing.id },
          data: { startTime, endTime, breakMinutes },
        })
      } else {
        await prisma.machineShift.create({
          data: { machineId: machine.id, dayOfWeek, startTime, endTime, breakMinutes },
        })
      }
      shiftsCreated++
    }
  }

  console.log(`  MachineShifts: ${shiftsCreated}`)

  // ============================================================
  // 3. CUSTOMERS
  // ============================================================
  console.log('\n=== 3. Customers ===')

  const customersData = [
    {
      companyName: 'Construtora Horizonte Ltda',
      tradeName: 'Horizonte Engenharia',
      document: '11222333000181',
      documentType: 'CNPJ',
      zipCode: '60150160',
      street: 'Av. Beira Mar',
      number: '3456',
      complement: 'Sala 801',
      neighborhood: 'Meireles',
      city: 'Fortaleza',
      state: 'CE',
      phone: '8532451234',
      email: 'contato@horizonteeng.com.br',
      contactName: 'Roberto Mendes',
      status: 'ACTIVE' as const,
    },
    {
      companyName: 'MRV Engenharia e Participações SA',
      tradeName: 'MRV',
      document: '33000167000101',
      documentType: 'CNPJ',
      zipCode: '30130000',
      street: 'Av. Afonso Pena',
      number: '1500',
      complement: '10º andar',
      neighborhood: 'Centro',
      city: 'Belo Horizonte',
      state: 'MG',
      phone: '3132911000',
      email: 'compras.ce@mrv.com.br',
      contactName: 'Luciana Torres',
      status: 'ACTIVE' as const,
    },
    {
      companyName: 'Cimentos & Construções Jaguaribe Ltda',
      tradeName: 'Jaguaribe Construções',
      document: '45997418000153',
      documentType: 'CNPJ',
      zipCode: '61900000',
      street: 'Rod. Dr. Mendel Steinbruch',
      number: 'Km 12',
      neighborhood: 'Distrito Industrial',
      city: 'Maracanaú',
      state: 'CE',
      phone: '8534781500',
      email: 'compras@jaguaribeconstrucoes.com.br',
      contactName: 'Carlos Eduardo',
      status: 'ACTIVE' as const,
    },
    {
      companyName: 'Incorporadora Praia Grande Ltda',
      tradeName: 'Praia Grande',
      document: '60701190000104',
      documentType: 'CNPJ',
      zipCode: '60175050',
      street: 'Rua Frei Mansueto',
      number: '456',
      complement: 'Sala 302',
      neighborhood: 'Varjota',
      city: 'Fortaleza',
      state: 'CE',
      phone: '8530451678',
      email: 'projetos@praiagrande.com.br',
      contactName: 'Ana Paula Ribeiro',
      status: 'ACTIVE' as const,
    },
    {
      companyName: 'Edilson Souza dos Santos',
      document: '52998224725',
      documentType: 'CPF',
      zipCode: '61600000',
      street: 'Rua José Avelino',
      number: '789',
      neighborhood: 'Centro',
      city: 'Caucaia',
      state: 'CE',
      phone: '85991234567',
      email: 'edilson.souza@gmail.com',
      contactName: 'Edilson Souza',
      status: 'ACTIVE' as const,
    },
    {
      companyName: 'Omega Empreendimentos Imobiliários Ltda',
      tradeName: 'Omega',
      document: '04252011000110',
      documentType: 'CNPJ',
      zipCode: '61760000',
      street: 'Av. Eusébio de Queiroz',
      number: '1234',
      complement: 'Bloco B',
      neighborhood: 'Precabura',
      city: 'Eusébio',
      state: 'CE',
      phone: '8531121900',
      email: 'contato@omega-emp.com.br',
      contactName: 'Marcelo Gomes',
      status: 'ACTIVE' as const,
    },
    {
      companyName: 'Construtora Nordeste Ativo Ltda',
      tradeName: 'Nordeste Ativo',
      document: '61198164000160',
      documentType: 'CNPJ',
      zipCode: '60060440',
      street: 'Rua Barão do Rio Branco',
      number: '245',
      neighborhood: 'Centro',
      city: 'Fortaleza',
      state: 'CE',
      phone: '8531015500',
      email: 'engenharia@nordesteativo.com.br',
      contactName: 'Fernando Lopes',
      status: 'INACTIVE' as const,
    },
  ]

  const customerMap: Record<string, string> = {} // tradeName/companyName → id
  let customersCreated = 0

  for (const c of customersData) {
    const existing = await prisma.customer.findUnique({ where: { document: c.document } })
    let customer
    if (existing) {
      customer = await prisma.customer.update({ where: { id: existing.id }, data: c })
    } else {
      customer = await prisma.customer.create({ data: c })
    }
    customerMap[c.tradeName || c.companyName] = customer.id
    customersCreated++
  }

  console.log(`  Customers: ${customersCreated}`)

  // ============================================================
  // 4. SUPPLIERS
  // ============================================================
  console.log('\n=== 4. Suppliers ===')

  const suppliersData = [
    {
      companyName: 'Cimento Montes Claros Ind. e Com. SA',
      tradeName: 'Cimento Montes Claros',
      document: '53113791000122',
      documentType: 'CNPJ',
      zipCode: '39400000',
      street: 'Rod. BR-135',
      number: 'Km 5',
      neighborhood: 'Distrito Industrial',
      city: 'Montes Claros',
      state: 'MG',
      phone: '3832191000',
      email: 'vendas@cimentomc.com.br',
      contactName: 'Rodrigo Alves',
      status: 'ACTIVE' as const,
    },
    {
      companyName: 'Areial São José Ltda',
      tradeName: 'Areial São José',
      document: '11144477735',
      documentType: 'CPF',
      zipCode: '61700000',
      street: 'Estrada do Areial',
      number: 'S/N',
      neighborhood: 'Zona Rural',
      city: 'Pacatuba',
      state: 'CE',
      phone: '85988765432',
      email: 'areialsaojose@hotmail.com',
      contactName: 'José Ferreira',
      status: 'ACTIVE' as const,
    },
    {
      companyName: 'Pedreira Central Mineração Ltda',
      tradeName: 'Pedreira Central',
      document: '12345678909',
      documentType: 'CPF',
      zipCode: '61650000',
      street: 'Rod. CE-060',
      number: 'Km 22',
      neighborhood: 'Zona Industrial',
      city: 'Itaitinga',
      state: 'CE',
      phone: '8534561100',
      email: 'vendas@pedreiracentral.com.br',
      contactName: 'Marcos Lima',
      status: 'ACTIVE' as const,
    },
    {
      companyName: 'Quimix Indústria Química Ltda',
      tradeName: 'Quimix Aditivos',
      document: makeCNPJ('718295310001'),
      documentType: 'CNPJ',
      zipCode: '60440900',
      street: 'Av. Parque Oeste',
      number: '780',
      neighborhood: 'Maraponga',
      city: 'Fortaleza',
      state: 'CE',
      phone: '8534561500',
      email: 'comercial@quimix.com.br',
      contactName: 'Patricia Mota',
      status: 'ACTIVE' as const,
    },
    {
      companyName: 'Brita Norte Mineração e Agregados Ltda',
      tradeName: 'Brita Norte',
      document: makeCNPJ('825174630001'),
      documentType: 'CNPJ',
      zipCode: '61800000',
      street: 'Rod. CE-085',
      number: 'Km 40',
      neighborhood: 'Zona Rural',
      city: 'Caucaia',
      state: 'CE',
      phone: '8534571800',
      email: 'vendas@britanorte.com.br',
      contactName: 'Paulo Ribeiro',
      status: 'INACTIVE' as const,
    },
  ]

  let suppliersCreated = 0

  for (const s of suppliersData) {
    const existing = await prisma.supplier.findUnique({ where: { document: s.document } })
    if (existing) {
      await prisma.supplier.update({ where: { id: existing.id }, data: s })
    } else {
      await prisma.supplier.create({ data: s })
    }
    suppliersCreated++
  }

  console.log(`  Suppliers: ${suppliersCreated}`)

  // ============================================================
  // 5. PRODUCT BASE PRICES
  // ============================================================
  console.log('\n=== 5. Product basePrice ===')

  const basePrices: { name: string; basePrice: number; basePriceUnit: 'M2' | 'PIECES' }[] = [
    { name: 'PAVER H4 25Mpa', basePrice: 42.00, basePriceUnit: 'M2' },
    { name: 'PAVER H6 35Mpa VP', basePrice: 55.00, basePriceUnit: 'M2' },
    { name: 'PAVER H6 35Mpa HZ', basePrice: 55.00, basePriceUnit: 'M2' },
    { name: 'PAVER H8 35Mpa VP', basePrice: 68.00, basePriceUnit: 'M2' },
    { name: 'PAVER H8 35Mpa HZ', basePrice: 68.00, basePriceUnit: 'M2' },
    { name: 'UNISTEIN H6 35Mpa VP', basePrice: 58.00, basePriceUnit: 'M2' },
    { name: 'UNISTEIN H6 35Mpa HZ', basePrice: 58.00, basePriceUnit: 'M2' },
    { name: 'UNISTEIN H8 35Mpa (VP)', basePrice: 72.00, basePriceUnit: 'M2' },
    { name: 'UNISTEIN H8 35Mpa (HZ)', basePrice: 72.00, basePriceUnit: 'M2' },
    { name: 'PISOGRAMA H8 35Mpa', basePrice: 65.00, basePriceUnit: 'M2' },
    { name: 'BV09 3,0Mpa', basePrice: 2.20, basePriceUnit: 'PIECES' },
    { name: 'BV14 3,0Mpa', basePrice: 2.80, basePriceUnit: 'PIECES' },
    { name: 'BE14 4,5Mpa', basePrice: 3.50, basePriceUnit: 'PIECES' },
    { name: 'BV19 3,0Mpa', basePrice: 4.20, basePriceUnit: 'PIECES' },
    { name: 'BE19 4,5Mpa', basePrice: 5.00, basePriceUnit: 'PIECES' },
  ]

  let pricesUpdated = 0
  for (const p of basePrices) {
    await prisma.product.update({
      where: { name: p.name },
      data: { basePrice: p.basePrice, basePriceUnit: p.basePriceUnit },
    })
    pricesUpdated++
  }

  console.log(`  Preços atualizados: ${pricesUpdated}`)

  // ============================================================
  // 6. QUOTES + QUOTE ITEMS
  // ============================================================
  console.log('\n=== 6. Quotes + QuoteItems ===')

  // Buscar produtos necessários para orçamentos
  const paverH4 = await requireProduct('PAVER H4 25Mpa')
  const paverH6VP = await requireProduct('PAVER H6 35Mpa VP')
  const paverH8VP = await requireProduct('PAVER H8 35Mpa VP')
  const paverH8HZ = await requireProduct('PAVER H8 35Mpa HZ')
  const unisteinH6VP = await requireProduct('UNISTEIN H6 35Mpa VP')
  const unisteinH8VP = await requireProduct('UNISTEIN H8 35Mpa (VP)')
  const bv09 = await requireProduct('BV09 3,0Mpa')
  const bv14 = await requireProduct('BV14 3,0Mpa')
  const be14 = await requireProduct('BE14 4,5Mpa')
  const bv19 = await requireProduct('BV19 3,0Mpa')

  interface QuoteDef {
    number: number
    customerKey: string
    status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
    date: string
    validUntil: string
    projectName: string
    paymentTerms?: string
    paymentMethod?: string
    deliveryType?: string
    items: { productId: string; quantity: number; unit: 'M2' | 'PIECES'; unitPrice: number; discount: number }[]
  }

  const quotesData: QuoteDef[] = [
    {
      number: 1,
      customerKey: 'Horizonte Engenharia',
      status: 'DRAFT',
      date: '2026-02-20',
      validUntil: '2026-03-15',
      projectName: 'Cond. Beira Mar',
      paymentTerms: '30/60/90',
      paymentMethod: 'Boleto',
      deliveryType: 'CIF',
      items: [
        { productId: paverH6VP.id, quantity: 800, unit: 'M2', unitPrice: 55.00, discount: 0 },
      ],
    },
    {
      number: 2,
      customerKey: 'MRV',
      status: 'DRAFT',
      date: '2026-02-21',
      validUntil: '2026-03-20',
      projectName: 'Res. Parque das Flores',
      paymentTerms: '30/60',
      paymentMethod: 'Transferência',
      deliveryType: 'FOB',
      items: [
        { productId: paverH8HZ.id, quantity: 1200, unit: 'M2', unitPrice: 68.00, discount: 5 },
        { productId: bv14.id, quantity: 2000, unit: 'PIECES', unitPrice: 2.80, discount: 0 },
      ],
    },
    {
      number: 3,
      customerKey: 'Jaguaribe Construções',
      status: 'SENT',
      date: '2026-02-18',
      validUntil: '2026-04-01',
      projectName: 'Lot. Boa Vista',
      paymentTerms: '15 dias',
      paymentMethod: 'PIX',
      deliveryType: 'CIF',
      items: [
        { productId: unisteinH6VP.id, quantity: 450, unit: 'M2', unitPrice: 58.00, discount: 0 },
        { productId: bv09.id, quantity: 3000, unit: 'PIECES', unitPrice: 2.20, discount: 0 },
      ],
    },
    {
      number: 4,
      customerKey: 'Omega',
      status: 'SENT',
      date: '2026-02-19',
      validUntil: '2026-04-10',
      projectName: 'Cond. Reserva Eusébio',
      paymentTerms: '30/60/90',
      paymentMethod: 'Boleto',
      deliveryType: 'CIF',
      items: [
        { productId: paverH8VP.id, quantity: 800, unit: 'M2', unitPrice: 68.00, discount: 0 },
      ],
    },
    {
      number: 5,
      customerKey: 'Horizonte Engenharia',
      status: 'APPROVED',
      date: '2026-02-10',
      validUntil: '2026-03-30',
      projectName: 'Cond. Beira Mar F2',
      paymentTerms: '30/60/90',
      paymentMethod: 'Boleto',
      deliveryType: 'CIF',
      items: [
        { productId: paverH6VP.id, quantity: 1200, unit: 'M2', unitPrice: 55.00, discount: 3 },
        { productId: unisteinH8VP.id, quantity: 600, unit: 'M2', unitPrice: 72.00, discount: 5 },
      ],
    },
    {
      number: 6,
      customerKey: 'MRV',
      status: 'APPROVED',
      date: '2026-02-12',
      validUntil: '2026-04-15',
      projectName: 'Res. Vista Alegre',
      paymentTerms: '30/60',
      paymentMethod: 'Transferência',
      deliveryType: 'FOB',
      items: [
        { productId: paverH8HZ.id, quantity: 2500, unit: 'M2', unitPrice: 68.00, discount: 8 },
      ],
    },
    {
      number: 7,
      customerKey: 'Praia Grande',
      status: 'APPROVED',
      date: '2026-02-13',
      validUntil: '2026-04-05',
      projectName: 'Edf. Porto Bello',
      paymentTerms: '30 dias',
      paymentMethod: 'Boleto',
      deliveryType: 'CIF',
      items: [
        { productId: paverH6VP.id, quantity: 600, unit: 'M2', unitPrice: 55.00, discount: 0 },
        { productId: be14.id, quantity: 1500, unit: 'PIECES', unitPrice: 3.50, discount: 0 },
      ],
    },
    {
      number: 8,
      customerKey: 'Edilson Souza dos Santos',
      status: 'REJECTED',
      date: '2026-01-25',
      validUntil: '2026-02-15',
      projectName: 'Residência Edilson',
      paymentTerms: 'À vista',
      paymentMethod: 'PIX',
      deliveryType: 'FOB',
      items: [
        { productId: bv19.id, quantity: 1200, unit: 'PIECES', unitPrice: 4.20, discount: 0 },
      ],
    },
    {
      number: 9,
      customerKey: 'Nordeste Ativo',
      status: 'EXPIRED',
      date: '2026-01-10',
      validUntil: '2026-01-31',
      projectName: 'Galpão Industrial',
      paymentTerms: '30/60/90',
      paymentMethod: 'Boleto',
      deliveryType: 'CIF',
      items: [
        { productId: paverH4.id, quantity: 400, unit: 'M2', unitPrice: 42.00, discount: 0 },
      ],
    },
  ]

  const quoteIdMap: Record<number, string> = {} // number → id
  let quotesCreated = 0
  let quoteItemsCreated = 0

  for (const q of quotesData) {
    const customerId = customerMap[q.customerKey]
    if (!customerId) throw new Error(`Cliente não encontrado: ${q.customerKey}`)

    // Calcular total
    const totalAmount = q.items.reduce((sum, item) => {
      const subtotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
      return sum + subtotal
    }, 0)

    // Verificar se orçamento já existe pelo número
    const existingQuote = await prisma.quote.findUnique({ where: { number: q.number } })
    let quoteId: string

    if (existingQuote) {
      await prisma.quote.update({
        where: { id: existingQuote.id },
        data: {
          customerId,
          date: new Date(q.date),
          validUntil: new Date(q.validUntil),
          status: q.status,
          projectName: q.projectName,
          paymentTerms: q.paymentTerms,
          paymentMethod: q.paymentMethod,
          deliveryType: q.deliveryType,
          totalAmount,
        },
      })
      quoteId = existingQuote.id
      // Limpar itens antigos para recriar
      await prisma.quoteItem.deleteMany({ where: { quoteId } })
    } else {
      const created = await prisma.quote.create({
        data: {
          number: q.number,
          customerId,
          date: new Date(q.date),
          validUntil: new Date(q.validUntil),
          status: q.status,
          projectName: q.projectName,
          paymentTerms: q.paymentTerms,
          paymentMethod: q.paymentMethod,
          deliveryType: q.deliveryType,
          totalAmount,
        },
      })
      quoteId = created.id
    }

    quoteIdMap[q.number] = quoteId
    quotesCreated++

    // Criar itens
    for (const item of q.items) {
      const subtotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
      await prisma.quoteItem.create({
        data: {
          quoteId,
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discount: item.discount,
          subtotal,
        },
      })
      quoteItemsCreated++
    }
  }

  console.log(`  Quotes: ${quotesCreated}`)
  console.log(`  QuoteItems: ${quoteItemsCreated}`)

  // ============================================================
  // 7. ORDERS + ORDER ITEMS
  // ============================================================
  console.log('\n=== 7. Orders + OrderItems ===')

  interface OrderDef {
    number: number
    customerKey: string
    quoteNumber?: number
    status: 'CONFIRMED' | 'IN_PRODUCTION' | 'READY' | 'DELIVERED' | 'CANCELLED'
    orderDate: string
    deliveryDate?: string
    paymentTerms?: string
    items: { productId: string; quantity: number; unit: 'M2' | 'PIECES'; unitPrice: number; discount: number }[]
  }

  const ordersData: OrderDef[] = [
    {
      // PED-0001 — Horizonte (de ORC-0005) — DELIVERED
      number: 1,
      customerKey: 'Horizonte Engenharia',
      quoteNumber: 5,
      status: 'DELIVERED',
      orderDate: '2026-02-16',
      deliveryDate: '2026-02-23',
      paymentTerms: '30/60/90',
      items: [
        { productId: paverH6VP.id, quantity: 1200, unit: 'M2', unitPrice: 55.00, discount: 3 },
        { productId: unisteinH8VP.id, quantity: 600, unit: 'M2', unitPrice: 72.00, discount: 5 },
      ],
    },
    {
      // PED-0002 — MRV (de ORC-0006) — READY
      number: 2,
      customerKey: 'MRV',
      quoteNumber: 6,
      status: 'READY',
      orderDate: '2026-02-17',
      deliveryDate: '2026-03-10',
      paymentTerms: '30/60',
      items: [
        { productId: paverH8HZ.id, quantity: 2500, unit: 'M2', unitPrice: 68.00, discount: 8 },
      ],
    },
    {
      // PED-0003 — Praia Grande (de ORC-0007) — IN_PRODUCTION
      number: 3,
      customerKey: 'Praia Grande',
      quoteNumber: 7,
      status: 'IN_PRODUCTION',
      orderDate: '2026-02-18',
      deliveryDate: '2026-03-15',
      paymentTerms: '30 dias',
      items: [
        { productId: paverH6VP.id, quantity: 600, unit: 'M2', unitPrice: 55.00, discount: 0 },
        { productId: be14.id, quantity: 1500, unit: 'PIECES', unitPrice: 3.50, discount: 0 },
      ],
    },
    {
      // PED-0004 — Omega (avulso) — CONFIRMED
      number: 4,
      customerKey: 'Omega',
      status: 'CONFIRMED',
      orderDate: '2026-02-25',
      deliveryDate: '2026-03-20',
      paymentTerms: '30/60/90',
      items: [
        { productId: paverH8VP.id, quantity: 500, unit: 'M2', unitPrice: 68.00, discount: 3 },
      ],
    },
    {
      // PED-0005 — Jaguaribe (avulso) — CONFIRMED
      number: 5,
      customerKey: 'Jaguaribe Construções',
      status: 'CONFIRMED',
      orderDate: '2026-02-26',
      deliveryDate: '2026-03-25',
      paymentTerms: '15 dias',
      items: [
        { productId: unisteinH6VP.id, quantity: 300, unit: 'M2', unitPrice: 58.00, discount: 0 },
        { productId: bv09.id, quantity: 2000, unit: 'PIECES', unitPrice: 2.20, discount: 0 },
      ],
    },
    {
      // PED-0006 — Horizonte (avulso) — DELIVERED
      number: 6,
      customerKey: 'Horizonte Engenharia',
      status: 'DELIVERED',
      orderDate: '2026-02-10',
      deliveryDate: '2026-02-17',
      paymentTerms: '30 dias',
      items: [
        { productId: paverH4.id, quantity: 400, unit: 'M2', unitPrice: 42.00, discount: 0 },
        { productId: bv09.id, quantity: 1000, unit: 'PIECES', unitPrice: 2.20, discount: 0 },
      ],
    },
  ]

  // Map: orderNumber → { orderId, orderItemIds[] }
  const orderMap: Record<number, { orderId: string; orderItemIds: string[] }> = {}
  let ordersCreated = 0
  let orderItemsCreated = 0

  for (const o of ordersData) {
    const customerId = customerMap[o.customerKey]
    if (!customerId) throw new Error(`Cliente não encontrado: ${o.customerKey}`)

    const quoteId = o.quoteNumber ? quoteIdMap[o.quoteNumber] : null

    const totalAmount = o.items.reduce((sum, item) => {
      const subtotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
      return sum + subtotal
    }, 0)

    const existingOrder = await prisma.order.findUnique({ where: { number: o.number } })
    let orderId: string

    if (existingOrder) {
      await prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          customerId,
          quoteId,
          orderDate: new Date(o.orderDate),
          deliveryDate: o.deliveryDate ? new Date(o.deliveryDate) : null,
          status: o.status,
          paymentTerms: o.paymentTerms,
          totalAmount,
        },
      })
      orderId = existingOrder.id
      // Limpar OPs e itens antigos (ProductionOrder→OrderItem é Restrict)
      await prisma.productionOrder.deleteMany({ where: { orderId } })
      await prisma.orderItem.deleteMany({ where: { orderId } })
    } else {
      const created = await prisma.order.create({
        data: {
          number: o.number,
          customerId,
          quoteId,
          orderDate: new Date(o.orderDate),
          deliveryDate: o.deliveryDate ? new Date(o.deliveryDate) : null,
          status: o.status,
          paymentTerms: o.paymentTerms,
          totalAmount,
        },
      })
      orderId = created.id
    }

    const orderItemIds: string[] = []

    for (const item of o.items) {
      const subtotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
      const oi = await prisma.orderItem.create({
        data: {
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discount: item.discount,
          subtotal,
        },
      })
      orderItemIds.push(oi.id)
      orderItemsCreated++
    }

    orderMap[o.number] = { orderId, orderItemIds }
    ordersCreated++
  }

  console.log(`  Orders: ${ordersCreated}`)
  console.log(`  OrderItems: ${orderItemsCreated}`)

  // ============================================================
  // 8. PRODUCTION ORDERS
  // ============================================================
  console.log('\n=== 8. ProductionOrders ===')

  interface ProdOrderDef {
    number: number
    orderNumber: number
    orderItemIndex: number // posição no array items do pedido
    productId: string
    quantityPieces: number
    stockAtCreation: number
    toProducePieces: number
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
    completedAt?: string
  }

  const prodOrdersData: ProdOrderDef[] = [
    { number: 1, orderNumber: 1, orderItemIndex: 0, productId: paverH6VP.id, quantityPieces: 60000, stockAtCreation: 45000, toProducePieces: 15000, status: 'COMPLETED', completedAt: '2026-02-22' },
    { number: 2, orderNumber: 1, orderItemIndex: 1, productId: unisteinH8VP.id, quantityPieces: 25200, stockAtCreation: 18000, toProducePieces: 7200, status: 'COMPLETED', completedAt: '2026-02-22' },
    { number: 3, orderNumber: 2, orderItemIndex: 0, productId: paverH8HZ.id, quantityPieces: 125000, stockAtCreation: 80000, toProducePieces: 45000, status: 'COMPLETED', completedAt: '2026-02-28' },
    { number: 4, orderNumber: 3, orderItemIndex: 0, productId: paverH6VP.id, quantityPieces: 30000, stockAtCreation: 20000, toProducePieces: 10000, status: 'IN_PROGRESS' },
    { number: 5, orderNumber: 3, orderItemIndex: 1, productId: be14.id, quantityPieces: 1500, stockAtCreation: 500, toProducePieces: 1000, status: 'PENDING' },
    { number: 6, orderNumber: 6, orderItemIndex: 0, productId: paverH4.id, quantityPieces: 20000, stockAtCreation: 20000, toProducePieces: 0, status: 'COMPLETED', completedAt: '2026-02-15' },
    { number: 7, orderNumber: 6, orderItemIndex: 1, productId: bv09.id, quantityPieces: 1000, stockAtCreation: 1000, toProducePieces: 0, status: 'COMPLETED', completedAt: '2026-02-15' },
  ]

  let prodOrdersCreated = 0

  for (const po of prodOrdersData) {
    const order = orderMap[po.orderNumber]
    if (!order) throw new Error(`Pedido não encontrado: PED-${String(po.orderNumber).padStart(4, '0')}`)

    const orderItemId = order.orderItemIds[po.orderItemIndex]
    if (!orderItemId) throw new Error(`Item ${po.orderItemIndex} não encontrado no pedido ${po.orderNumber}`)

    // Verificar se OP já existe pelo número
    const existingPO = await prisma.productionOrder.findUnique({ where: { number: po.number } })
    if (existingPO) {
      await prisma.productionOrder.update({
        where: { id: existingPO.id },
        data: {
          orderId: order.orderId,
          orderItemId,
          productId: po.productId,
          quantityPieces: po.quantityPieces,
          stockAtCreation: po.stockAtCreation,
          toProducePieces: po.toProducePieces,
          status: po.status,
          completedAt: po.completedAt ? new Date(po.completedAt) : null,
        },
      })
    } else {
      await prisma.productionOrder.create({
        data: {
          number: po.number,
          orderId: order.orderId,
          orderItemId,
          productId: po.productId,
          quantityPieces: po.quantityPieces,
          stockAtCreation: po.stockAtCreation,
          toProducePieces: po.toProducePieces,
          status: po.status,
          completedAt: po.completedAt ? new Date(po.completedAt) : null,
        },
      })
    }
    prodOrdersCreated++
  }

  console.log(`  ProductionOrders: ${prodOrdersCreated}`)

  // ============================================================
  // 9. PRODUÇÃO FEV/2026 (ProductionDays + ProductionItems)
  // ============================================================
  console.log('\n=== 9. Produção Fev/2026 ===')

  // 4 dias × 3 máquinas = 12 ProductionDays (23-26/fev/2026)
  // Estes são dias sem InventoryMovement (padrão novo — paletização gera o movimento)

  interface ProdDayDef {
    date: string
    machineName: string
    productName: string
    cycles: number
  }

  const prodDaysData: ProdDayDef[] = [
    // 23/fev (segunda)
    { date: '2026-02-23', machineName: 'VP1', productName: 'PAVER H6 35Mpa VP', cycles: 1050 },
    { date: '2026-02-23', machineName: 'VP2', productName: 'UNISTEIN H8 35Mpa (VP)', cycles: 980 },
    { date: '2026-02-23', machineName: 'HZEN', productName: 'PAVER H8 35Mpa HZ', cycles: 1100 },
    // 24/fev (terça)
    { date: '2026-02-24', machineName: 'VP1', productName: 'PAVER H6 35Mpa VP', cycles: 1020 },
    { date: '2026-02-24', machineName: 'VP2', productName: 'PAVER H4 25Mpa', cycles: 1150 },
    { date: '2026-02-24', machineName: 'HZEN', productName: 'BV09 3,0Mpa', cycles: 900 },
    // 25/fev (quarta)
    { date: '2026-02-25', machineName: 'VP1', productName: 'UNISTEIN H6 35Mpa VP', cycles: 1080 },
    { date: '2026-02-25', machineName: 'VP2', productName: 'PAVER H8 35Mpa VP', cycles: 950 },
    { date: '2026-02-25', machineName: 'HZEN', productName: 'BE14 4,5Mpa', cycles: 1000 },
    // 26/fev (quinta)
    { date: '2026-02-26', machineName: 'VP1', productName: 'PAVER H6 35Mpa VP', cycles: 1100 },
    { date: '2026-02-26', machineName: 'VP2', productName: 'UNISTEIN H8 35Mpa (VP)', cycles: 1030 },
    { date: '2026-02-26', machineName: 'HZEN', productName: 'PAVER H8 35Mpa HZ', cycles: 1060 },
  ]

  // Cache de receitas para calcular peças
  const recipeCache: Record<string, { piecesPerCycle: number; piecesPerM2: number; m2PerPallet?: number | null; piecesPerPallet?: number | null }> = {}
  for (const r of recipes) {
    recipeCache[r.productName] = {
      piecesPerCycle: r.piecesPerCycle,
      piecesPerM2: r.piecesPerM2,
      m2PerPallet: r.m2PerPallet,
      piecesPerPallet: r.piecesPerPallet,
    }
  }

  // Map: "date|productName" → total pieces (para paletização)
  const productionPiecesMap: Record<string, number> = {}
  let prodDaysCreated = 0
  let prodItemsCreated = 0

  for (const pd of prodDaysData) {
    const machine = machines.find(m => m.name === pd.machineName)
    if (!machine) throw new Error(`Máquina não encontrada: ${pd.machineName}`)

    const product = await requireProduct(pd.productName)
    const recipe = recipeCache[pd.productName]
    if (!recipe) throw new Error(`Receita não encontrada: ${pd.productName}`)

    const pieces = pd.cycles * recipe.piecesPerCycle
    const areaM2 = pieces / recipe.piecesPerM2
    let pallets: number | null = null
    if (recipe.m2PerPallet) {
      pallets = areaM2 / recipe.m2PerPallet
    } else if (recipe.piecesPerPallet) {
      pallets = pieces / recipe.piecesPerPallet
    }

    const dateObj = new Date(pd.date)

    // Upsert ProductionDay
    const existingDay = await prisma.productionDay.findUnique({
      where: { machineId_date: { machineId: machine.id, date: dateObj } },
    })

    let dayId: string
    if (existingDay) {
      dayId = existingDay.id
    } else {
      const created = await prisma.productionDay.create({
        data: { machineId: machine.id, date: dateObj, hasProductSwap: false },
      })
      dayId = created.id
      prodDaysCreated++
    }

    // Upsert ProductionItem
    const existingItem = await prisma.productionItem.findUnique({
      where: { productionDayId_productId: { productionDayId: dayId, productId: product.id } },
    })

    if (existingItem) {
      await prisma.productionItem.update({
        where: { id: existingItem.id },
        data: { cycles: pd.cycles, pieces, pallets, areaM2, startTime: '07:00', endTime: '17:00' },
      })
    } else {
      await prisma.productionItem.create({
        data: {
          productionDayId: dayId,
          productId: product.id,
          cycles: pd.cycles,
          pieces,
          pallets,
          areaM2,
          startTime: '07:00',
          endTime: '17:00',
        },
      })
      prodItemsCreated++
    }

    // Acumular peças para paletização
    const key = `${pd.date}|${pd.productName}`
    productionPiecesMap[key] = (productionPiecesMap[key] || 0) + pieces
  }

  console.log(`  ProductionDays: ${prodDaysCreated}`)
  console.log(`  ProductionItems: ${prodItemsCreated}`)

  // ============================================================
  // 10. PALLETIZATIONS + INVENTORY MOVEMENTS (dias 23 e 24/fev)
  // ============================================================
  console.log('\n=== 10. Palletizations + InventoryMovements ===')

  // Paletizações: dias 23 e 24/fev, paletizados no dia útil seguinte
  // Dias 25 e 26 ficam como "pendentes"

  interface PalletDef {
    productionDate: string
    productName: string
    completePallets: number
    loosePiecesAfter: number
    loosePiecesBefore: number
  }

  const palletizationsData: PalletDef[] = [
    // Dia 23/fev → paletizado 24/fev
    { productionDate: '2026-02-23', productName: 'PAVER H6 35Mpa VP', completePallets: 51, loosePiecesAfter: 30, loosePiecesBefore: 0 },
    { productionDate: '2026-02-23', productName: 'UNISTEIN H8 35Mpa (VP)', completePallets: 45, loosePiecesAfter: 17, loosePiecesBefore: 0 },
    { productionDate: '2026-02-23', productName: 'PAVER H8 35Mpa HZ', completePallets: 53, loosePiecesAfter: 25, loosePiecesBefore: 0 },
    // Dia 24/fev → paletizado 25/fev
    { productionDate: '2026-02-24', productName: 'PAVER H6 35Mpa VP', completePallets: 50, loosePiecesAfter: 20, loosePiecesBefore: 30 },
    { productionDate: '2026-02-24', productName: 'PAVER H4 25Mpa', completePallets: 71, loosePiecesAfter: 12, loosePiecesBefore: 0 },
    { productionDate: '2026-02-24', productName: 'BV09 3,0Mpa', completePallets: 59, loosePiecesAfter: 40, loosePiecesBefore: 0 },
    // Dia 25/fev → paletizado 26/fev
    { productionDate: '2026-02-25', productName: 'UNISTEIN H6 35Mpa VP', completePallets: 50, loosePiecesAfter: 10, loosePiecesBefore: 0 },
    { productionDate: '2026-02-25', productName: 'PAVER H8 35Mpa VP', completePallets: 46, loosePiecesAfter: 30, loosePiecesBefore: 0 },
  ]

  let palletizationsCreated = 0
  let invMovementsCreated = 0

  for (const p of palletizationsData) {
    const product = await requireProduct(p.productName)
    const recipe = recipeCache[p.productName]
    if (!recipe) throw new Error(`Receita não encontrada: ${p.productName}`)

    const productionDate = new Date(p.productionDate)
    const palletizedDate = getNextWorkingDay(productionDate)

    // piecesPerPallet para esta paletização
    let piecesPerPallet: number
    if (recipe.piecesPerPallet) {
      piecesPerPallet = recipe.piecesPerPallet
    } else if (recipe.m2PerPallet) {
      // Para pisos: piecesPerPallet = m2PerPallet * piecesPerM2
      piecesPerPallet = Math.round(recipe.m2PerPallet * recipe.piecesPerM2)
    } else {
      throw new Error(`Produto sem piecesPerPallet ou m2PerPallet: ${p.productName}`)
    }

    // theoreticalPieces = produção do dia para este produto
    const key = `${p.productionDate}|${p.productName}`
    const theoreticalPieces = productionPiecesMap[key] || 0

    // Cálculos
    const realPieces = p.completePallets * piecesPerPallet
    const lossPieces = theoreticalPieces + p.loosePiecesBefore - realPieces - p.loosePiecesAfter

    // Upsert Palletization
    const existingPallet = await prisma.palletization.findUnique({
      where: { productId_productionDate: { productId: product.id, productionDate } },
    })

    let palletizationId: string

    if (existingPallet) {
      await prisma.palletization.update({
        where: { id: existingPallet.id },
        data: {
          palletizedDate,
          theoreticalPieces,
          completePallets: p.completePallets,
          loosePiecesAfter: p.loosePiecesAfter,
          piecesPerPallet,
          realPieces,
          lossPieces,
          loosePiecesBefore: p.loosePiecesBefore,
        },
      })
      palletizationId = existingPallet.id
    } else {
      const created = await prisma.palletization.create({
        data: {
          productId: product.id,
          productionDate,
          palletizedDate,
          theoreticalPieces,
          completePallets: p.completePallets,
          loosePiecesAfter: p.loosePiecesAfter,
          piecesPerPallet,
          realPieces,
          lossPieces,
          loosePiecesBefore: p.loosePiecesBefore,
        },
      })
      palletizationId = created.id
    }
    palletizationsCreated++

    // InventoryMovement IN correspondente (com palletizationId)
    // Verificar se já existe movimento para esta paletização
    const existingMov = await prisma.inventoryMovement.findFirst({
      where: { palletizationId },
    })

    const invAreaM2 = realPieces / recipe.piecesPerM2
    const invPallets: number = p.completePallets

    if (existingMov) {
      await prisma.inventoryMovement.update({
        where: { id: existingMov.id },
        data: {
          productId: product.id,
          date: palletizedDate,
          type: 'IN',
          quantityPieces: realPieces,
          quantityPallets: invPallets,
          areaM2: invAreaM2,
          notes: `Paletização - ${p.completePallets} pallets completos`,
        },
      })
    } else {
      await prisma.inventoryMovement.create({
        data: {
          productId: product.id,
          date: palletizedDate,
          type: 'IN',
          quantityPieces: realPieces,
          quantityPallets: invPallets,
          areaM2: invAreaM2,
          palletizationId,
          notes: `Paletização - ${p.completePallets} pallets completos`,
        },
      })
    }
    invMovementsCreated++
  }

  console.log(`  Palletizations: ${palletizationsCreated}`)
  console.log(`  InventoryMovements (IN): ${invMovementsCreated}`)

  // ============================================================
  // 11. LOOSE PIECES BALANCE
  // ============================================================
  console.log('\n=== 11. LoosePiecesBalance ===')

  // Saldo final de peças soltas após todas as paletizações
  // Para produtos que não foram paletizados nos dias 25-26, o saldo é 0
  // Para produtos paletizados, o saldo é o loosePiecesAfter da última paletização

  const looseBalances: { productName: string; pieces: number }[] = [
    { productName: 'PAVER H6 35Mpa VP', pieces: 20 },     // última palletização dia 24
    { productName: 'UNISTEIN H8 35Mpa (VP)', pieces: 17 }, // dia 23 só
    { productName: 'PAVER H8 35Mpa HZ', pieces: 25 },     // dia 23 só
    { productName: 'PAVER H4 25Mpa', pieces: 12 },         // dia 24 só
    { productName: 'BV09 3,0Mpa', pieces: 40 },            // dia 24 só
    { productName: 'UNISTEIN H6 35Mpa VP', pieces: 10 },   // dia 25
    { productName: 'PAVER H8 35Mpa VP', pieces: 30 },      // dia 25
  ]

  let balancesCreated = 0

  for (const lb of looseBalances) {
    const product = await requireProduct(lb.productName)

    const existing = await prisma.loosePiecesBalance.findUnique({
      where: { productId: product.id },
    })

    if (existing) {
      await prisma.loosePiecesBalance.update({
        where: { id: existing.id },
        data: { pieces: lb.pieces },
      })
    } else {
      await prisma.loosePiecesBalance.create({
        data: { productId: product.id, pieces: lb.pieces },
      })
    }
    balancesCreated++
  }

  console.log(`  LoosePiecesBalance: ${balancesCreated}`)

  // ============================================================
  // RESUMO FINAL
  // ============================================================
  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║           SEED COMPLETA FINALIZADA        ║')
  console.log('╠══════════════════════════════════════════╣')
  console.log(`║  CostRecipes:       ${String(recipesCreated).padStart(4)}                ║`)
  console.log(`║  RecipeItems:       ${String(recipeItemsCreated).padStart(4)}                ║`)
  console.log(`║  MachineShifts:     ${String(shiftsCreated).padStart(4)}                ║`)
  console.log(`║  Customers:         ${String(customersCreated).padStart(4)}                ║`)
  console.log(`║  Suppliers:         ${String(suppliersCreated).padStart(4)}                ║`)
  console.log(`║  BasePrices:        ${String(pricesUpdated).padStart(4)}                ║`)
  console.log(`║  Quotes:            ${String(quotesCreated).padStart(4)}                ║`)
  console.log(`║  QuoteItems:        ${String(quoteItemsCreated).padStart(4)}                ║`)
  console.log(`║  Orders:            ${String(ordersCreated).padStart(4)}                ║`)
  console.log(`║  OrderItems:        ${String(orderItemsCreated).padStart(4)}                ║`)
  console.log(`║  ProductionOrders:  ${String(prodOrdersCreated).padStart(4)}                ║`)
  console.log(`║  ProductionDays:    ${String(prodDaysCreated).padStart(4)}                ║`)
  console.log(`║  ProductionItems:   ${String(prodItemsCreated).padStart(4)}                ║`)
  console.log(`║  Palletizations:    ${String(palletizationsCreated).padStart(4)}                ║`)
  console.log(`║  InventoryMov (IN): ${String(invMovementsCreated).padStart(4)}                ║`)
  console.log(`║  LoosePiecesBalance:${String(balancesCreated).padStart(4)}                ║`)
  console.log('╚══════════════════════════════════════════╝')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
