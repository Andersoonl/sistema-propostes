'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dia', label: 'Lançamento' },
  { href: '/dash/producao', label: 'Dashboard Produção' },
  { href: '/dash/paradas', label: 'Dashboard Paradas' },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Propostes"
                  width={140}
                  height={40}
                  className="h-10 w-auto"
                  priority
                />
              </Link>
            </div>

            {/* Desktop navigation */}
            <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center px-4 py-2 my-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#3bbfb5]/10 text-[#2d3e7e]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-[#2d3e7e]'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="sm:hidden flex items-center">
            <MobileMenu pathname={pathname} />
          </div>
        </div>
      </div>
    </nav>
  )
}

function MobileMenu({ pathname }: { pathname: string }) {
  return (
    <div className="relative">
      <details className="group">
        <summary className="list-none cursor-pointer p-2 rounded-md hover:bg-gray-100">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </summary>
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2 text-sm ${
                  isActive
                    ? 'bg-[#3bbfb5]/10 text-[#2d3e7e]'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-[#2d3e7e]'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </details>
    </div>
  )
}
