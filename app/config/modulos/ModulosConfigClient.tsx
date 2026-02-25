'use client'

import { useModuleConfig } from '@/lib/hooks/useModuleConfig'

export function ModulosConfigClient() {
  const { sections, isEnabled, toggleSection, mounted } = useModuleConfig()

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3bbfb5]" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurar Modulos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Habilite ou desabilite setores do sistema. Setores desabilitados ficam visiveis na sidebar mas nao podem ser acessados.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => {
          const enabled = isEnabled(section.id)
          return (
            <div
              key={section.id}
              className={`bg-white rounded-lg shadow-md border p-5 transition-colors ${
                enabled ? 'border-[#3bbfb5]/40' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{section.icon}</span>
                  <h2 className="text-base font-semibold text-gray-900">{section.label}</h2>
                </div>
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enabled ? 'bg-[#3bbfb5]' : 'bg-gray-300'
                  }`}
                  aria-label={`${enabled ? 'Desabilitar' : 'Habilitar'} ${section.label}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <ul className="space-y-1">
                {section.pages.map((page) => (
                  <li
                    key={page.href}
                    className={`text-sm ${enabled ? 'text-gray-600' : 'text-gray-400'}`}
                  >
                    {page.label}
                  </li>
                ))}
              </ul>

              <p className="text-xs text-gray-400 mt-3">
                {section.pages.length} {section.pages.length === 1 ? 'area' : 'areas'}
                {' · '}
                {section.enabledByDefault ? 'Habilitado por padrao' : 'Desabilitado por padrao'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
