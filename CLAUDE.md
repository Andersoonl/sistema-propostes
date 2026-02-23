# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto: Controle de Produção (VP1, VP2, HZEN)

Sistema de controle de produção para 3 máquinas industriais.

### Objetivo do MVP
- Lançamento diário de produção (ciclos) por máquina e produto
- Lançamento de paradas por evento (duração em minutos + motivo obrigatório)
- Dashboards mensais: produção (linhas diárias) e paradas por setor (NV1/NV2/NV3 + Pareto)
- Sem login, uso local em computador

### Regras do processo
- Máquinas fixas: VP1, VP2, HZEN
- Produção é medida em CICLOS (contagem manual)
- Cada máquina pode ter no máximo 2 produtos no mesmo dia
- Paradas: duração (minutos) por evento; motivo NV3 obrigatório; OBS opcional
- Motivos: hierarquia NV1 -> NV2 -> NV3; novos motivos podem ser criados durante lançamento
- Turno padrão: Seg-Qui 07:00-17:00 (525min), Sex 07:00-16:00 (465min), pausas 75min

## Comandos

```bash
npm run dev           # Servidor de desenvolvimento
npm run build         # Build de produção
npm run lint          # ESLint
npm run db:migrate    # Rodar migrations do Prisma
npm run db:seed       # Popular dados iniciais
npm run db:studio     # Abrir Prisma Studio
npm run db:reset      # Resetar banco de dados
```

## Tech Stack

- Next.js 16 (App Router)
- TypeScript 5
- Prisma 7 + SQLite + @prisma/adapter-libsql
- TailwindCSS 4
- Recharts (gráficos)

## Arquitetura

```
app/
├── actions/           # Server Actions
│   ├── production.ts  # CRUD produção e paradas
│   ├── reasons.ts     # Hierarquia de motivos
│   ├── shift.ts       # Override de turno
│   └── dashboard.ts   # Agregações e Pareto
├── components/        # Componentes reutilizáveis
├── dia/               # Página de lançamento diário
├── dash/
│   ├── producao/      # Dashboard de produção
│   └── paradas/       # Dashboard de paradas + Pareto
└── generated/prisma/  # Cliente Prisma (gerado)

lib/
├── format.ts          # Formatação numérica padrão BR (OBRIGATÓRIO)
├── prisma.ts          # Singleton do Prisma
└── shift.ts           # Lógica de cálculo de turno

prisma/
├── schema.prisma      # Schema do banco
└── seed.ts            # Dados iniciais

docs/
└── importacao.md      # Layouts CSV para importação
```

## Models Prisma

- **Machine**: VP1, VP2, HZEN (fixas)
- **Product**: Produtos produzidos
- **ProductionDay**: Registro diário por máquina
- **ProductionItem**: Produto + ciclos (max 2/dia/máquina)
- **DowntimeReason**: Hierarquia NV1->NV2->NV3
- **DowntimeEvent**: Parada com duração e motivo NV3
- **ShiftOverride**: Override de turno por dia/máquina

## Padrões

### Server Actions
Todas as operações de banco usam Server Actions em `app/actions/`. Validações são feitas no servidor.

### Prisma Client (Prisma 7)
```typescript
import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({ url: 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })
```

### Formatação Numérica (OBRIGATÓRIO)
Padrão brasileiro: ponto (.) para milhares, vírgula (,) para decimais. **NUNCA use `.toFixed()` ou `.toLocaleString()` diretamente.** Sempre importe e use as funções de `lib/format.ts`:

```typescript
import { fmtInt, fmtDec, fmtMax, fmtMoney, fmtPct } from '@/lib/format'

fmtInt(1234)          // "1.234"
fmtDec(12.5, 2)       // "12,50"       (N casas fixas)
fmtMax(12.5, 2)       // "12,5"        (até N casas, sem zeros)
fmtMoney(1234.5)      // "R$ 1.234,50" (default 2 casas)
fmtMoney(0.1234, 4)   // "R$ 0,1234"   (4 casas)
fmtPct(85.3)          // "85,3%"       (default 1 casa)
```

### Turno
Lógica de turno em `lib/shift.ts`. Minutos úteis calculados automaticamente por dia da semana.
