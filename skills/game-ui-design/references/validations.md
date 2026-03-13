# Validations

Use this file when reviewing a game UI request or proposal. Apply these rules as objective pass or fail checks.

## Readability

- Fail if critical gameplay text would be below 24 px in a 1080p TV-first mockup.
- Fail if non-decorative gameplay text would be below 16 px in a desk, handheld, or mobile-first mockup.
- Fail if required information is only available in hover states, tooltips, or secondary overlays.

## Placement

- Fail if essential HUD elements sit outside a 90 percent action-safe zone.
- Fail if couch TV-first layouts depend on content placed outside an 80 percent title-safe zone.
- Fail if the screen center is occupied by persistent UI that is not directly tied to aiming, targeting, or immediate danger.

## Input And Navigation

- Fail if any core flow requires pointer precision and has no controller-safe path.
- Fail if interactive elements lack a visible focus state.
- Fail if confirm, back, cancel, or close behavior changes meaning between adjacent screens without explicit justification.
- Fail if touch-first controls use targets smaller than 44 by 44 px.

## State Communication

- Fail if health, threat, readiness, cooldown, or objective state relies on color alone.
- Fail if urgent alerts are delayed by motion longer than 300 ms before the player can act.
- Fail if multiple alert types share the same region with no priority system.

## Accessibility

- Fail if the proposal omits text scaling for text-heavy UI.
- Fail if subtitle-heavy or narrative UI lacks subtitle size or contrast controls.
- Fail if critical feedback has no redundant cue across color, icon, text, sound, or motion.
- Fail if the control scheme cannot be remapped when the design depends on frequent inputs.

## Platform Fit

- Fail if the same layout is reused across TV, monitor, handheld, and touch targets without adaptation notes.
- Fail if handheld or touch designs place primary actions outside comfortable thumb reach without a strong reason.
- Fail if TV-first UI uses dense desktop-style panels during active gameplay.
