# Design System — Insta Connect Mobile

Source of truth: `mobile/src/theme/colors.ts` and `mobile/src/theme/spacing.ts`.

## Colors

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#F8FAFC` | Screen background (`Screen`) |
| `surface` | `#FFFFFF` | Cards, inputs, headers, tab bar |
| `text` | `#0F172A` | Primary text, titles |
| `textSecondary` | `#64748B` | Subtitles, placeholders, inactive icons |
| `border` | `#E2E8F0` | Card borders, input borders, dividers |
| `primary` | `#059669` | Primary actions, active tab, spinners |
| `primaryDark` | `#047857` | Secondary button text, icon accents |
| `primaryLight` | `#D1FAE5` | Secondary button bg, success badges, icon buttons |
| `error` | `#E11D48` | Error text, danger button, input error border |
| `errorLight` | `#FFE4E6` | Error banners, error badges |
| `warning` | `#D97706` | Warning badge text |
| `warningLight` | `#FEF3C7` | Warning badge background |
| `slate200` | `#E2E8F0` | Segmented control track, avatar placeholder |
| `slate700` | `#334155` | Input labels, avatar initials |
| `slate800` | `#1E293B` | Reserved for emphasis |
| `navBar` | `#000000` | Android navigation bar |

Import: `import { colors } from "@/src/theme/colors"`

## Spacing

| Token | px | Typical use |
|-------|----|-------------|
| `xs` | 4 | Tight gaps, badge margins |
| `sm` | 8 | Small gaps, padding increments |
| `md` | 16 | Screen padding, card padding, form gaps |
| `lg` | 24 | Section separation, overlay padding |
| `xl` | 32 | Extra bottom scroll padding, auth top spacing |

Import: `import { spacing } from "@/src/theme/spacing"`

## Border radius

| Token | px | Typical use |
|-------|----|-------------|
| `sm` | 8 | Badges, segmented segments |
| `md` | 12 | Buttons, inputs, error boxes |
| `lg` | 16 | Cards, loading overlay |
| `full` | 999 | Pills (rare) |

Import: `import { radius } from "@/src/theme/spacing"`

## Typography scale

No dedicated typography file — follow existing screen conventions:

| Role | fontSize | fontWeight | color |
|------|----------|------------|-------|
| Hero title (auth) | 28 | 800 | `text` |
| Screen title (header) | 24 | 700 | `text` |
| Section title | 18–20 | 700 | `text` |
| Card title / list item | 16 | 700 | `text` |
| Body | 14–15 | 400–500 | `text` or `textSecondary` |
| Label (input) | 14 | 500 | `slate700` |
| Caption / badge | 12–13 | 500–600 | context-dependent |
| Button | 16 | 600 | variant-dependent |

Line heights: 20–22 for body and subtitle text.

## Elevation and shadows

Cards use a subtle shadow:

```
shadowColor: "#0F172A"
shadowOffset: { width: 0, height: 2 }
shadowOpacity: 0.06
shadowRadius: 8
elevation: 2
```

Segmented control active segment uses lighter shadow (`shadowOpacity: 0.08`).

## Tab bar (app shell)

Defined in `mobile/app/(app)/_layout.tsx`:

- Active tint: `colors.primary`
- Inactive tint: `colors.textSecondary`
- Background: `colors.surface`
- Label: 12px, weight 600
- Content height: 48px + safe area bottom inset

## Overlay backdrop

`LoadingOverlay` uses `rgba(15, 23, 42, 0.45)` — derived from `text` color at 45% opacity.
