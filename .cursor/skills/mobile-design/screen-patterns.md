# Screen Patterns — Insta Connect Mobile

Reference implementations in `mobile/app/`.

## Auth screen (no header chrome)

**Example**: `mobile/app/(auth)/login.tsx`

Structure:

```
Screen (paddingTop: spacing.xl)
└── container (flex: 1, gap: spacing.lg)
    ├── header block (title 28px + subtitle 15px)
    ├── SegmentedControl (mode toggle)
    └── form (gap: spacing.md)
        ├── Input fields
        ├── errorBox (optional, screen-level error)
        └── Button (primary CTA with loading)
```

Screen-level error box style:

```tsx
<View style={styles.errorBox}>
  <Text style={styles.error}>{error}</Text>
</View>
// errorBox: bg errorLight, radius md, padding md
// error: fontSize 14, color error, lineHeight 20
```

Auth screens do **not** use `ScreenHeader` — they have inline hero titles.

## List screen (with header action)

**Example**: `mobile/app/(app)/index.tsx`

Structure:

```
Screen
  header: ScreenHeader(title, right: icon Pressable)
  ├── empty state: Card (centered title + text + Button)
  └── list: View (gap: spacing.sm)
      └── Pressable → Card → row (Avatar + info + ChevronRight)
```

List row info block:

- Title: 16px bold (`sessionTitle`)
- Subtitle: 13px secondary (`sessionSubtitle`)
- Badges row below with `StatusBadge`

Empty state copy pattern:

- Title: 18px bold, centered
- Description: 14px secondary, centered, lineHeight 20
- Primary button below

## Detail screen (with back navigation)

**Example**: `mobile/app/(app)/session/[sessionId].tsx`

Structure:

```
Screen
  header: ScreenHeader(title, subtitle?, onBack, backLabel?)
  └── content sections in Cards or panels
```

Use `onBack={() => router.back()}` with optional `backLabel="Voltar"`.

Hidden from tab bar: register with `href: null` in `(app)/_layout.tsx`.

## Form / settings screen

**Example**: `mobile/app/(app)/connect.tsx`

Structure:

```
Screen
  header: ScreenHeader
  └── Cards grouping related fields
      ├── Input components
      ├── SegmentedControl or QuantityStepper
      └── Button(s) at section bottom
```

Group related settings in separate `Card` components with `gap: spacing.md` between cards.

## Results / history screens

**Examples**: `results.tsx`, `history.tsx`

- Use `ScreenHeader` with back navigation
- List of `Card` items or flat rows
- Status communicated via `StatusBadge` or inline text hierarchy
- Hidden from tab bar (`href: null`)

## App shell and navigation

**File**: `mobile/app/(app)/_layout.tsx`

- Tab screens: `index` (Sessões), `connect` (Conta)
- Hidden routes: `session/[sessionId]`, `results`, `history`
- `headerShown: false` — all headers are custom via `ScreenHeader`
- Auth gate: redirects to `/(auth)/login` when unauthenticated

## Loading states

| Scope | Pattern |
|-------|---------|
| App bootstrap | Full-screen `ActivityIndicator` on `colors.background` |
| Button action | `Button loading={true}` |
| Screen-blocking | `LoadingOverlay visible={true}` |
| List refresh | Prefer inline spinner or disabled state on action button |

## Copy guidelines (pt-BR)

- Action buttons: verb-first ("Entrar", "Criar conta", "Nova sessão")
- Empty states: explain what the feature does + single CTA
- Errors: user-friendly, no technical jargon ("Não foi possível concluir a autenticação.")
- Status badges: short labels ("Conectado", "Sessão ativa", "Reconectar", "Não conectado")
- Accessibility: Portuguese labels on icon buttons ("Mostrar senha", "Ocultar senha")

## New screen checklist

1. Place file under `mobile/app/` following expo-router conventions
2. Wrap in `Screen` with appropriate `header`
3. Import theme tokens — no magic numbers for colors
4. Reuse UI components from `src/components/ui/`
5. Handle loading, empty, and error states
6. Register route in `_layout.tsx` if tab visibility needs adjustment
7. Run `npm run typecheck` from `mobile/`
