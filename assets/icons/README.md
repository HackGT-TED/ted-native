# App icons

The SVGs directly in this folder preserve the outlines and scale of the glyphs in `../fonts/Icons.ttf`, under the existing [Apache 2.0 license](../fonts/Icons-LICENSE.txt).

Each outline is centered by its visible bounds in a 960 × 960 view box. The font's Y axis is inverted for SVG coordinates. The shared `Icon` component renders these assets with Expo Image, a fixed square size, and the requested tint. No text baseline, line height, or platform font padding affects icon placement.

`src/components/icon-assets.ts` maps icon names to bundled assets. The original font is retained as source material, but is no longer loaded by the app.

The `navigation/` folder contains the user-provided HomeIcon, CreateIcon, FamilyIcon, ExploreIcon, and LibraryIcon SVGs, copied without changes. They retain their original 24 × 24 view boxes and embedded artwork, and are used only in the bottom navigation with the existing selected and inactive tints.
