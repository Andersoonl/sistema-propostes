'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { MODULE_SECTIONS } from '@/lib/modules'
import { useModuleConfig } from '@/lib/hooks/useModuleConfig'

export function Sidebar() {
  const pathname = usePathname()
  const { isEnabled, mounted } = useModuleConfig()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [mobileOpen, setMobileOpen] = useState(false)

  // Auto-expand the section that contains the current page
  useEffect(() => {
    const active = MODULE_SECTIONS.find((s) =>
      s.pages.some((p) => pathname === p.href || pathname.startsWith(p.href + '/'))
    )
    if (active) {
      setOpenSections((prev) => ({ ...prev, [active.id]: true }))
    }
  }, [pathname])

  function toggleOpen(sectionId: string) {
    if (!isEnabled(sectionId)) return
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-[#2d3e7e] text-white p-2 rounded-md shadow-lg"
        aria-label="Menu"
      >
        {mobileOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-60 bg-[#2d3e7e] text-white flex flex-col z-40 transition-transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <Image
              src="/logo.png"
              alt="Propostes"
              width={160}
              height={46}
              className="h-10 w-auto brightness-0 invert"
              priority
            />
          </Link>
        </div>

        {/* Navigation sections */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {MODULE_SECTIONS.map((section) => {
            const enabled = mounted ? isEnabled(section.id) : section.enabledByDefault
            const isOpen = openSections[section.id] ?? false

            return (
              <div key={section.id} className="mb-1">
                {/* Section header */}
                <button
                  onClick={() => toggleOpen(section.id)}
                  disabled={!enabled}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                    enabled
                      ? 'text-white/80 hover:bg-white/10 hover:text-white'
                      : 'text-white/30 cursor-not-allowed'
                  }`}
                >
                  <span className="text-base leading-none">{section.icon}</span>
                  <span className="flex-1 text-left">{section.label}</span>
                  {enabled && (
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                  {!enabled && (
                    <span className="text-[10px] font-normal normal-case tracking-normal opacity-60">
                      desab.
                    </span>
                  )}
                </button>

                {/* Section pages */}
                {enabled && isOpen && (
                  <div className="ml-3 mt-0.5 mb-1 border-l border-white/10 pl-3">
                    {section.pages.map((page) => {
                      const isActive = pathname === page.href || pathname.startsWith(page.href + '/')
                      return (
                        <Link
                          key={page.href}
                          href={page.href}
                          onClick={() => setMobileOpen(false)}
                          className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                            isActive
                              ? 'bg-[#3bbfb5] text-white font-medium'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {page.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer - Config link */}
        <div className="border-t border-white/10 px-2 py-3">
          <Link
            href="/config/modulos"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              pathname === '/config/modulos'
                ? 'bg-[#3bbfb5] text-white font-medium'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configurar Modulos
          </Link>
        </div>
      </aside>
    </>
  )
}
