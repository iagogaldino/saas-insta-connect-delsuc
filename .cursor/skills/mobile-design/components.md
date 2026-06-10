# UI Components — Insta Connect Mobile

All components live in `mobile/src/components/ui/`. Import via `@/src/components/ui/<Name>`.

## Screen

**File**: `Screen.tsx`

Base layout wrapper with `SafeAreaView`, optional scroll, and consistent padding.

```tsx
<Screen header={<ScreenHeader title="Título" />} scroll>
  {children}
</Screen>
```

| Prop | Default | When to use |
|------|---------|-------------|
| `scroll` | `true` | Most screens; set `false` for fixed full-height panels |
| `header` | — | Pass `ScreenHeader` for in-app screens |
| `style` | — | Extra padding or `paddingTop` (auth screens use `spacing.xl`) |

## ScreenHeader

**File**: `ScreenHeader.tsx`

White header bar with bottom border. Used inside `Screen` `header` prop.

| Prop | Usage |
|------|-------|
| `title` | Main heading (24px bold) |
| `subtitle` | Secondary line below title |
| `onBack` | Shows back arrow; pair with `router.back()` |
| `backLabel` | Optional text next to back arrow |
| `right` | Action slot (icon buttons, etc.) |

Icon action button pattern (from sessions screen):

```tsx
<Pressable style={styles.addButton} onPress={handleAction}>
  <Plus size={22} color={colors.primaryDark} />
</Pressable>
// addButton: 44×44, radius 12, border primary, bg primaryLight
```

## Button

**File**: `Button.tsx`

| Variant | Background | Text | Use case |
|---------|------------|------|----------|
| `primary` | `primary` | white | Main CTA |
| `secondary` | `primaryLight` + border | `primaryDark` | Secondary actions |
| `danger` | `error` | white | Destructive actions |
| `ghost` | transparent | `textSecondary` | Tertiary / cancel |

Props: `title`, `onPress`, `disabled`, `loading`, `variant`, `style`.

Always use `loading` during async submit — do not disable without visual feedback.

## Input

**File**: `Input.tsx`

Labeled text field with optional password toggle (`Eye`/`EyeOff` icons).

| Prop | Usage |
|------|-------|
| `label` | Field label above input |
| `error` | Inline error message + red border |
| `secureTextEntry` | Enables password visibility toggle |

Pass standard `TextInputProps` (`keyboardType`, `autoComplete`, `editable`, etc.).

## Card

**File**: `Card.tsx`

White surface with border, radius `lg`, subtle shadow. Use for:

- List items (wrap in `Pressable` for navigation)
- Empty states (centered content + CTA)
- Grouped form sections

Override padding via `style` prop when needed (e.g. `paddingVertical: spacing.sm + 4`).

## StatusBadge

**File**: `StatusBadge.tsx`

Pill badge for status labels.

| Variant | Background | Text | Use case |
|---------|------------|------|----------|
| `success` | `primaryLight` | `primaryDark` | Connected, active |
| `warning` | `warningLight` | `warning` | Needs attention, reconnect |
| `error` | `errorLight` | `error` | Failed, error state |
| `neutral` | `slate200` | `slate700` | Default / unknown |

## SegmentedControl

**File**: `SegmentedControl.tsx`

Generic toggle between 2+ modes (login/register pattern).

```tsx
<SegmentedControl
  options={[{ id: "a", label: "Opção A" }, { id: "b", label: "Opção B" }]}
  value={mode}
  onChange={setMode}
/>
```

## Avatar

**File**: `Avatar.tsx`

Circular image with fallback initials. Props: `uri`, `username`, `size` (default 48).

## LoadingOverlay

**File**: `LoadingOverlay.tsx`

Modal blocking overlay. Props: `visible`, `message` (default `"Carregando..."`).

Use for operations that block the entire screen — not for button-level loading.

## QuantityStepper

**File**: `QuantityStepper.tsx`

Increment/decrement control for numeric values. Use in configuration panels.

## Session panels

Feature-specific panels in `mobile/src/components/session/`:

- `SessionManagePanel` — session connection management
- `SessionAutoFollowPanel` — AutoFollow configuration

Reuse these patterns when building similar configuration UIs.

## Icons

Use `lucide-react-native` exclusively. Common icons in the app:

| Icon | Context |
|------|---------|
| `Plus` | Create / add actions |
| `ChevronRight` | List drill-down |
| `ArrowLeft` | Back navigation (in ScreenHeader) |
| `Layers` | Sessions tab |
| `UserCircle` | Account tab |
| `Eye` / `EyeOff` | Password visibility |
