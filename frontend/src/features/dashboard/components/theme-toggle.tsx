import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { Theme } from '../hooks/use-theme'

interface ThemeToggleProps {
  theme: Theme
  onToggle: () => void
  className?: string
}

export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}