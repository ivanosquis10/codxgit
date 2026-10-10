import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * CodxGit official isotype: Prompt Node (> •)
 * Represents code execution (prompt chevron) and verified commit record (atomic node).
 */
export function BrandLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-5 shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M 5 6 L 12 12 L 5 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
