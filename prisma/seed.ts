import { PrismaClient } from '../app/generated/prisma/client.js'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({
  url: 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

async function upsertReason(name: string, level: number, parentId: string | null) {
  const existing = await prisma.downtimeReason.findFirst({
    where: { name, level, parentId },
  })
  if (existing) return existing
  return prisma.downtimeReason.create({
    data: { name, level, parentId },
  })
}

async function main() {
  // Criar máquinas
  const machines = await Promise.all([
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

  console.log('Máquinas criadas:', machines.map(m => m.name).join(', '))

  // Criar hierarquia de motivos de parada
  // NV1: Categorias principais
  const nv1Mecanica = await upsertReason('Mecânica', 1, null)
  const nv1Eletrica = await upsertReason('Elétrica', 1, null)
  const nv1Operacional = await upsertReason('Operacional', 1, null)
  const nv1Qualidade = await upsertReason('Qualidade', 1, null)

  // NV2: Subcategorias
  const nv2Hidraulica = await upsertReason('Hidráulica', 2, nv1Mecanica.id)
  const nv2Pneumatica = await upsertReason('Pneumática', 2, nv1Mecanica.id)
  const nv2Motor = await upsertReason('Motor', 2, nv1Eletrica.id)
  const nv2Sensores = await upsertReason('Sensores', 2, nv1Eletrica.id)
  const nv2Setup = await upsertReason('Setup', 2, nv1Operacional.id)
  const nv2Manutencao = await upsertReason('Manutenção Preventiva', 2, nv1Operacional.id)
  const nv2Inspecao = await upsertReason('Inspeção', 2, nv1Qualidade.id)

  // NV3: Motivos específicos (folha)
  const nv3Motivos = [
    { name: 'Vazamento de óleo', parentId: nv2Hidraulica.id },
    { name: 'Cilindro travado', parentId: nv2Hidraulica.id },
    { name: 'Mangueira rompida', parentId: nv2Hidraulica.id },
    { name: 'Válvula com defeito', parentId: nv2Pneumatica.id },
    { name: 'Compressor parado', parentId: nv2Pneumatica.id },
    { name: 'Motor queimado', parentId: nv2Motor.id },
    { name: 'Inversor com falha', parentId: nv2Motor.id },
    { name: 'Sensor indutivo', parentId: nv2Sensores.id },
    { name: 'Encoder com falha', parentId: nv2Sensores.id },
    { name: 'Troca de molde', parentId: nv2Setup.id },
    { name: 'Ajuste de parâmetros', parentId: nv2Setup.id },
    { name: 'Lubrificação', parentId: nv2Manutencao.id },
    { name: 'Limpeza programada', parentId: nv2Manutencao.id },
    { name: 'Teste de qualidade', parentId: nv2Inspecao.id },
    { name: 'Amostragem', parentId: nv2Inspecao.id },
  ]

  for (const motivo of nv3Motivos) {
    await upsertReason(motivo.name, 3, motivo.parentId)
  }

  console.log('Motivos de parada criados (hierarquia NV1/NV2/NV3)')

  // Criar alguns produtos de exemplo
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
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
