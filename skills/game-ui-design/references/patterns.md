# Patterns

Use this file when creating game UI concepts, specs, or implementation guidance.

## Start With Play Context

Define these inputs before choosing a pattern:

- Genre and tempo: slow tactics, traversal, character action, PvP, social sim, survival horror, or arcade.
- Camera and distance: first person, third person, top-down, side view, cockpit, or detached strategy camera.
- Failure pressure: instant death, attrition, score chase, puzzle lock, or low-stakes sandbox.
- Session rhythm: constant action, bursts of intensity, menu-heavy management, or short repeatable loops.
- Target hardware: couch TV, monitor, handheld, phone, or mixed targets.
- Primary input: controller first, mouse and keyboard first, touch first, or hybrid.

## Choose The Right UI Layer

- Diegetic UI: Place information inside the world when immersion matters and glance time is low. Use for weapon ammo, visor overlays, or in-world navigation cues.
- Spatial UI: Anchor elements to characters, enemies, or objects when the player must connect state to a world entity. Use for enemy health, interaction markers, and ally status.
- Persistent screen-space UI: Reserve for information that must remain readable during chaos. Use for player health, resources, compass, objective state, or party vitals.
- Contextual screen-space UI: Reveal only when relevant. Use for prompts, tutorials, loot comparisons, damage summaries, and modal decisions.

## HUD Patterns

### Vitals

- Keep health, armor, stamina, or mana near the action origin the player checks most often.
- Encode critical state with shape, fill direction, and iconography, not color alone.
- Separate permanent capacity from temporary shields, buffs, or recoverable health.

### Ability And Cooldown Groups

- Cluster abilities by decision speed and usage frequency.
- Make ready, unavailable, and exhausted states distinct at a glance.
- Show exact timers only when the player can act on them.

### Objective Tracking

- Show one primary objective at a time in a short verb phrase.
- Relegate optional tasks to a secondary area or expandable log.
- Pair direction with context: distance, floor change, or area name when navigation matters.

### Awareness Tools

- Use minimaps only when spatial planning materially improves play.
- Prefer compass, ping, or edge indicators when a full map would overload the screen.
- Limit simultaneous directional indicators to the few that affect the next decision.

### Notifications

- Prioritize by urgency: failure risk, tactical change, reward, then flavor.
- Stack low-priority messages away from combat focal points.
- Let repeated low-value events collapse into summaries.

### Interaction Prompts

- Put the prompt near the object or actor, not in a distant corner.
- Lead with the verb, then show the input token.
- Replace permanent prompt clutter with contextual reveal.

## Menu And Flow Patterns

- Build a controller-safe focus graph first. Every menu item must be reachable without pointer input.
- Keep frequent actions shallow. Inventory, loadout, retry, and settings should not require long paths.
- Make back, cancel, confirm, and compare behaviors consistent across every menu.
- Use tabs for stable categories, radial menus for fast muscle-memory actions, and lists for long-form management.

## Platform Adjustments

### Couch TV

- Favor larger type, stronger silhouettes, and generous spacing.
- Keep essential UI inside safe zones and away from the extreme corners.
- Assume glare, imperfect calibration, and viewing distance.

### PC Monitor

- Allow denser information only when players benefit from scanning or precision.
- Support hover, hotkeys, and tooltips without making them mandatory.

### Handheld

- Increase contrast and simplify edge density.
- Avoid forcing players to read long horizontal runs of tiny text.

### Mobile Touch

- Use large touch targets and avoid overlapping gestures in critical moments.
- Put the highest-frequency actions in thumb-friendly regions.

## Motion And Feedback

- Use motion to indicate priority, source, or change of state.
- Keep combat-critical transitions fast; reserve longer motion for menus and rewards.
- Pair motion with sound, text, or icon changes for important events.
- Avoid decorative motion that competes with aiming, timing, or navigation.

## Accessibility Baseline

- Offer scalable text, subtitle controls, and high-contrast support.
- Offer redundant cues for color, sound, and vibration-dependent feedback.
- Support remapping, hold-toggle alternatives, and reduced motion where the game allows it.

## Output Template

When drafting a new concept, structure the response like this:

1. Player and platform context
2. Information hierarchy
3. HUD or menu regions
4. Input and navigation behavior
5. Motion and feedback
6. Accessibility and test notes
