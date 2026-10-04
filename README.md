# Desert Archive

Scroll-driven WebGL site, built step by step as a learning project.
Scroll-driven desert scene: a rock-cut temple with carved reliefs, rippled red sand, and relics sealed in amber, lit by an HDR sky.

```
npm install
npm run dev
```

Controls: mouse wheel / drag / arrow keys move between sections.
In the last section, left / right arrows morph the particles.
Console: `__app.scroll.goTo(3)` jumps to a section.

## Structure
- `src/core/VirtualScroll.ts` — wheel/touch/keys -> damped progress with section snap
- `src/core/CameraPath.ts` — one shot per section, joined by splines
- `src/core/Assets.ts` — glTF + Draco + KTX2 loaders (empty manifest for now)
- `src/core/Post.ts` — bloom, storm haze, chromatic aberration, vignette, grain
- `src/world/*` — Sky, Dunes, Temple, Relics, Portal, Swarm (GPU particle morph), Dust
- `src/main.ts` — layout of the world, lights, render loop

## Assets (all made for this project, nothing downloaded)
- `public/assets/sky_dusk.hdr` — sky panorama rendered in Blender (sun 14 degrees up), prepared by `scripts/prep_sky.py`
- `public/assets/temple.glb` — temple front, columns and rock outcrop, modelled in Blender (Draco)
- `public/assets/relics.glb` — three amber nodules and what they hold: ammonite, amphora, scarab
- `public/assets/blocks.glb` — six weathered stone blocks, used as fallen rubble
- `public/assets/sand_*.jpg`, `stone_*.jpg` — tiling PBR textures from `scripts/gen_textures.py` (sand has wind ripples baked in)
- `public/assets/facade_*.jpg` — the carved temple front (invented signs) from `scripts/gen_facade.py`
- `_blender/desert_assets.blend` — the Blender source file

## Roadmap
1. Scroll flow and procedural look (done)
2. Realism pass: HDR sky lighting, PBR textures, temple, relic objects (this stage)
3. Statues and deeper carving, baked ambient occlusion, desert plants, sculpted gate
4. Hand-written amber refraction shader, project detail view
5. In-canvas MSDF text and HUD, loader screen
6. Sound, KTX2 texture compression, quality tiers, mobile
