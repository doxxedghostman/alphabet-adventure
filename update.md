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

## Phase 2 — Level objectives & structure

### Milestone 5 — target word, moves, win/lose popups (Phase 2 core loop)

Shipped in 3 scoped batches:

**Batch 1 — level data + header UI.** New `src/data/levels.js`: plain
data (`{ id, targetWord, maxSwaps }`) plus `getLevel()` /
`getNextLevelId()` helpers, no logic in BoardScene needed to add a
level. BoardScene now takes a `levelId` via scene data (MainMenuScene's
Play button passes `{ levelId: 1 }`), and the header shows a Level
badge, a Moves badge, and a "Find: WORD" goal line. UI/data only in
this batch — moves didn't decrement yet.

**Batch 2 — moves countdown + win/lose detection.** A move is spent on
every *successful* swap only; a swap that bounces back (no word
anywhere on the board) stays free, matching standard match-3
convention. `checkTargetWord()` runs after the player's own swap *and*
after every auto-cascade step, since the target can land via a chain
reaction rather than the direct swap — first match wins immediately,
even mid-cascade, which is why a win always takes priority over
running out of moves (`checkLevelEnd()`, which checks moves-exhausted,
can never fire after a win already set `levelOver`). All input (tap,
swipe, Shuffle) is blocked once `levelOver` is true. Landed with a
plain placeholder banner just to prove the logic worked end-to-end.

**Batch 3 — real popups.** Replaced the placeholder banner with a
proper card popup: dim overlay, title, message, score, and two
buttons. Win -> "Great Word! You spelled X" -> Next Level (or Back to
Menu on the last level) / Replay. Lose -> "Out of Moves, Needed: X" ->
Try Again / Main Menu. `restartLevel()` uses `scene.restart()` for a
clean retry (fresh board, same target); `goToNextLevelOrMenu()`
advances via `getNextLevelId()` or falls back to the main menu once
the level list runs out.

End-to-end result: Main Menu -> Play -> swap to spell the target word
within the move budget -> win/lose popup -> Next Level / Retry / Menu.
This is the first time the game has had an actual objective and an
ending, rather than endless free-play scoring.

- Verified: build passes after each of the 3 batches (checked
  individually before moving to the next), plus a manual read-through
  confirming no leftover references to the old placeholder banner
  after batch 3 replaced it.
- Not done here (still open, see `PLAN.md`): target-word solvability
  (nothing yet guarantees BAG/CAT/GARDEN are reachable within their
  move budgets on a given random board — picked common,
  high-frequency-letter words to keep the odds good in the meantime,
  not as a real fix), stars/rating, obstacles, special tiles, only 3
  levels exist.

---

### Milestone 6 — target-word solvability resolved (guaranteed-board generator) + 200-level plan locked in

Decided the content scale: **200 levels total** (was conflicting
between 150 and 180 in `PLAN.md` — resolved to 200 across the existing
6 worlds, ~33-34 levels each). Of those, **every 5th level (40 total)**
is a `type: 'target'` level with a specific word to find; the rest will
be free-play (`type: 'free'`, not yet built — only the target-word
levels were blocked on the solvability problem, so that's what got
built first).

That solvability problem (open since Milestone 5) is now resolved —
without a live solver. A real solver would need to search over
sequences of swaps (not just one swap deep like `hasValidSwap()`),
accounting for cascades scrambling progress along the way — expensive
and fragile. Instead, new `src/utils/levelGenerator.js` builds the
board **backwards** from a solved state:

1. Place `targetWord` correctly, in a straight line (random row or
   column), on an otherwise-empty board.
2. Fill every other cell with the same weighted-random,
   avoid-accidental-words logic the free-play board already used.
3. Apply `scrambleCount` random adjacent-tile swaps directly to the
   letter grid to scramble the word away from its solved position.

Since the scramble path is known, the board is provably solvable in at
most `scrambleCount` swaps — reversing the scramble always works, even
though the player will likely find a different, possibly shorter path.
No search needed, just arithmetic. `recommendedMaxSwaps()` adds a
buffer on top (scrambleCount + 50% + 3) so the player isn't held to the
exact reverse path.

Wired into `BoardScene.createInitialBoard()`: levels with `type:
'target'` now call `generateGuaranteedBoard()` instead of the old
random-fill-then-patch approach (`pickNonMatchingLetter` +
`ensureTargetLettersPresent`, which only guaranteed the *letters*
existed somewhere on the board, not that the *word* was reachable in
time). All 3 existing levels (BAG, CAT, GARDEN) now carry `type:
'target'` in `levels.js` and use this generator.

Scramble counts per word length are placeholders in
`SCRAMBLE_COUNT_BY_LENGTH` (3: 6, 4: 9, 5: 12, 6: 15) — picked as a
starting point, not yet playtested. Too few scrambles and the word
looks near-complete on load (too easy); too many and clearing it eats
most of the swap budget just resetting the board (too punishing).
Finding the actual sweet spot per length is next, once there's time to
play through several target-word levels back to back.

- Not done here: `type: 'free'` levels (no fixed word — still just
  `type: 'target'` levels exist), the scramble-count playtest pass
  above, and accounting for obstacles/wildcards in the generator once
  Phase 3 adds them (they don't exist yet, so out of scope for now but
  could block the scrambled swap path once they do).

---

### Milestone 7 — switched to 10-world layout (docs only)

Replaced the 6-world/~33-per-world map in `PLAN.md` §9 with a 10-world/
20-per-world layout from an external game-design spec: Candy Garden,
Jungle Jumble, Ocean Words, Dino Valley, Cloud Kingdom, Crystal Forest,
Magic Mountain, Space Words, Ancient Valley, WordSwoop Kingdom. 200
levels total unchanged. Character list updated to loosely match (rough
placeholders, not final design). Word length stayed at 3-6 — explicitly
rejected shrinking to the spec's 3-5 range, since the board/generator/
wordlist already support 3-6 and that wasn't up for discussion.

Also documented (not built) several systems from the same spec as
planned main-menu/meta-layer additions, not board mechanics: Lives,
Bombs, Combo/streak multiplier, Boss/Champion levels every 20th,
3-star scoring, coins, daily login rewards (`PLAN.md` §14).

No code changed — docs only, so no build verification needed beyond
confirming the file still parses as valid markdown.

---

### Milestone 8 — free-play levels (`type: 'free'`, score-target objective)

Resolved the last item blocking most of the 200-level content: what a
free-play level's objective actually is. Went with **score target** —
reach `scoreTarget` points within `maxSwaps` swaps, any words count —
over "find N words" or a bare move limit, since it reuses the existing
scoring math untouched and doubles as the star threshold the planned
§14 3-star meter needs anyway.

Changes in `BoardScene.js`:
- `createHeader()` and `updateScoreText()` now branch by
  `this.level.type`: `'target'` shows "Find: WORD"; `'free'` shows
  "Reach N points" as the goal and "Score: X / N" as live progress
  (was just "Score: X" for everyone before).
- `checkTargetWord()` renamed to `checkWinCondition()` and now branches
  by type: `'target'` keeps the old "did wordsFound include the target"
  check; `'free'` just checks `score >= scoreTarget`.
- `onLevelWon()` / `onLevelLost()` popup messages branch by type so
  they don't reference `targetWord` (which is `undefined` for free
  levels) — free levels report the score reached/needed instead.
- `ensureTargetLettersPresent()` now no-ops immediately if
  `targetWord` is unset, since free levels have no target letters to
  guarantee.
- Found and fixed a real bug while doing this: `shuffleBoard()` had an
  unguarded `this.targetWord.split('')` that would have thrown the
  moment a player hit Shuffle on a free-play level. Guarded behind
  `if (this.targetWord)`.

`levels.js`: documented the two-type schema in full, added 2 working
`type: 'free'` demo levels (ids 4-5, scoreTarget 300/600) alongside the
existing 3 `type: 'target'` levels. Ids don't yet follow the eventual
"every 5th is target" numbering — these are functional demo levels,
not the final authored list.

- Verified: `npm run build` passes clean after each logical change
  (header/score branch, win/lose branch, the shuffle bug fix); grepped
  every remaining `targetWord` reference in `BoardScene.js` by hand
  afterward to confirm none are reachable unguarded for a `type:
  'free'` level.
- Not done here: the scramble-count playtest (Milestone 6's leftover),
  and authoring the other ~155 free-play levels + ~36 remaining target
  words — this milestone only proves the `'free'` type works, it
  doesn't populate the level list.

---

## Next up

1. **Playtest scramble-count sweet spot** per word length (see
   Milestone 6) — tune `SCRAMBLE_COUNT_BY_LENGTH` based on how
   easy/punishing target-word levels actually feel to play.
2. **Playtest the score-target numbers** (see Milestone 8) — the 2 demo
   free-play levels (300/600 points) are guesses, not verified against
   actual play.
3. **Author the full 200-level list** — pick the remaining ~36 target
   words (themed per world) and ~155 more free-play score targets,
   scaling difficulty per PLAN.md §4's progression curve.
4. **Expand the main menu** — World map, Daily challenge, Achievements,
   Settings (currently just Play).
5. **Divide the alphabet into progressive stages** — e.g. common
   letters unlocked first, rarer ones added in later worlds/levels,
   now that the full A-Z pool is confirmed working.
6. Revisit Special Tiles' length thresholds (`PLAN.md` §4) now that 6
   is the max word length, not 5.
7. **My Word Book** (new idea from the reference mockups, not
   previously in `PLAN.md`): a running log of every word the player's
   ever cleared, shown with pronunciation. Cheap to build — log
   distinct cleared words per save, pronunciation via the browser's
   built-in speech API (no audio assets needed). Worth adding as a
   Phase 4/5 nice-to-have.
8. Stars/rating per level, coins/currency, booster inventory
   (Rocket/Rainbow/Bomb/Shuffle as spend-to-use items, distinct from
   the auto-triggered special tiles in `PLAN.md` §4 — worth deciding
   how those two systems relate before building either further).
