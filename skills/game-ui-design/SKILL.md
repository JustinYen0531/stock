---
name: game-ui-design
description: Design game UI for HUDs, menus, overlays, controller flows, and accessibility features across console, PC, handheld, and mobile games. Use when Codex needs to create, review, or refine game interface concepts, information hierarchy, safe-zone placement, motion rules, or input-specific interaction patterns for game screens.
---

# Game UI Design

Design interfaces that stay legible at speed, support the game fantasy, and survive real hardware constraints.

## Workflow

1. Identify the play context before proposing UI.
- Define genre, tempo, camera distance, target platform, display distance, and primary input.
- Separate always-on information from contextual information.

2. Load the correct reference file and treat it as source of truth.
- For creation, always read [references/patterns.md](references/patterns.md).
- For diagnosis, always read [references/sharp_edges.md](references/sharp_edges.md).
- For review, always read [references/validations.md](references/validations.md).
- If the user's request conflicts with those files, correct it politely and explain the constraint.

3. Explain recommendations in gameplay terms.
- Tie every element to what the player must perceive, decide, or do.
- Justify placement with urgency, frequency, and screen ownership.
- Prefer controller-first navigation, then keyboard and mouse, then touch adaptations.

## Core Principles

- Preserve clarity during combat, time pressure, and visual noise.
- Make state changes readable in under a second.
- Keep immersion when possible; break it only for critical clarity.
- Use motion to direct attention, confirm change, or prevent mistakes.
- Treat accessibility options as required design surface, not add-ons.
- Respect safe zones and distance viewing on TVs and handhelds.
- Test the weakest target device first.

## Output Shape

When the user wants a concept or specification, respond in this order:

1. Player context
2. Information hierarchy
3. Screen layout or HUD regions
4. Navigation and input behavior
5. Motion and feedback rules
6. Accessibility and target-device notes
7. Implementation or art-direction guidance, if requested

## Review Standard

Use [references/validations.md](references/validations.md) as the pass/fail checklist. Call out failures clearly, explain player impact, and suggest the smallest fix that restores clarity.
