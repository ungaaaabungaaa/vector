---
name: vector-design
description: Vector's dense UI and UX skill. Use when building or editing Vector pages, dialogs, selectors, tables, list rows, inline actions, or micro-interactions. Covers the project's actual dense layout patterns, optimistic selector updates, permission-aware inline editing, and shadcn composition choices.
---

# Vector Design

Use this skill for UI work inside this repository. It is not a generic shadcn or Tailwind style guide. It describes the interaction model and density targets that Vector already uses.

If you need low-level primitive rules or CLI usage for shadcn itself, also read the local `shadcn` skill. This skill is for product-facing composition and UX patterns specific to Vector.

## What Vector UI Is Trying To Be

Vector optimizes for speed, scanability, and staying in context:

- Dense, but not cramped
- Inline, not modal, for property edits
- Fast feedback, not spinner-heavy feedback
- Keyboard-friendly searchable pickers
- Role-aware editing without forking the layout
- Small controls with strong information hierarchy

The closest mental model is not "dashboard cards everywhere". It is "operational workspace where the row, detail header, or creation dialog is the editing surface".

## Start From Existing Product Surfaces

Before building a new UI, open the closest existing surface and copy its structure instead of inventing a new pattern.

Primary references:

- `src/components/issues/issue-selectors.tsx`
- `src/components/issues/create-issue-dialog.tsx`
- `src/components/issues/issues-table.tsx`
- `src/components/projects/create-project-dialog.tsx`
- `src/components/projects/project-selectors.tsx`
- `src/components/projects/project-lead-selector.tsx`
- `src/components/teams/create-team-dialog.tsx`
- `src/components/teams/team-selector.tsx`
- `src/components/ui/visibility-selector.tsx`
- `src/components/ui/permission-aware.tsx`
- `src/components/organization/members-list.tsx`
- `src/components/projects/project-members.tsx`
- `src/components/organization/role-selector.tsx`
- `src/components/organization/custom-roles-manager.tsx`

Read extra references only when needed:

- Dialog anatomy: [references/dialogs.md](./references/dialogs.md)
- Dense rows and inline actions: [references/lists-and-micro-interactions.md](./references/lists-and-micro-interactions.md)
- Optimistic selector behavior: [optimistic.md](./optimistic.md)
- Scalable popover selectors: [references/scalable-selectors.md](./references/scalable-selectors.md)

## Non-Negotiable Patterns

### 1. Keep property edits inline

For status, priority, team, project, assignee, lead, role, or visibility changes:

- Use `Popover + Command` selectors
- Mutate from the current surface
- Do not send users to a separate edit page
- Do not add a dedicated modal for a single-field edit

Destructive or secondary actions belong in a `DropdownMenu`, not in the primary inline selector.

### 2. Respect the density rhythm

The common sizes are deliberate:

- Row actions: `h-6 w-6 p-0`
- Dense buttons/selectors: `h-8 gap-2`
- Search input inside popovers: `h-9`
- Row avatars: `size-6`
- Trigger avatars: `size-5`

### User Avatars

Always use the `UserAvatar` component (`@/components/user-avatar`) for displaying user avatars — never raw `Avatar` + `AvatarFallback` with initials. `UserAvatar` shows the user's profile image when available and falls back to a deterministic Avvvatars shape (the same pattern used in the sidebar footer). Pass `name`, `email`, `image`, and optionally `userId` and `size` (`'sm'` | `'default'` | `'lg'`).

```tsx
<UserAvatar
  name={user.name}
  email={user.email}
  image={user.image}
  userId={user._id}
  size='sm'
/>
```

- Section labels and metadata: `text-xs` or `text-sm`

Common spacing:

- `gap-1` for tight control clusters
- `gap-2` for most dense layouts
- `px-3 py-2` for issue/member/project-style rows
- `p-2` for dense dialog content

Do not loosen these defaults unless the screen clearly has a different job.

### 3. Use icon semantics consistently

- Unset selectors often show icon-only triggers
- Selected values usually show icon + label
- Object keys and secondary metadata use muted or monospace styling
- Default neutral icon color is `#94a3b8`

Use `DynamicIcon` for trigger/rendered components that would otherwise create icons during render. Use `getDynamicIcon()` inside mapped menu items.

### 4. Permission should change interaction, not layout

Use `PermissionAware` or related helpers around inline controls. The layout should stay stable; the control simply becomes view-only and explains why.

Do not create completely different markup for editable vs read-only states when the existing pattern can stay in place.

### 5. Prefer immediate visual confirmation over explicit success chrome

For inline micro-edits:

- optimistic display update first
- close the popover
- let Convex reactivity settle the real value

Do not add success toasts for routine field changes. The changed value is the confirmation.

### 6. Default loader choices are explicit

Use the loading primitive that matches the job:

- content or layout is still loading: use `Skeleton` components shaped like the final UI
- indeterminate action/loading indicator with no meaningful placeholder shape: use `BarsSpinner` from `src/components/bars-spinner.tsx`

Do not introduce a different spinner component unless the existing `BarsSpinner` is clearly the wrong fit.

### 7. Use `GradientWaveText` for small centered explanatory callouts

When a surface has a short centered line of supporting copy that explains a notable capability, hint, or "cool" behavior, prefer `GradientWaveText` from `src/components/gradient-wave-text.tsx`.

Use it sparingly:

- small supporting text, usually `text-xs` or `text-sm`
- centered placements where the text can stand on its own
- brief explanatory copy that benefits from a little extra attention

Do not use it for primary headings, dense row metadata, long paragraphs, or routine helper text.

## When To Use Which Pattern

### New inline field picker

Copy an existing selector and keep these pieces aligned:

- `Popover`
- `CommandInput`
- `CommandList`
- `CommandGroup`
- checkmark visibility based on the optimistic display value
- `displayMode` support if the trigger needs to collapse to icon-only

Read [optimistic.md](./optimistic.md) before implementing it.

### Dynamic list inside a popover or combobox

Treat any selector backed by issue/member/project/team/document data as potentially unbounded.

The default pattern is:

- show at most 5 recent related results before the user types
- switch to server-backed search once the user types
- keep the rendered list capped at 5 results
- do not ship a selector that downloads and renders the full org list into `Command`

Use [references/scalable-selectors.md](./references/scalable-selectors.md) when the backing dataset can grow.

### New creation flow

Start from the issue, project, or team creation dialogs.

Read [references/dialogs.md](./references/dialogs.md).

### New list row or management list

Start from the issues table, members list, or project members list.

Read [references/lists-and-micro-interactions.md](./references/lists-and-micro-interactions.md).

## Visual Rules That Matter More Than They Look

- Titles or primary content areas almost always use `min-w-0 flex-1`
- Fixed controls on a row should use `flex-shrink-0`
- Muted explanatory text should stay `text-muted-foreground`
- If a card or row already has an identity anchor like an avatar/name, attach any assignee-specific state callout directly to that anchor instead of rendering a second avatar/name elsewhere on the same surface
- Dense forms often use overlay field labels instead of stacked labels
- Detail pages often use a sticky top editing bar with compact selector clusters and subtle vertical dividers
- Empty states are used sparingly; operational screens should bias toward tables and direct controls
- Motion should be short and structural: `layout`, small Y offsets, `duration: 0.2`
- Centered supporting copy that highlights a notable capability can use `GradientWaveText`, but keep it short and secondary

### Detail page layout width rules

Entity detail pages (projects, teams, issues) use a constrained `max-w-5xl mx-auto` for the header area (title, description, property bar). When a tabbed section follows (Issues, Activity, Members, etc.):

- The **tab header row** (TabsList) and **tab controls row** (search, view toggles, create buttons) must share the same `max-w-5xl mx-auto` constraint as the section above them.
- The **tab content** (kanban boards, tables, activity feeds) should remain full-width so horizontally scrollable content like kanban columns can use the available space.

### Dark mode for TipTap / prose content

- Always add `dark:prose-invert` alongside `prose` to ensure typography colors adapt to dark mode.
- Disabled/read-only `RichEditor` instances must use `bg-transparent dark:bg-transparent` to avoid a visible muted background strip. The description should blend seamlessly into the page background.

## Anti-Patterns

- Do not wrap dense operational content in unnecessary Cards
- Do not introduce large paddings or wide gutters by default
- Do not replace inline pickers with native `<select>` or bulky form sections
- Do not duplicate identity chrome on the same card or row just to add more metadata; extend the existing avatar/name cluster instead
- Do not use success toasts for normal inline property changes
- Do not create separate edit screens for row-level metadata
- Do not use loading text where a skeleton or existing value can carry the transition
- Do not add ad hoc spinners when `src/components/bars-spinner.tsx` already fits the need
- Do not use `GradientWaveText` as a decorative replacement for ordinary labels or body copy
- Do not create a brand-new row layout if an issues/member/project row already solves it

## Ship Checklist

Before considering a Vector UI change done, check:

- Does it look like it belongs next to the issue table, creation dialogs, and settings/member lists?
- Are the controls dense enough to match existing screens?
- Are frequent edits inline?
- Is permission handling preserving the same layout?
- Does the trigger and menu use the same icon, label, and checkmark semantics as existing selectors?
- If this mutates one field, does it use the optimistic selector pattern?
- If this is a row or list, does it animate add/remove/reorder with the same brief motion language?
