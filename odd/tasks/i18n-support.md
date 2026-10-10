# Internationalization (i18n) support: English & Spanish

## Objective
Add full bilingual support (English and Spanish) to CodxGit with SSR-friendly cookie persistence, compile-time type-safe dictionaries, instant client toggle, and seamless header integration.

## Scope
- Type-safe dictionary system (`src/i18n/`): `en.ts` (source of truth) and `es.ts` (matching type).
- Server function to read `codxgit-locale` cookie during SSR, fallback to English.
- Client cookie write and context state management with `I18nProvider` and `useI18n()`.
- UI Toggle component (`LanguageToggle`) placed beside `ThemeToggle` in header.
- Translate user-facing labels across the dashboard (sidebar, header, filters, presets, metrics, breakdowns, work items, coverage, disclaimers).
- Comprehensive unit tests verifying dictionary parity and locale resolver.

## Tasks
- [x] C1: Implement i18n core (dictionaries, types, server loader for cookie, context provider, hook).
- [x] C2: Create `LanguageToggle` component and integrate into header and `__root.tsx`.
- [x] C3: Wire translations into UI components and add tests in `tests/i18n.test.ts`. Verify typecheck, test suite and build.
