# Product UI Brand System

This guide captures the reusable visual language of the PT GAS HR System for use in another internal application. Replace `[Product Name]`, the logo, and product-specific navigation labels; preserve the foundations and interaction rules below so the new system feels like part of the same family.

## Brand character

The interface is a **minimal editorial operations system**: calm, precise, compact, and easy to scan during repetitive daily work.

- **Calm:** neutral surfaces carry most of the interface; color appears only where it communicates action or state.
- **Precise:** typography, alignment, and tabular numbers make operational data easy to compare.
- **Compact:** controls and tables favor useful density without reducing touch accessibility.
- **Responsive:** desktop supports fast navigation and dense workflows; mobile simplifies the same workflow rather than inventing a separate experience.
- **Trustworthy:** destructive actions, system status, loading, and errors are always explicit.

Avoid decorative gradients, glass effects, oversized rounding, excessive shadows, and multiple competing accent colors in authenticated application screens. A richer photographic treatment is reserved for the desktop sign-in experience.

## Logo and naming

Use the product logo as a compact square mark with the product name beside it when space permits.

- Preferred mark container: `32 × 32px`, `6px` radius.
- Mobile header mark: `28 × 28px`.
- Sign-in mark: `44 × 44px`, `8px` radius, subtle shadow.
- Use the full product name in page metadata and authentication screens.
- Use a short product name in the sidebar and mobile header.
- Never stretch, recolor, outline, or place the logo on a visually noisy surface without sufficient contrast.

## Color system

Color names are semantic. Components consume roles such as `background`, `card`, and `primary`, not raw color names.

### Core tokens

| Role | Light | Dark | Usage |
|---|---:|---:|---|
| Background | `#fafafa` | `#09090b` | Page canvas |
| Foreground | `#18181b` | `#fafafa` | Primary text |
| Card | `#ffffff` | `#0f0f12` | Panels, cards, sidebar |
| Muted surface | `#f4f4f5` | `#18181b` | Secondary areas, row hover, quiet controls |
| Muted text | `#71717a` | `#a1a1aa` | Supporting copy and metadata |
| Border | `#e4e4e7` | `#27272a` | Dividers, fields, panel edges |
| Strong border | `#d4d4d8` | `#3f3f46` | Emphasized boundaries |
| Primary | `#3b82f6` | `#60a5fa` | Main actions, active navigation, focus |
| On primary | `#ffffff` | `#09090b` | Text and icons on primary |

The dark theme is a true near-black theme, not a gray inversion. Dark mode is the default for the current application, but a new system may remember the user's most recent choice.

### Status colors

| State | Color | Usage |
|---|---:|---|
| Success | `#22c55e` | Completed, connected, present, healthy |
| Warning | `#f59e0b` | Pending review, attention required |
| Error / destructive | `#ef4444` | Failed, absent, delete, blocking issue |
| Information | `#5b8df8` | Neutral system information |

Use status colors with a lightly tinted background—typically `6–12%` opacity—and full-color text or icons. Never communicate a state through color alone; pair it with a label, icon, or both.

### Optional category colors

Category colors may distinguish stable groups in charts, avatars, or compact labels. They are not brand colors and must not replace semantic status colors.

Recommended palette: blue `#3b82f6`, violet `#8b5cf6`, amber `#f59e0b`, red `#ef4444`, emerald `#10b981`, indigo `#6366f1`, and slate `#64748b` as fallback.

## Typography

Use **Geist Sans** for the interface and **Geist Mono** only for technical identifiers or code. The system fallback is `system-ui, sans-serif`.

Enable antialiasing, optimized legibility, and the OpenType features `cv01`, `cv03`, `cv04`, and `ss01` where supported.

| Role | Size | Weight | Notes |
|---|---:|---:|---|
| Display / sign-in headline | `40–64px` | 600 | Tight tracking; reserved for authentication or public display |
| Page title | `24–30px` | 700 | Tight tracking |
| Section title | `15–16px` | 600–700 | Short and direct |
| Body | `14–16px` | 400–500 | Use comfortable line height for prose |
| Control / table text | `12–14px` | 500–600 | Optimize for scanning |
| Metadata | `11–12px` | 400–500 | Muted color |
| Eyebrow | `11–12px` | 600–700 | Uppercase with increased tracking |

Use sentence case for headings, actions, labels, and navigation. Reserve uppercase for short eyebrows, role labels, and compact metadata. Use `font-variant-numeric: tabular-nums` for counts, percentages, times, IDs, and comparable metrics.

## Spacing and layout

Use a `4px` base spacing rhythm. Prefer the sequence `4, 8, 12, 16, 20, 24, 32px`.

- Page padding: `16px` mobile, `24px` tablet, `32px` desktop.
- Main content maximum width: `1480px`, centered.
- Standard section gap: `20px`.
- Card padding: `16–20px`.
- Dense row padding: `12–16px` vertically and `16–20px` horizontally.
- Form field gap: `8px` between label and control; `20px` between fields.
- Use responsive grids that collapse to one column before content becomes cramped.

Authenticated pages use a fixed navigation rail: `64px` collapsed and `240px` expanded. On mobile, replace it with a `56px` top bar and an off-canvas menu. Do not permanently consume mobile width with the rail.

## Shape and elevation

The interface uses restrained rounding and elevation.

| Token | Value | Usage |
|---|---:|---|
| Radius small | `6px` | Chips, badges, compact controls |
| Radius medium | `8px` | Inputs and buttons |
| Radius large | `10px` | Cards and panels |
| Radius extra large | `12px` | Large cards and dialogs |

Use a `1px` semantic border as the primary method of separating surfaces. Shadows should clarify stacking, not decorate every card.

```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.10);
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.14);
```

Cards normally use only a border and `shadow-xs`. Use stronger shadows for floating navigation, dialogs, drawers, and toasts.

## Iconography

Use **Lucide** outline icons.

- Standard control icon: `14–16px`.
- KPI or feature icon: `18–22px`.
- Authentication feature icon: up to `26px`.
- Use a consistent stroke weight and never mix filled and outline icon families.
- Pair unfamiliar icons with text. Icon-only controls require an accessible name and tooltip where the meaning is not obvious.

## Component rules

### Buttons

- Default control height: `32px`; small `28px`; large `36px`.
- Authentication primary action may use `56px` for emphasis and touch comfort.
- Primary: solid blue, high-contrast label.
- Outline: page background with semantic border.
- Ghost: transparent until hover.
- Destructive: red text on a faint red surface; reserve solid red for exceptional confirmation steps.
- Link: blue text with underline on hover.
- Disable repeated submission while a request is pending and show a spinner or progress label.

Buttons use subtle feedback: approximately `150ms` color/opacity transitions and a small active scale or one-pixel press. Do not combine large movement, glow, and scale on the same control.

### Inputs and selectors

- Standard height: `32px`; large sign-in fields: `56px`.
- Use an `8px` radius, semantic border, and quiet background.
- Placeholder text uses muted color.
- Focus uses the primary border plus a `3px` translucent ring.
- Invalid fields use destructive border and ring and include a nearby error message.
- Labels remain visible; placeholders are examples or hints, not label replacements.

Prefer native controls where they provide the required behavior. Use custom dialogs, popovers, or comboboxes only when native controls cannot support the workflow.

### Cards and panels

- Use white/near-black card surfaces with a `1px` border.
- Titles and primary values lead; metadata remains quiet.
- Keep card headers compact and align actions to the upper right.
- Use tinted icon containers to identify KPI type without flooding the card with color.
- Hover lift is optional and only for clickable cards: up to `2px` translation with `shadow-md`.

### Tables and data lists

- Keep headers concise and align numeric data consistently.
- Use tabular numbers for metrics and timestamps.
- Separate rows with borders or a subtle alternate surface—not both unless density requires it.
- Row hover uses the muted surface.
- Put the primary identifier first, supporting metadata below or beside it, and actions last.
- On narrow screens, convert rows into stacked summaries rather than forcing horizontal compression.

### Navigation

- Active items use primary text, a faint primary background, and a `2px` leading indicator.
- Inactive items use muted text; hover raises them to foreground text on a muted surface.
- Keep global actions such as search, theme, language, identity, and logout in predictable fixed locations.
- Navigation visibility may reflect permissions, but authorization must still be enforced by the server.

### Badges and status

Badges are compact, rounded, and single-line. Use them for states, counts, roles, or short categories—not full sentences. A badge should not become the only explanation for a complex state.

### Dialogs, drawers, and toasts

- Dialogs use a centered `12px`-radius panel, subtle backdrop blur, and a visible title.
- Use drawers for longer secondary workflows that benefit from preserving page context.
- Confirmation dialogs name the action and consequence; destructive confirmation is explicit.
- Toasts appear at the bottom right on desktop, stack to a maximum of five, include an icon and text, and dismiss automatically unless user action is required.
- On mobile, keep overlays within `16px` of the viewport edges and ensure actions remain reachable.

### Loading, empty, and error states

- Match skeleton geometry to the content being loaded.
- Use a restrained `1.5s` shimmer.
- Empty states explain what is absent and, when useful, provide one clear next action.
- Errors state what failed and how to recover. Preserve entered form data after recoverable errors.
- Live or syncing indicators combine a label with a subtle pulse; animation is supplementary, not the only signal.

## Motion

Motion supports orientation and feedback.

- Micro-interactions: `100–180ms` ease.
- Page and overlay entrance: `280–300ms` using `cubic-bezier(0.22, 1, 0.36, 1)`.
- Page entrance: fade in while moving upward `8px`.
- Drawer entrance: slide from the relevant edge.
- Avoid looping animation except for loading and live status.
- Honor `prefers-reduced-motion` by reducing animation and transition durations to effectively zero.

## Authentication treatment

The sign-in page may be more expressive than the application shell.

- Use a two-column desktop layout: focused form on a calm card surface, brand story or product preview on the other side.
- The visual panel may use a relevant product screenshot or photograph with a dark navy-to-blue overlay.
- Keep the form column available on all screen sizes; hide the visual panel below the desktop breakpoint.
- Maintain the same tokens, typography, controls, theme switch, and language switch used inside the application.

Do not carry the sign-in page's large headline, photographic background, or strong gradient into routine operational pages.

## Voice and content

The product voice is direct, calm, and action-oriented.

- Name pages and actions with familiar domain terms.
- Button labels describe the action: “Save shift”, “Approve request”, “Export report”.
- Status copy describes the current condition, not internal implementation details.
- Error messages explain the problem and the next step without blame.
- Confirmation copy names irreversible consequences.
- Dates, times, numbers, and language follow the user's locale; do not mix formats within a view.

Support bilingual interfaces by keeping labels concise and allowing layouts to expand. Never encode meaning in a fixed text width that only fits one language.

## Accessibility baseline

- Meet WCAG AA contrast for text and essential UI states.
- Keep keyboard focus visible with a `2px` primary outline or equivalent `3px` focus ring.
- Preserve logical heading order and native document landmarks.
- All controls must be operable by keyboard.
- Icon-only buttons require accessible names.
- Form errors must be associated with their fields.
- Use at least `44 × 44px` touch targets on coarse-pointer devices, even when the visual control is smaller.
- Do not rely on hover, motion, or color as the only way to reveal information.

## Responsive behavior

- Design mobile-first, then add density at `sm`, `md`, `lg`, and `xl` breakpoints.
- Collapse multi-column dashboards to a single reading order on mobile.
- Keep the most important information and primary action visible first.
- Allow filters and secondary actions to wrap or move into a compact menu.
- Avoid horizontal page scrolling. Data tables may use a deliberate local scroller only when a stacked representation would lose essential comparison.

## Implementation starter

Use these semantic variables as the portable source of truth:

```css
:root {
  --background: #fafafa;
  --foreground: #18181b;
  --card: #ffffff;
  --card-foreground: #18181b;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --border: #e4e4e7;
  --input: #e4e4e7;
  --primary: #3b82f6;
  --primary-foreground: #ffffff;
  --ring: #3b82f6;
  --success: #22c55e;
  --warning: #f59e0b;
  --destructive: #ef4444;
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.625rem;
  --radius-xl: 0.75rem;
}

[data-theme="dark"] {
  --background: #09090b;
  --foreground: #fafafa;
  --card: #0f0f12;
  --card-foreground: #fafafa;
  --muted: #18181b;
  --muted-foreground: #a1a1aa;
  --border: #27272a;
  --input: #27272a;
  --primary: #60a5fa;
  --primary-foreground: #09090b;
  --ring: #60a5fa;
}
```

Prefer one shared token source, reusable primitives, and native platform behavior. Do not copy page-specific inline colors into the new system when a semantic token already expresses the same role.

## Quality checklist

Before shipping a new screen, confirm:

- It uses semantic tokens in both light and dark themes.
- Page padding, content width, and card spacing follow the shared rhythm.
- There is one visually dominant primary action.
- Loading, empty, error, success, and disabled states are covered where applicable.
- Keyboard focus and accessible names are present.
- Mobile layout works without page-level horizontal scrolling.
- Motion respects reduced-motion settings.
- Numbers, dates, and status colors are consistent with the rest of the system.
- Product-specific colors are used as categories, not as competing brand accents.
