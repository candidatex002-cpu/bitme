# 🎨 Game Asset Design Variants

This folder holds **alternative visual designs** for every in-game asset.
If you don't like the current look of a food, obstacle, or portal, just pick
a variant here and swap the function in the parent asset file.

## 📁 Folder Structure

```
designs/
  foods/
    frog.ts          ← alternative frog designs
    cherry.ts        ← cherry & generic food designs
  objects/
    tree.ts          ← alternative tree designs
    pond.ts          ← alternative pond designs
    cave.ts          ← alternative cave designs
    rock.ts          ← alternative rock designs
  powers/
    wormhole.ts      ← alternative wormhole / portal designs
```

## 🔄 How to Swap a Design

1. Open the design file (e.g. `designs/objects/pond.ts`)
2. Pick the variant you prefer (each file has multiple named exports)
3. Open the matching asset file (e.g. `../objects.ts`)
4. Replace the function body — or re-export from the design file

**Example** — swap pond to "Neon Cyberpunk" style:
```ts
// objects.ts
export { renderPondNeon as renderPondAsset } from './designs/objects/pond.js';
```

## 📝 Naming Convention

Each variant function is named:
```
render{Asset}{Style}
```
e.g. `renderPondNeon`, `renderPondMinimal`, `renderCaveSpooky`

The **current live** function name (used by the game) is always:
```
render{Asset}Asset
```
e.g. `renderPondAsset` in `objects.ts`
