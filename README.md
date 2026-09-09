# Deepsea

First playable sketch for a small web arcade/board-game hybrid.

## Current prototype

- Boat at the surface (`depth 0`)
- 20-cell vertical dive track
- Roll a die from 1 to 6
- The result is the number of seconds available for tapping
- Descending costs **10 taps per cell**
- Ascending costs **15 taps per cell** with no loot
- Each carried treasure currently adds **+5 taps per cell** while ascending
- Treasure cells can be collected and banked by safely returning to the boat
- Oxygen tank markers are already placed on the board, but the actual oxygen rule is intentionally not implemented yet
- Mouse, touch/pointer and Space bar tapping are supported

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Core loop being tested

1. Roll the die.
2. Choose down or up.
3. Start the burst.
4. Tap/click as fast as possible for the rolled number of seconds.
5. Decide whether greed is worth making the return trip harder.
6. Reach the boat to bank the loot.

## Next rule to design

The important unresolved mechanic is oxygen: how bottles are activated, how much oxygen they contain, whether their value is hidden, and how oxygen interacts with the tapping timer on the return trip.
