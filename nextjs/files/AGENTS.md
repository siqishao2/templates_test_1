# Project Guide (AGENTS.md)

This file describes the structure and hard rules of this project for AI coding agents working in this workspace.

## Project Overview

- **Framework**: Next.js 16 (App Router), TypeScript, strict mode
- **Styling**: Tailwind CSS v4 (integrated via `@tailwindcss/postcss`; entry point is `app/globals.css`)
- **Package manager**: bun (the only one allowed; see hard rules below)
- **Path alias**: `@/*` maps to the project root (see `tsconfig.json`)

## Directory Structure

```
app/            # App Router routes and pages (layout.tsx / page.tsx / globals.css)
app/api/        # Route Handlers (server endpoints, e.g. app/api/upload-url/route.ts)
public/         # Static assets, copied as-is at build time
lib/            # Server-side helpers provided by the platform; use them, do not modify
next.config.ts  # Platform-customized Next config: preview proxy and CORS are preconfigured; do not remove or alter existing fields
.jizao/         # Platform workspace metadata (the template's birth certificate); do not modify or delete
```

Add new pages at `app/<route>/page.tsx`, server endpoints at `app/api/<name>/route.ts`;
shared components should live in `components/` (create it on first use).

## Common Commands

- `bun install` — install dependencies; `bun add <pkg>` — add a dependency
- `bun run build` — production build (the primary way to verify changes)
- `bun run lint` — Biome check

## Hard Rules

1. **Never start the development server** (`bun run dev` / `next dev`, etc.). The dev server is managed by the platform,
   already running in the container, and supports hot reload; starting another one only deadlocks the port.
2. **Use bun only** for dependency management. Do not use npm / pnpm / yarn, to avoid extra lockfiles.
3. **Do not modify the `.jizao/` directory**; it is platform workspace metadata.
4. **Do not remove existing configuration fields in `next.config.ts`** (`basePath`, `allowedDevOrigins`,
   `images.remotePatterns`); preview and image loading depend on them. You may append new fields.
5. **Avoid using client hooks directly in Server Components**:
   - Server Components in Next.js 16 cannot directly use client hooks such as `useSearchParams()`, `usePathname()`, or `useRouter()`
   - Two distinct errors must be handled (the code must solve both, but reading the prose alone may miss one):

     **Error ①: `"You're importing a module that depends on useSearchParams"`**
     - **Cause**: A Server Component directly imports a module that depends on a client hook
     - **Fix**: Extract the hook-using part into a separate client component with the `'use client'` directive

     **Error ②: `"useSearchParams() should be wrapped in a suspense boundary"`**
     - **Cause**: A component using `useSearchParams()` outside a `<Suspense>` boundary forces static generation bailout
     - **Fix**: Wrap the client component with `<Suspense fallback={...}>` in the parent component

     **Correct approach (both steps are required)**
     ```tsx
     // ✅ Correct — extract the client component (fixes error ①) and wrap it in Suspense (fixes error ②)
     import { Suspense } from 'react'
     import SearchComponent from './SearchComponent'

     export default function Page() {
       return (
         <Suspense fallback={<div>Loading...</div>}>
           <SearchComponent />
         </Suspense>
       )
     }

     // SearchComponent.tsx
     'use client'                    // ← Fixes error ①: declare it a client component
     import { useSearchParams } from 'next/navigation'

     export default function SearchComponent() {
       const params = useSearchParams()
       return <div>{params.get('q') ?? ''}</div>  // params.get() may return null
     }
     ```

   **Incorrect approach**:
   ```tsx
   // ❌ Wrong — this fails the build
   import { useSearchParams } from 'next/navigation'

   export default function Page() {
     const params = useSearchParams() // Cannot use directly in a Server Component
     return <div>{params.get('q')}</div>
   }
   ```

## File Storage (integrate when needed)

When a requirement involves uploading, persisting, serving online, downloading, or deleting files or images, first load the
`cloud-storage` skill, then implement according to its platform rules. Do not integrate cloud storage for files used only as a
temporary preview in the current browser session that may be discarded after refresh.

Do not modify the storage helper files provided by the platform, and do not add your own S3/RustFS SDK or long-lived credentials.

## Verification

Run `bun run build` (and `bun run lint` when appropriate) to verify changes after completing them;
if you cannot run them, state the reason explicitly in your reply.
