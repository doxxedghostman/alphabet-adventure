# Alphabet Adventure — Progress Log

Chronological changelog of what's shipped, on `main`. See `PLAN.md` for
the design doc / where this is headed.

---

## Phase 1 — Prototype

### Milestone 1 — swap-to-match-3 loop (superseded)

First playable: 7x7 board, click a tile then an adjacent tile to
attempt a swap, commits only if it produces a 3+ match, chain
reactions on refill with per-chain score multiplier. Built to answer
one question — is a match-3 loop technically sound end to end (board
gen, swap, match, clear, fall, cascade, score)? It was. But it wasn't
word-aware at all: matches were "3 identical letters in a row," not
"3-5 letters spelling something real." Superseded by Milestone 2 below
before any further phases were built on top of it.

### Milestone 2 — pivot to Word-Trace (current core loop)

Replaced swap-to-match with drag-to-trace: player drags through
orthogonally-adjacent tiles (no diagonals, path can turn corners) to
spell a real 3-5 letter word, validated against a bundled dictionary
(`src/data/wordlist.js`, `WORD_SET` + `PREFIX_SET` for live dead-end
pruning while dragging). Releasing on a valid word clears those tiles;
tiles fall to fill gaps; after every fall the board auto-scans every
row/column for any straight-line word that landed there by chance and
clears it too, chaining further cascades Candy-Crush style. This is
the confirmed core loop going forward (see `PLAN.md` §2).

- No target words, no special tiles (rocket/rainbow), no obstacles, no
  trace limits yet — intentionally out of scope for Phase 1.
- Initial board generation avoids spawning a free word by chance.

### Board fits a phone-sized panel instead of stretching full-bleed

The canvas was a fixed 594x702px with no Scale Manager config, so it
rendered at native size and either overflowed or stretched to fill
whatever window it was in — not phone-shaped. Fixed by:

- `index.html`: canvas now sits inside a bordered, rounded `#game-frame`
  (`min(94vw, 420px)` wide, board's aspect ratio, centered).
- `main.js`: added Phaser `Scale.FIT` + `CENTER_BOTH` so the
  fixed-resolution board scales to fit `#game-frame` instead of
  overflowing it.

### Shuffle: manual button + silent auto-safety-net

Added a `hasValidWord()` DFS solver (reuses the same `PREFIX_SET`
pruning as the live drag input) that checks whether any 3-5 letter
word is currently traceable anywhere on the board.

- **Manual:** a Shuffle button in the header reassigns existing tiles'
  letters to a new, guaranteed-solvable arrangement on demand.
- **Automatic:** the same check + reshuffle runs silently after the
  initial deal and after every cascade fully settles, so the board can
  never truly have zero legal moves — the manual button is a
  convenience, not the only thing standing between the player and a
  dead board.
- Verified with a standalone script: 200 random boards from the actual
  in-game letter pool, 0 came back fully stuck (the vowel-heavy pool
  makes a truly dead board rare in practice).

### Cancelled trace now reads as a cancel, not a glitch

`cancelPath()` was clearing the drawn trace line immediately (via
`resetPathState()`), so an invalid word's line vanished instantly while
only the individual tiles flashed red a moment later — looked like a
rendering bug. Fixed: the traced line now redraws in red and holds
~180ms before fading, in sync with the tile flash. Bonus: the live
trace line while dragging now turns green as soon as the in-progress
path already spells a valid word (previously only the word-preview
text above the board did this).

### Board is solvable; word-spotting was the real UX gap

Ran the (then corner-turning) solver against a real screenshot of the
board mid-play and found **37 valid words** on it (OUR, TOE, ANT, UNIT,
LIST, TOAST, and more), confirming the board was never actually stuck
— the reported "I can't find a word" was a discoverability problem,
not a generation bug. Because paths could turn corners at the time, a
valid word often didn't look like a straight row/column, which was
genuinely hard to spot by eye. Directly led to the straight-line-only
change below.

### Dragging restricted to straight lines — no corners, no zigzags

Removed corner-turning from the trace mechanic entirely: once the
first two tiles set a direction (one of the 4 orthogonal directions),
every further tile in the drag must continue in that same direction,
or the extension is rejected. A trace is now always one full row or
one full column, read in either direction — matching how Candy Crush
selections actually feel, and making every valid word visually
recognizable as a straight run instead of a zigzag.

- `extendPathTo()` now checks the step direction against the direction
  set by the path's first two tiles.
- `hasValidWord()` (the solvability check) was rewritten to match: it
  no longer does a DFS across arbitrary corner-turning paths, it scans
  each row/column for a 3-5 letter run (either reading direction) that
  matches a real word — i.e. exactly what a straight-line drag can
  produce. Re-verified with 500 random boards from the actual letter
  pool: 0 came back stuck.
- Header instructions updated to "Drag in a straight line (row or
  column) to spell a 3-5 letter word."
- Re-checked the same screenshot board from above against the new
  straight-line-only solver — still solvable (e.g. SORT, EURO both
  read as plain straight runs), so no board that was fine before is
  broken by this change.

---

## Next up

1. **Hint feature** (lower priority now). Briefly highlight one valid
   line on demand — nice-to-have polish now that straight-line-only
   dragging already makes most words visually recognizable on their
   own.
2. **Phase 2 — level objectives & structure**, replacing today's
   endless free-play scoring:
   - Target word per level (e.g. "Find: LION").
   - Trace-limit structure (the drag-trace equivalent of a move limit).
   - Win/lose conditions.
   - Goal / moves / stars header UI (stars row, move counter, goal
     icons like the reference mockup), plus a bottom booster toolbar.
3. **Target-word solvability**, called out in `PLAN.md`: once levels
   have a specific target word + trace limit, today's "does *a* word
   exist" solver isn't enough — need "is *the target word* reachable
   within N traces, accounting for obstacles/wildcards." Needs a
   level-specific solver/simulator or a manual playtest step before
   Phase 6 content production scales up.
