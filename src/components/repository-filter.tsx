import { useState, type FormEvent } from 'react'
import { ChevronDown, GitBranch, Loader2, Pin, Plus, X } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { shortRepo } from '@/lib/format'
import type { RepositoryChoice } from '@/lib/types'
import { addRepositoryFn, setRepositoryPinFn } from '@/server/repository.functions'

/**
 * Repository selection dropdown for the header, backed by the durable catalog.
 *
 * The list is the catalog, not just the repositories observed in the current
 * range: a repository stays selectable (with a real `0`) when the selected
 * range has no activity for it. A repository can be added by hand only after the
 * server validates it with `gh repo view` inside the configured organization.
 */
export function RepositoryFilter({
  choices,
  selected,
  onChange,
  onCatalogChanged,
}: {
  choices: RepositoryChoice[]
  selected: string[]
  onChange: (next: string[]) => void
  onCatalogChanged?: () => void
}) {
  const addRepository = useServerFn(addRepositoryFn)
  const setRepositoryPin = useServerFn(setRepositoryPinFn)
  const { t } = useI18n()

  const [adding, setAdding] = useState(false)
  const [fullName, setFullName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function toggle(repo: string) {
    onChange(
      selected.includes(repo) ? selected.filter((value) => value !== repo) : [...selected, repo],
    )
  }

  function remove(repo: string) {
    onChange(selected.filter((value) => value !== repo))
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = fullName.trim()
    if (!value || pending) return
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const result = await addRepository({ data: { fullName: value } })
      if (result.ok) {
        setFullName('')
        setAdding(false)
        setNotice(`${result.repository.fullName} ${t.filters.validatedAndPinnedNotice}`)
        onCatalogChanged?.()
      } else {
        setError(result.error)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPending(false)
    }
  }

  async function handlePin(repo: string, pinned: boolean) {
    setError(null)
    setNotice(null)
    try {
      const result = await setRepositoryPin({ data: { fullName: repo, pinned } })
      if (result.ok) {
        setNotice(
          pinned
            ? `${result.repository.fullName} ${t.filters.pinnedNotice}`
            : `${result.repository.fullName} ${t.filters.unpinnedNotice}`,
        )
        onCatalogChanged?.()
      } else {
        setError(result.error)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const current =
    selected.length === 0
      ? t.filters.allRepositories
      : selected.length === 1
        ? shortRepo(selected[0] ?? '')
        : `${selected.length} ${t.filters.repositories.toLowerCase()}`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 font-normal"
            aria-label={`${t.filters.repositories}: ${current}`}
          >
            <GitBranch className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="max-w-40 truncate sm:max-w-60">{current}</span>
            <ChevronDown className="size-3.5 opacity-50 shrink-0" aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" sideOffset={8} className="w-72 max-h-80 overflow-y-auto">
          <DropdownMenuLabel className="flex items-center justify-between gap-2">
            <span>{t.filters.repositories}</span>
            <span className="text-muted-foreground text-xs font-normal">
              {selected.length === 0 ? t.filters.all : `${selected.length} ${t.filters.selected}`}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={selected.length === 0}
            onCheckedChange={(checked) => {
              if (checked) onChange([])
            }}
            onSelect={(event) => event.preventDefault()}
          >
            {t.filters.allRepositories}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {choices.map((choice) => {
            const active = selected.includes(choice.repo)
            return (
              <div key={choice.repo} className="flex items-center">
                <DropdownMenuCheckboxItem
                  className="min-w-0 flex-1"
                  checked={active}
                  title={choice.repo}
                  onCheckedChange={() => toggle(choice.repo)}
                  onSelect={(event) => event.preventDefault()}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    {choice.pinned ? (
                      <Pin className="size-3 shrink-0" aria-label={t.filters.pin} />
                    ) : null}
                    <span className="truncate">{shortRepo(choice.repo)}</span>
                  </span>
                  <DropdownMenuShortcut>{choice.itemCount}</DropdownMenuShortcut>
                </DropdownMenuCheckboxItem>
                <button
                  type="button"
                  onClick={() => void handlePin(choice.repo, !choice.pinned)}
                  className="text-muted-foreground hover:text-foreground mr-1 shrink-0 rounded-xs p-1 transition-colors"
                  aria-label={choice.pinned ? `${t.filters.unpin} ${choice.repo}` : `${t.filters.pin} ${choice.repo}`}
                  title={choice.pinned ? t.filters.unpin : t.filters.pin}
                >
                  <Pin className={choice.pinned ? 'size-3.5' : 'size-3.5 opacity-40'} aria-hidden />
                </button>
              </div>
            )
          })}
          {choices.length === 0 ? (
            <div className="text-muted-foreground px-2 py-1.5 text-xs">
              {t.filters.emptyCatalog}
            </div>
          ) : null}
          <DropdownMenuSeparator />
          <div className="text-muted-foreground px-2 pb-1.5 text-xs">
            {t.filters.catalogHint}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {selected.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map((repo) => (
            <Badge key={repo} variant="secondary" className="h-7 gap-1 pr-1 font-normal text-xs">
              <span className="max-w-36 truncate" title={repo}>
                {shortRepo(repo)}
              </span>
              <button
                type="button"
                onClick={() => remove(repo)}
                className="hover:bg-muted-foreground/20 rounded-xs p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={`${t.filters.removeRepositoryFilter} ${shortRepo(repo)}`}
                title={`${t.filters.removeRepositoryFilter} ${shortRepo(repo)}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 font-normal"
        aria-expanded={adding}
        aria-label={t.filters.addRepository}
        title={t.filters.addRepository}
        onClick={() => {
          setAdding((value) => !value)
          setError(null)
          setNotice(null)
        }}
      >
        <Plus className="size-4" aria-hidden />
        {t.filters.add}
      </Button>

      {adding ? (
        <form className="flex items-center gap-1.5" onSubmit={handleAdd}>
          <Input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder={t.filters.searchPlaceholder}
            aria-label={t.filters.searchPlaceholder}
            className="h-8 w-48"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" size="sm" disabled={pending || fullName.trim().length === 0}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t.filters.validateAndPin}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-destructive w-full text-xs" role="alert">
          {error}
        </p>
      ) : notice ? (
        <p className="text-muted-foreground w-full text-xs" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  )
}
