# Desert Archive — concept sheet

**Story.** An old temple, cut into a rock outcrop, stands alone in the desert.
It is an archive: the things you have built are kept inside it. Scrolling is a
walk through its door, through a sandstorm, past three relics, through a gate, to the place
where you can send a signal.

**Palette.** Red-orange rippled sand, ochre sandstone, dark brown rock, a
clear blue sky with the sun low behind the viewer. One accent only: gold
`#ffb648`, used for the light inside the temple and the gate.

**Type.** One monospace face, uppercase, wide tracking. Labels read like
catalogue tags (`RELIC_01 / PROJECT NAME`).

| # | Section    | What happens                                                         | Technique to learn                      |
|---|------------|----------------------------------------------------------------------|-----------------------------------------|
| 0 | The Temple | A rock-cut temple front with carved signs; the doorway glows gold     | Blender modelling, PBR, relief textures |
| – | Entry      | Walk the column avenue, pass through the door, come out in a storm    | Camera splines, post-processing         |
| 1–3 | Relics   | Amber holding an ammonite, an amphora and a scarab                    | Transmission / refraction, raycast      |
| 4 | The Gate   | Broken stone rings rotate, align and light up                         | Timeline choreography, bloom            |
| 5 | Signals    | Sand grains gather into shapes (contact links), arrows cycle them     | GPU particle morph                      |

**Rules.** No HTML text in the final build (all text in canvas). Whole
payload under ~6 MB. Must hold 60 fps on integrated graphics.
