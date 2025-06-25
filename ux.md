# AIKP — UX & Design Guidelines

> This document defines the **look-and-feel contract** for every user-facing screen in AIKP. Treat it as the _single source of truth_ for product & engineering when making layout, styling or motion decisions.

---

## 1. Navigation Philosophy — **Dense, Linear-Inspired Design**

1. AIKP adopts a **dense, efficient navigation model** inspired by Linear.app's design principles:
   • Navigation items are **compact** with minimal padding (`py-1.5 px-3` max)
   • **No descriptive text** in primary navigation - rely on clear labels and icons only
   • Support **4–5 top-level destinations** maximum with clean visual hierarchy
2. On desktop screens (>1024 px)
   • Sidebar navigation is **dense** with items tightly spaced (`space-y-1`)
   • Text size standardized to `text-sm` for navigation items
   • **Single-line items only** - no multi-line descriptions in nav
3. Organization switcher is **minimal** - avatar + name only, no extra descriptive text
4. When deeper navigation stacks are required (e.g. `/projects/[id]`) we surface a **contextual header** _inside the page_ instead of relying on a global top bar.

---

## 2. Component System — **100 % Shadcn UI + Dense Variants**

1. All UI primitives are sourced from **[shadcn/ui](https://ui.shadcn.com)**. Where a needed component doesn't exist, scaffold it via the shadcn CLI so that it inherits the same tokens, variants & accessibility patterns.
2. Do **not** import external component libraries (_Radix, Headless UI, MUI, …_) directly. Wrap / adapt via shadcn if absolutely necessary.
3. **Dense styling rules**
   • Navigation: `py-1.5 px-3` max, `text-sm`, `space-y-1` between items
   • Forms: Prefer `h-9` inputs over `h-11` for density
   • Buttons: Use `size="sm"` variant as default (`h-9`)
   • Cards: Reduce padding to `p-4` instead of `p-6`
   • Compose variants with `class-variance-authority`.  
   • Merge class names via `tailwind-merge` to avoid duplicates.  
   • **Never hard-code hex values**; colours must reference **Tailwind theme tokens** only (see §3).

---

## 3. Colour System — **Tailwind Theme Tokens Only**

1. Use the palette exported by the shadcn Tailwind config (e.g. `primary`, `secondary`, `muted`, `destructive`).
2. Semantic mapping:
   • Success → `primary`
   • Warning → `yellow`
   • Error → `destructive`
3. Support dark mode automatically using `data-theme="dark"`  
   • Don't maintain separate colour files; rely on Tailwind's `dark:` variant.

---

## 4. Layout, Spacing & Sizing — **Dense by Default**

1. Base unit: **4 px grid** — prefer **4 px multiples** for dense layouts (`space-y-1`, `gap-1`, `space-y-2`, `gap-2`).
2. Forms & Cards follow dense patterns:  
   • Form container max-width `max-w-sm`.  
   • Spacing `space-y-4` between controls (reduced from `space-y-6`).  
   • Inputs height `h-9`, Buttons `h-9`.
   • Card padding `p-4` (reduced from `p-6`)
3. Surfaces use **glass-morphism**: `bg-white/80 dark:bg-slate-900/80` + `backdrop-blur-sm`.
4. **Navigation density**:
   • Items: `py-1.5 px-3` max
   • Spacing: `space-y-1` between nav items
   • Text: `text-sm` for all navigation text
   • Icons: `size-4` (16px) for nav icons

---

## 5. Typography — **Consistent & Dense**

1. Font scale (Tailwind defaults): `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`.
2. **Navigation text** → `text-sm`; **Body text** → `text-sm` (reduced from `text-base`); **Muted copy** → `text-xs text-slate-600 dark:text-slate-400`.
3. `font-medium` for navigation items, `font-semibold` for card titles.
4. **Dense typography rules**:
   • Primary content: `text-sm` as default
   • Secondary content: `text-xs`  
   • Headers: `text-base` or `text-lg` max
   • Avoid `text-base` for dense interfaces

---

## 6. Motion & Micro-Interactions — **Linear-Inspired**

1. **Speed matters** — Keep animation durations between **120 ms – 200 ms**; use `ease-[cubic-bezier(0.16,1,0.3,1)]`.
2. **Enter / Exit**  
   • Fade & slide 2 px (`translate-y-0.5`) for menus & dialogs (reduced movement).  
   • Tab switches animate underline position (`transition-[left]`).
3. **Progress feedback**  
   • Operations <400 ms → no spinner.  
   • >400 ms → show a top-edge **Linear-style progress bar** (`h-0.5`, `animate-[progress]`).
4. **Tactile interactions**  
   • Buttons use subtle active state (`scale-[0.98]`).  
   • List-item hover: subtle background tint `bg-muted/30` (reduced opacity).

---

## 7. Accessibility Checklist

1. All components pass **WCAG 2.1 AA** contrast.
2. Use **aria-labels** on icon-only buttons.
3. Ensure **tab-order** mirrors visual order; navigation items are `tabindex="0"` by default.
4. **Dense design considerations**: Ensure touch targets remain minimum 44px on mobile despite dense desktop design.

---

## 8. Design Tokens Reference

```ts
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground", // Added for nav items
      },
      size: {
        default: "h-9 px-4 py-2", // Reduced from h-11
        sm: "h-8 rounded-md px-3", // Reduced from h-9
        lg: "h-10 rounded-md px-8", // Reduced from h-11
        icon: "h-9 w-9", // Reduced from h-10 w-10
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Navigation-specific variant for dense sidebar
export const navItemVariants = cva(
  "flex items-center gap-2 rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        active: "bg-accent text-accent-foreground",
      },
      size: {
        default: "py-1.5 px-3", // Dense padding
        compact: "py-1 px-2", // Ultra-dense for secondary nav
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

---

## 9. Dense Navigation Patterns

### Sidebar Navigation

- **Item height**: `py-1.5` (24px total height)
- **Icon size**: `size-4` (16px)
- **Text size**: `text-sm`
- **Spacing**: `space-y-1` between items
- **Padding**: `px-3` horizontal, `py-1.5` vertical
- **No descriptions**: Icons + labels only

### Organization Switcher

- **Avatar size**: `size-6` (24px)
- **Text**: Single line, `text-sm`, truncated if needed
- **Padding**: `p-2` inside dropdown items
- **No extra metadata**: Name only, no descriptions

The snippet above is canonical for creating new dense, navigation-focused components that match Linear's efficient design language.

_Any proposal diverging from these guidelines requires approval from the **Design Lead**._
