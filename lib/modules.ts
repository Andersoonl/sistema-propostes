export interface ModulePage {
  href: string
  label: string
}

export interface ModuleSection {
  id: string
  label: string
  icon: string
  pages: ModulePage[]
  enabledByDefault: boolean
}

export const MODULE_SECTIONS: ModuleSection[] = [
  {
    id: 'producao',
    label: 'Produção',
    icon: '🏭',
    enabledByDefault: true,
    pages: [
      { href: '/dia', label: 'Lançamento Diário' },
      { href: '/producao/ordens', label: 'Ordens de Produção' },
      { href: '/paletizacao', label: 'Paletização' },
      { href: '/estoque', label: 'Estoque PA' },
      { href: '/materiais', label: 'Materiais' },
      { href: '/produtos', label: 'Produtos' },
      { href: '/motivos', label: 'Motivos de Parada' },
      { href: '/turnos', label: 'Turnos' },
    ],
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: '📋',
    enabledByDefault: true,
    pages: [
      { href: '/cadastros/clientes', label: 'Clientes' },
      { href: '/cadastros/fornecedores', label: 'Fornecedores' },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    icon: '💼',
    enabledByDefault: true,
    pages: [
      { href: '/comercial/orcamentos', label: 'Orçamentos' },
      { href: '/comercial/pedidos', label: 'Pedidos' },
    ],
  },
  {
    id: 'logistica',
    label: 'Logística',
    icon: '🚚',
    enabledByDefault: true,
    pages: [
      { href: '/logistica/entregas', label: 'Entregas' },
      { href: '/logistica/veiculos', label: 'Veículos' },
      { href: '/logistica/motoristas', label: 'Motoristas' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: '💰',
    enabledByDefault: true,
    pages: [
      { href: '/financeiro/receber', label: 'Contas a Receber' },
      { href: '/financeiro/pagar', label: 'Contas a Pagar' },
      { href: '/financeiro/fluxo', label: 'Fluxo de Caixa' },
    ],
  },
  {
    id: 'custos',
    label: 'Custos',
    icon: '📊',
    enabledByDefault: false,
    pages: [
      { href: '/custos', label: 'Custo e Precificação' },
    ],
  },
  {
    id: 'dashboards',
    label: 'Dashboards',
    icon: '📈',
    enabledByDefault: true,
    pages: [
      { href: '/dash/producao', label: 'Produção' },
      { href: '/dash/cadeia', label: 'Cadeia Produtiva' },
      { href: '/dash/paradas', label: 'Paradas' },
      { href: '/dash/comercial', label: 'Comercial' },
    ],
  },
]
