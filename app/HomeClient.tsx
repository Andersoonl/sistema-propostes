'use client'

import Link from 'next/link'
import { useModuleConfig } from '@/lib/hooks/useModuleConfig'

export function HomeClient() {
  const { enabledSections, mounted } = useModuleConfig()

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3bbfb5]" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Propostes ERP</h1>
        <p className="text-sm text-gray-500 mt-1">Sistema Unificado de Gestao</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {enabledSections.map((section) => {
          const firstPage = section.pages[0]
          const displayPages = section.pages.slice(0, 3)
          const remaining = section.pages.length - displayPages.length

          return (
            <Link
              key={section.id}
              href={firstPage.href}
              className="bg-white rounded-lg shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-[#3bbfb5]/40 transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{section.icon}</span>
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-[#2d3e7e]">
                  {section.label}
                </h2>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                {section.pages.length} {section.pages.length === 1 ? 'area' : 'areas'}
              </p>
              <ul className="space-y-1">
                {displayPages.map((page) => (
                  <li key={page.href} className="text-sm text-gray-600">
                    {page.label}
                  </li>
                ))}
                {remaining > 0 && (
                  <li className="text-sm text-gray-400">+{remaining} mais</li>
                )}
              </ul>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
