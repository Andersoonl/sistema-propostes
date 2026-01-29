import { PrismaClient } from '../app/generated/prisma/client.js'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({
  url: 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

async function upsertReason(name: string, level: number, parentId: string | null, machineId: string) {
  const existing = await prisma.downtimeReason.findFirst({
    where: { name, level, parentId, machineId },
  })
  if (existing) return existing
  return prisma.downtimeReason.create({
    data: { name, level, parentId, machineId },
  })
}

// Estrutura de motivos para VP1 e VP2
interface NV1Def {
  name: string
  children: NV2Def[]
}

interface NV2Def {
  name: string
  children?: string[] // NV3 names
}

function getVPReasons(): NV1Def[] {
  return [
    {
      name: 'PINCA',
      children: [
        { name: 'Cabo' },
        { name: 'Redutor' },
        { name: 'Eletrico' },
        { name: 'Correias' },
      ],
    },
    {
      name: 'VIBROPRENSA',
      children: [
        { name: 'Agitador' },
        { name: 'Mesa' },
        { name: 'Cilindros' },
        { name: 'Sensores' },
        { name: 'Coxins' },
        { name: 'Rolamentos' },
        { name: 'Motores' },
        { name: 'Esteiras' },
        { name: 'Mangueiras' },
        { name: 'Valvulas/Blocos' },
        { name: 'Chaves/Contactores' },
        { name: 'Castelo' },
        { name: 'Forma' },
        { name: 'Unidade Hidraulica' },
        {
          name: 'Pecas desgaste',
          children: ['Parafusos', 'Chapas', 'Tecnil', 'Correias', 'Escova'],
        },
      ],
    },
    {
      name: 'MISTURADOR',
      children: [
        { name: 'Cilindro' },
        { name: 'Esteiras' },
        { name: 'Fuso Cimento' },
        { name: 'Celula de carga' },
        { name: 'Eletrico' },
        { name: 'Porta' },
        { name: 'Palhetas / Eixo' },
        {
          name: 'Pecas desgaste',
          children: ['Parafusos', 'Correias', 'Rolamentos'],
        },
      ],
    },
    {
      name: 'CENTRAL AGREGADOS (VP)',
      children: [
        { name: 'Motores' },
        { name: 'Correia' },
        { name: 'Compressor' },
        { name: 'Esteiras' },
        { name: 'Agregados' },
        {
          name: 'Pecas desgaste',
          children: ['Parafusos', 'Chapas'],
        },
      ],
    },
    {
      name: 'PALETIZACAO',
      children: [
        { name: 'Estantes' },
        { name: 'Pallets' },
        { name: 'M.O.' },
        { name: 'Tabuas' },
      ],
    },
    {
      name: 'EMPILHADEIRAS/PA',
      children: [
        { name: 'Troca oleo' },
        { name: 'Pneus' },
        { name: 'Cilindros' },
        { name: 'Freios' },
        { name: 'Motores' },
        { name: 'Mangueiras' },
      ],
    },
    {
      name: 'EXTRAS',
      children: [
        { name: 'Regulagem Maquina' },
        { name: 'Troca de forma' },
        { name: 'Dependencia da outra maquina' },
        { name: 'Pa Mecanica' },
        { name: 'Turma em outra maquina' },
        { name: 'M.O.' },
        { name: 'Chuva' },
        { name: 'Energia' },
        { name: 'Estoque Lotado' },
      ],
    },
  ]
}

function getHZENReasons(): NV1Def[] {
  return [
    {
      name: 'ELEVADOR',
      children: [
        { name: 'Correntes' },
        { name: 'Redutor' },
        { name: 'Eletrico' },
        { name: 'Motores' },
        { name: 'Sensores' },
      ],
    },
    {
      name: 'VIBROPRENSA',
      children: [
        { name: 'Agitador' },
        { name: 'Mesa' },
        { name: 'Cilindros' },
        { name: 'Sensores' },
        { name: 'Coxins' },
        { name: 'Rolamentos' },
        { name: 'Motores' },
        { name: 'Esteiras' },
        { name: 'Mangueiras' },
        { name: 'Valvulas/Blocos' },
        { name: 'Chaves/Contactores' },
        { name: 'Castelo' },
        { name: 'Forma' },
        { name: 'Unidade Hidraulica' },
        { name: 'CLP' },
        {
          name: 'Pecas desgaste',
          children: ['Parafusos', 'Chapas', 'Tecnil', 'Correias', 'Escova'],
        },
      ],
    },
    {
      name: 'MISTURADOR',
      children: [
        { name: 'Cilindro' },
        { name: 'Esteiras' },
        { name: 'Fuso Cimento' },
        { name: 'Celula de carga' },
        { name: 'Bucha do acoplamento' },
        { name: 'Palhetas / Eixo' },
        {
          name: 'Pecas desgaste',
          children: ['Parafusos', 'Correias', 'Chapas'],
        },
      ],
    },
    {
      name: 'CENTRAL AGREGADOS (HZ)',
      children: [
        { name: 'Motores' },
        { name: 'Correia' },
        { name: 'Compressor' },
        { name: 'Esteiras' },
        { name: 'Cilindros' },
        { name: 'Celula de Cargas' },
        { name: 'Agregados' },
        {
          name: 'Pecas desgaste',
          children: ['Parafusos', 'Chapas'],
        },
      ],
    },
    {
      name: 'PALETIZACAO',
      children: [
        { name: 'Estantes' },
        { name: 'Pallets' },
        { name: 'M.O.' },
        { name: 'Tabuas' },
      ],
    },
    {
      name: 'EXTRAS',
      children: [
        { name: 'Regulagem Maquina' },
        { name: 'Troca de forma' },
        { name: 'Pa Mecanica' },
        { name: 'Energia' },
        { name: 'Chuva / Infraestrutura' },
        { name: 'Suporte Tecnico HZEN' },
        { name: 'Estoque Lotado' },
      ],
    },
  ]
}

async function seedReasonsForMachine(machineId: string, reasons: NV1Def[]) {
  for (const nv1 of reasons) {
    const nv1Record = await upsertReason(nv1.name, 1, null, machineId)

    for (const nv2 of nv1.children) {
      const nv2Record = await upsertReason(nv2.name, 2, nv1Record.id, machineId)

      if (nv2.children) {
        for (const nv3Name of nv2.children) {
          await upsertReason(nv3Name, 3, nv2Record.id, machineId)
        }
      }
    }
  }
}

async function main() {
  // Criar maquinas
  const [vp1, vp2, hzen] = await Promise.all([
    prisma.machine.upsert({
      where: { name: 'VP1' },
      update: {},
      create: { name: 'VP1' },
    }),
    prisma.machine.upsert({
      where: { name: 'VP2' },
      update: {},
      create: { name: 'VP2' },
    }),
    prisma.machine.upsert({
      where: { name: 'HZEN' },
      update: {},
      create: { name: 'HZEN' },
    }),
  ])

  console.log('Maquinas criadas:', [vp1, vp2, hzen].map(m => m.name).join(', '))

  // Criar hierarquia de motivos por maquina
  const vpReasons = getVPReasons()
  const hzenReasons = getHZENReasons()

  await seedReasonsForMachine(vp1.id, vpReasons)
  console.log('Motivos VP1 criados')

  await seedReasonsForMachine(vp2.id, vpReasons)
  console.log('Motivos VP2 criados')

  await seedReasonsForMachine(hzen.id, hzenReasons)
  console.log('Motivos HZEN criados')

  // Criar produtos de exemplo
  const products = [
    'Bloco 14x19x39',
    'Bloco 19x19x39',
    'Paver 10x20',
    'Paver 10x10',
    'Meio-fio',
    'Canaleta',
  ]

  for (const name of products) {
    await prisma.product.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  console.log('Produtos criados:', products.join(', '))

  // Criar ingredientes padrão
  const ingredients = [
    { name: 'Cimento', unit: 'kg', unitPrice: 0.545 },
    { name: 'Areia Fina', unit: 'kg', unitPrice: 0.0338 },
    { name: 'Pó de Pedra', unit: 'kg', unitPrice: 0.0425 },
    { name: 'Brita 9,5"', unit: 'kg', unitPrice: 0.073 },
    { name: 'Pigmento', unit: 'kg', unitPrice: 0 },
    { name: 'Aditivo', unit: 'ml', unitPrice: 0.0052 },
    { name: 'Água', unit: 'kg', unitPrice: 0 },
  ]

  for (const ingredient of ingredients) {
    await prisma.ingredient.upsert({
      where: { name: ingredient.name },
      update: { unit: ingredient.unit, unitPrice: ingredient.unitPrice },
      create: ingredient,
    })
  }

  console.log('Ingredientes criados:', ingredients.map(i => i.name).join(', '))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
