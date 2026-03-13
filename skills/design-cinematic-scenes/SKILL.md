---
name: design-cinematic-scenes
description: Design hyper-detailed cinematic scene descriptions for concept art, key art, AI image generation, environment storytelling, and visual development. Use when Codex needs to turn a rough scene idea into a mood-first visual brief with camera direction, lighting, atmospheric detail, environmental storytelling, color grading, tactile material cues, an AI-art-ready prompt string, or camera and lens specifications.
---

# Design Cinematic Scenes

Create immersive scene direction that feels directed, lived-in, and ready for visual execution.

## Workflow

1. Define the emotional center first.
- Identify the dominant mood before describing objects.
- Ask what the viewer should feel in the first two seconds.
- Treat props and architecture as support for the mood, not the point of the scene.

2. Build the scene through the Visual Immersion Protocol.
- Cinematic framing: choose shot type, camera height, lens feeling, and depth of field.
- Lighting and atmosphere: define time of day, source quality, falloff, haze, rain, dust, smoke, or particulate density.
- Environmental narrative: add signs of use, damage, ritual, neglect, or recent activity.
- Color grading: name a deliberate palette and explain how it supports tone.
- Texture and materiality: describe surfaces with tactile specificity.

3. Keep every detail concrete and sensory-driven.
- Avoid generic praise words such as "beautiful," "stunning," or "amazing."
- Prefer material, temperature, age, moisture, reflectivity, and wear.
- Use precise nouns and active visual verbs.

4. Translate the concept into production-ready output.
- Give a short emotional summary.
- Break the scene into readable categories.
- Provide one optimized comma-separated AI art prompt.
- End with camera and lens specs that fit the intended shot.

## Response Structure

Return output in this order:

1. Scene Summary
- Write exactly two sentences.
- Make it an emotional hook, not a catalog.

2. Visual Breakdown
- Organize under `Lighting`, `Camera`, and `Objects`.
- Fold atmosphere, color grading, and materials into those sections where they read most naturally.

3. Prompt for AI Art
- Write one optimized comma-separated string.
- Preserve the scene's mood, framing, lighting, palette, and tactile details.
- Keep it tool-agnostic unless the user explicitly names Midjourney, Flux, DALL-E, or another generator.

4. Technical Specs
- Include lens suggestion, aperture, and any useful cinematic notes such as aspect ratio, focal distance, or depth of field behavior.

## Design Rules

- Prioritize mood over object count.
- Frame the eye path clearly so the viewer knows where to look first.
- Make lighting do narrative work, not just visibility work.
- Add environmental traces that imply recent life or conflict.
- Use color palettes intentionally instead of listing random hues.
- Match lens choice to storytelling: wider for scale and vulnerability, longer for compression and observation, macro for intimate texture.

## Adaptation Notes

- If the user gives a genre or reference medium, adapt the scene language accordingly: film still, game key art, anime background, editorial fantasy, sci-fi concept frame, and so on.
- If the user provides only a vague idea, fill in missing cinematic details decisively rather than returning placeholders.
- If the user asks for multiple variations, keep the mood constant unless they explicitly want alternatives.
