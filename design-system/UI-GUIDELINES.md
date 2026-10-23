# UI Guidelines — Web App

## Navigation and information architecture
- Top bar only, no sidebar: the app is a single-page product today and a sidebar would be empty chrome.
- Top bar order: brand "Web App" (links home), then main navigation. The only destination today is **Home** (`data-nav-key="home"`); add new sections to the end of that nav so existing positions stay stable.
- No account, wishlist or cart links: the app has no such features; add them to the right of the nav only when a feature ships.
- On narrow screens the nav collapses behind a "Menu" button, so the brand and page title never wrap.

## Layout and density
- Spacious, single-column content, centred at `size-shell-max`: the current app is a centred page title, not a data console.
- Separate page sections with `space-4` and related items with `space-2`/`space-3` (`.stack`, `.cluster`): consistent rhythm without per-screen CSS.
- Design mobile-first; the layout changes at tablet width (768px), where the nav expands inline, because that is where the top bar fits without wrapping.

## Component usage
- One `.btn-primary` per view for the main action; `.btn-secondary` for alternatives, `.btn-ghost` for low-emphasis actions, `.btn-danger` only for destructive confirms: a single clear next step.
- Use `.card` for self-contained, scannable groups in a `.grid`; a `<table>` only for comparing many records across columns; a plain list for short ordered items: each matches how people scan.
- Wrap every form control in `.field` with a visible label; show errors with `.is-invalid` plus `.field-error` text: colour alone is never the error signal.
- Use `.alert` for messages that stay on the page, `.toast` for transient confirmations, `.modal` only for decisions that block progress, `.drawer` for secondary detail or filters: the least interruptive surface wins.
- Show `.skeleton` for content that is loading and `.empty-state` (with one primary action) when there is nothing to show: users get an explanation, not a blank area.
- Use `.badge` for read-only status and `.chip` for user-toggled filters: it separates state from controls.

## Theme
- Light only, white surfaces (`color-bg`) with `color-fg` text: it matches the shipped app, and a dark theme would be a separate, deliberate effort.
- Colour carries meaning: `color-primary` for action and focus, `color-danger` for destruction and errors, never decoration.

## Voice and tone
- Plain, friendly and brief; sentence case everywhere: the product is small and approachable.
- Buttons are verb-first ("Save changes", "Delete project"): the label says what happens.
- Errors say what went wrong and how to fix it, without blame ("Enter an email like name@example.com"): users recover faster.
- Empty states explain the benefit and invite one action: they are the first impression of a feature.
