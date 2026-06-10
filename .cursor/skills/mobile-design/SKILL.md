---
name: mobile-design
description: >-
  Designs and implements mobile UI for Insta Connect (Expo 56 / React Native).
  Applies the project design system, reusable UI components, and pt-BR copy.
  Use when creating screens, components, layouts, icons, splash, UX flows,
  or when the user mentions mobile design, UI, UX, or visual polish.
---

# Mobile Design — Insta Connect

## Before designing

1. Read existing screens in `mobile/app/` and UI in `mobile/src/components/ui/`
2. Use tokens from `mobile/src/theme/` — never hardcode colors outside tokens
3. Prefer existing UI components over new primitives
4. Write copy in Brazilian Portuguese (pt-BR)
5. Read Expo v56 docs before using new Expo APIs (see `mobile/AGENTS.md`)

## Quick reference

| Need | Use |
|------|-----|
| Colors, spacing, radius, typography | [design-system.md](design-system.md) |
| Which component to pick | [components.md](components.md) |
| Screen layout patterns | [screen-patterns.md](screen-patterns.md) |

## Implementation rules

- **Stack**: Expo 56 + expo-router + React Native `StyleSheet` (no Tailwind/NativeWind)
- **Icons**: `lucide-react-native` — size 20 for inline actions, 22 for header actions
- **Touch targets**: min 44–48px for tappable areas; `Button` uses `minHeight: 48`
- **Layout**: wrap screens in `Screen`; use `ScreenHeader` for in-app navigation chrome
- **Safe area**: `Screen` handles top/left/right; tab bar handles bottom in `(app)` layout
- **Loading**: `Button` `loading` prop for actions; `LoadingOverlay` for blocking operations
- **Errors**: field-level via `Input` `error`; screen-level in `errorBox` pattern (see login screen)
- **Lists**: `Card` rows inside `View` with `gap: spacing.sm`; chevron for drill-down
- **Empty states**: centered `Card` with title, description, and primary `Button`

## Brand assets

- App config: `mobile/app.json` (splash `#F8FAFC`, notification color `#059669`)
- Icon generation: `mobile/scripts/generate-app-icons.mjs` (run from `mobile/` with logo path)
- Adaptive icon background: `#D1FAE5` (matches `colors.primaryLight`)

## Anti-patterns

- Do not use `constants/Colors.ts` or `components/Themed.tsx` (Expo template leftovers)
- Do not introduce new UI libraries without explicit request
- Do not use English UI strings unless matching an existing English screen
- Do not create one-off button styles — extend `Button` variants if needed
- Do not bypass `Screen` for full-page layouts

## Quality checklist

- [ ] Uses `colors`, `spacing`, `radius` from `@/src/theme/*`
- [ ] Reuses `Screen` / `ScreenHeader` / `Card` where applicable
- [ ] `accessibilityLabel` on icon-only `Pressable` buttons
- [ ] Disabled and loading states handled
- [ ] Consistent typography scale with adjacent screens
- [ ] Visual hierarchy: title → subtitle → content → action
