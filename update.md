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

### Milestone 3 — reverted to Word-Swap, permanently this time

The core mechanic had drifted back to drag-to-trace in the shipped
build (unclear exactly when/how — possibly a stale rebuild, possibly a
regression during the Milestone 2 work above). Replaced it with
**Word-Swap**, confirmed as the mechanic going forward: tap-tap or
swipe two orthogonally-adjacent tiles to swap them; the whole board
(every row + column) is then scanned for any 3-5 letter word the swap
created — a single swap can complete more than one word at once, and
all of them clear together. No word anywhere -> the swap reverts
(tiles flash red, bounce back to original positions). Both tap-tap and
swipe are supported as input so it works equally well with mouse
clicks or touch drags.

- Rewrote the board's solvability check: the old `hasValidWord()`
  asked "does a word already exist on the board" (correct for
  drag-trace, since you need an existing word to trace). That's the
  wrong question for swap mechanics — completed words auto-clear
  immediately anyway, so a board can look word-free while still having
  zero legal swaps. Replaced with `hasValidSwap()` /
  `wouldSwapCreateWord()`, which simulates every adjacent pair's swap
  and checks whether *that* would create a word. Used by both the
  silent auto-reshuffle safety net and Shuffle's retry loop.
- Removed all now-dead drag-path code (`path`, `pathKeys`,
  `pathGraphics`, `pathText`, `PREFIX_SET` usage, `startPath` /
  `extendPathTo` / `endPath` / `cancelPath`).
- Header instructions updated to "Swap two adjacent tiles to spell a
  3-5 letter word."
- Verified with a build pass, a standalone script replaying the
  DOG/RUG example the design was built against, and a 200-trial
  stress test (0 boards failed to find a valid swap).

### Full A-Z alphabet restored

The tile pool had been temporarily reduced to 10 letters
(A/E/I/O/U/R/S/T/L/N) at some point, dropping G/D/W/C/etc. entirely.
Restored the full 26-letter alphabet, weighted by standard English/
Scrabble-style letter frequency (E/A/I/O most common, Q/X/Z/J/K
rarest) instead of hand-picking a reduced set. Colors are now
auto-generated as 26 evenly-spaced hues around the color wheel rather
than hand-picked one at a time, so every letter gets its own distinct
flat/bright "candy" color automatically. Dividing the alphabet into
progressive stages (common letters first, rest unlocked later) is a
deliberate follow-up, not done here — full alphabet went in first, per
plan.

- Verified: build passes, and a 200-trial stress test shows a valid
  swap exists on the first random 7x7 board every time with the full
  pool — word density unaffected by the switch from 10 to 26 letters.

### Board resized to 6x6, word range extended to 3-6, Shuffle bug fixed

Three changes landed together:

- **6x6 board** (was 7x7). At 6x6 a full 6-letter word can span an
  entire row/column edge-to-edge.
- **3-6 letter word range** (was 3-5). Added `WORDS_6`: 4,985 six-letter
  words, sourced from ENABLE1, cross-referenced against a 50k-word
  English frequency list (common everyday words, not obscure
  Scrabble-legal ones), then passed through a profanity/slur/
  inappropriate-word filter (automated blocklist + manual spot-check of
  substring-flagged false positives). Dictionary is now ~8.9k words
  across 3-6 letters (was ~3.9k at 3-5). Replaced every hardcoded `3`
  / `5` length bound scattered across the matching functions with
  shared `MIN_WORD_LENGTH` / `MAX_WORD_LENGTH` constants in
  `config.js` so the bounds can't drift out of sync with each other
  again.
- **Shuffle bug fixed:** Shuffle could leave an already-completed word
  sitting on the board uncleared (e.g. a "SON" that just sat there
  after a shuffle, only getting swept up later as an unrelated bonus
  when the player's next swap happened to trigger a full-board
  rescan). Root cause: the post-shuffle check only verified a *future*
  swap could create a word, never that the shuffle itself hadn't
  already handed one out for free. Fixed by running the same
  clear/cascade pass after Shuffle that already runs after every other
  board change.
- Verified: build passes; 500-trial stress test confirms a valid swap
  exists within the retry cap on every random 6x6 board using the full
  alphabet and the new 3-6 word range (0 failures).

---

### Milestone 4 — rebrand to WordSwoop, proper boot flow (splash -> main menu -> board)

Game renamed from the working title "Alphabet Adventure" to
**WordSwoop**, published under **Wobblewing Studios** (logo supplied,
now used in-game). Repo/folder name unchanged for now — only
player-facing branding changed.

Added a real boot flow, replacing what used to be a direct load
straight into the board:

- **Splash screen**: studio logo pops in (scale+alpha tween with a
  small overshoot/settle), triggers a sparkle-star particle burst,
  then the "WordSwoop" title reveals underneath with its own burst.
  Ambient sparkles drift in the background throughout. First version
  of this then just faded straight into the board on a fixed ~2.6s
  timer with no menu in between and no loading indicator — corrected
  per feedback (see below).
- **Loading bar**: replaced the fixed timer with an actual loading bar
  under the title that ticks through checkpoints — 40% -> 70% -> 90%
  -> 100% — visibly pausing at each rather than animating smoothly.
  Whole sequence (logo pop-in + title reveal + loading bar + fade)
  totals ~2.6s, under the 3s budget. Plays on every app open, not just
  first launch - no skip-after-first-time logic.
- **Main menu**: new scene the splash now hands off to instead of the
  board directly. Shows the logo/title again plus a Play button;
  tapping Play fades into the board. Deliberately minimal for now —
  World Map / Daily Challenge / Achievements / Settings (PLAN.md
  section 1) are follow-ups, not built here.
- Logo asset: resized from the studio's 1536x1024 upload down to
  700px wide (transparency preserved), stored under `public/assets/`
  so Vite serves it as a static file.
- Verified: build passes each time; Phaser particle API
  (`add.particles()`, `.explode()`) and the Container
  `setSize()`+`setInteractive()` pattern for the Play button were both
  checked directly against the installed Phaser 3.80 source rather
  than assumed from memory.

---

## Next up

1. **Expand the main menu** — World map, Daily challenge, Achievements,
   Settings (currently just Play).
2. **Divide the alphabet into progressive stages** — e.g. common
   letters unlocked first, rarer ones added in later worlds/levels,
   now that the full A-Z pool is confirmed working.
3. **Phase 2 — level objectives & structure**, replacing today's
   endless free-play scoring:
   - Target word per level (e.g. "Find: LION").
   - Swap-limit structure (a move-limit equivalent).
   - Win/lose conditions.
   - Goal / moves / stars header UI (stars row, move counter, goal
     icons like the reference mockup), plus a bottom booster toolbar.
4. **Target-word solvability**, called out in `PLAN.md`: once levels
   have a specific target word + swap limit, today's "does *a* word
   exist" solver isn't enough — need "is *the target word* reachable
   within N swaps, accounting for obstacles/wildcards." Needs a
   level-specific solver/simulator or a manual playtest step before
   Phase 6 content production scales up.
5. Revisit Special Tiles' length thresholds (`PLAN.md` §4) now that 6
   is the max word length, not 5.
