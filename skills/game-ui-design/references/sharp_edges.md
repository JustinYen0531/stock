# Sharp Edges

Use this file when diagnosing weak game UI. These failures matter because they break trust under pressure.

## Tiny Text On Distant Screens

Why it fails:
Players cannot parse information from couch distance, during motion, or on small handheld displays.

What to look for:
- Desktop-sized labels reused on TV or handheld targets
- Dense stat blocks shown during active play
- Tooltips that carry required information

## Edge-Hugging Critical UI

Why it fails:
TV overscan, bezel loss, and peripheral blind spots hide or delay critical information.

What to look for:
- Health, ammo, or prompts pushed into the extreme corners
- Important elements living outside safe zones

## Controller Dead Ends

Why it fails:
A menu that only works well with a cursor feels broken on console, handheld, and accessibility setups.

What to look for:
- Missing focus states
- Hover-only disclosure
- Inconsistent back or cancel behavior

## Color-Only Communication

Why it fails:
Color blindness, poor displays, and combat stress make color-only status unreadable.

What to look for:
- Red versus green without icon or shape support
- Ally versus enemy states distinguished only by hue

## Motion That Competes With Play

Why it fails:
Animation can hide state changes, delay action, and pull attention away from aiming or timing.

What to look for:
- Long entrance animations on urgent alerts
- Screen shake, pulsing, or floating numbers that obscure targets

## Notification Flooding

Why it fails:
When everything announces itself, nothing feels important and players miss real threats.

What to look for:
- Achievement, loot, damage, quest, and tutorial messages sharing one noisy area
- Repeated events shown individually instead of summarized

## Permanent Prompt Clutter

Why it fails:
Constant prompts flatten the screen, reduce world readability, and train players to ignore cues.

What to look for:
- Buttons labels visible for every nearby object at all times
- Tutorial hints that never retire

## Flat Porting Across Platforms

Why it fails:
A UI tuned for mouse precision or phone thumbs often collapses when moved to controller or TV play.

What to look for:
- Shared layout with no spacing, target-size, or safe-zone changes
- Touch-first or mouse-first assumptions carried into controller flows

## Missing Accessibility Options

Why it fails:
Players lose access to information or control schemes they need to play reliably.

What to look for:
- No subtitle controls
- No text scaling
- No remapping or reduced-motion path for critical flows
