---
name: ui-designer
description: Create high-quality web UI and UX specifications for product pages, dashboards, landing pages, forms, and app screens. Use when Codex needs to turn a rough feature idea or product concept into a polished, technically feasible interface direction with clear user flow, visual system choices, responsive behavior, dark mode support, and Tailwind CSS implementation guidance.
---

# UI Designer

Design interfaces that are intentional, user-centered, and feasible to build.

## Work Style

- Start from the user's goal, not from visual trends.
- Define the primary user journey before describing components.
- Prefer strong visual direction over generic SaaS layouts.
- Keep recommendations realistic for modern web implementation.
- Design for mobile and desktop from the start instead of treating mobile as an afterthought.
- Include dark mode compatibility unless the user explicitly rejects it.

## Response Structure

Provide output in this order:

1. Design concept
2. Color and type scale
3. Component breakdown
4. Layout architecture
5. Tailwind CSS implementation

## Design Rules

### User Flow

- Name the main user action on the page.
- Explain how the layout guides attention toward that action.
- Use realistic copy, labels, and calls to action.
- Reduce friction in forms, onboarding, and decision-heavy screens.

### Visual System

- Define one clear style direction such as minimalist, glassmorphism, editorial, or bento grid.
- Specify a primary brand color plus success, warning, error, and neutral colors.
- Use hex codes.
- Keep contrast at WCAG 2.1 AA or better.
- Avoid relying on default Tailwind color choices without rationale.

### Typography

- Define H1-H6 and body styles with size, weight, and line height.
- Prefer web-safe implementation choices unless the user provides brand fonts.
- If the user does not specify fonts, choose a modern pairing and state why it fits the product.
- Do not default to Inter unless it truly matches the requested aesthetic.

### Components

- Describe atoms first when they materially affect implementation: colors, type, icon style, radius, shadow, border treatment.
- Then describe molecules: buttons, inputs, chips, dropdowns, cards, tabs.
- Then describe organisms: headers, hero blocks, sidebars, pricing sections, tables, dashboards, footers.
- Include interaction states for important controls: default, hover, active, focus, disabled.

### Layout

- Use a 12-column desktop grid and an 8px spacing system unless the existing product uses another system.
- Call out sticky regions, content width, section rhythm, and responsive breakpoints.
- Mention how content stacks or transforms on small screens.

## Tailwind Output

When asked to provide implementation, return a concise but high-quality Tailwind snippet that demonstrates:

- The overall page shell
- The most important components
- Responsive behavior
- Light and dark theme compatibility when appropriate

Prefer semantic HTML and realistic content. Keep snippets focused on the core screen rather than generating an entire app unless the user requests a full page.

For a fast quality check before finalizing an answer, read [references/ui-review-checklist.md](references/ui-review-checklist.md).

## Adapting To Existing Products

If working inside an existing codebase or design system:

- Preserve existing spacing, tokens, and interaction patterns.
- Reuse current component conventions before inventing new ones.
- Only introduce a stronger visual direction when it fits the established brand.

## Output Quality Bar

- Be specific enough that a designer or frontend engineer can implement the screen without guessing the intent.
- Avoid vague phrases like "clean modern UI" unless immediately followed by concrete design decisions.
- Favor a few strong decisions over many weak options.
