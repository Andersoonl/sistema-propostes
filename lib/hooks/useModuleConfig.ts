'use client'

import { useState, useEffect, useCallback } from 'react'
import { MODULE_SECTIONS, type ModuleSection } from '@/lib/modules'

const STORAGE_KEY = 'propostes:module-overrides'

type Overrides = Record<string, boolean>

function loadOverrides(): Overrides {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveOverrides(overrides: Overrides) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

export function isSectionEnabled(section: ModuleSection, overrides: Overrides): boolean {
  if (section.id in overrides) return overrides[section.id]
  return section.enabledByDefault
}

export function useModuleConfig() {
  const [overrides, setOverrides] = useState<Overrides>({})
  const [mounted, setMounted] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const loaded = loadOverrides()
    setOverrides(loaded)
    setMounted(true)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const isEnabled = useCallback(
    (sectionId: string): boolean => {
      const section = MODULE_SECTIONS.find((s) => s.id === sectionId)
      if (!section) return false
      if (!mounted) return section.enabledByDefault
      return isSectionEnabled(section, overrides)
    },
    [overrides, mounted]
  )

  const toggleSection = useCallback(
    (sectionId: string) => {
      setOverrides((prev) => {
        const section = MODULE_SECTIONS.find((s) => s.id === sectionId)
        if (!section) return prev
        const currentlyEnabled = isSectionEnabled(section, prev)
        const next = { ...prev, [sectionId]: !currentlyEnabled }
        saveOverrides(next)
        return next
      })
    },
    []
  )

  const enabledSections = MODULE_SECTIONS.filter((s) =>
    mounted ? isSectionEnabled(s, overrides) : s.enabledByDefault
  )

  return { isEnabled, toggleSection, enabledSections, mounted, sections: MODULE_SECTIONS }
}
