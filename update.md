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

### Milestone 9 — target-word generator bugs found via headless playtest simulation; "provably solvable" claim found to be false

Built a standalone headless playtest script (`playtest.mjs`, run then
discarded — not committed, since it's a one-off diagnostic, not
product code) that reuses the real game's own letter pool, word list,
scan logic, and level generator to simulate hundreds of games per
level without a browser. Found and fixed four real bugs along the way,
then hit a fifth, bigger architectural problem that's not a quick fix.

**Fixed:**

- **`generateGuaranteedBoard()` was leaving the target word fully
  visible on load.** `scrambleGrid()` picked swap pairs uniformly from
  the whole board with no guarantee any swap touched the target word's
  own cells — with only 6 scrambles for a 3-letter word on a 6x6 board
  (60 possible pairs), the word survived intact ~45% of the time
  (measured: 91/200 trials). Fixed with a verify-and-retry pass: after
  the random scramble, scan for the word and, if still present, apply
  corrective swaps directly on its cells until broken. Verified 0/300
  failures across 6 different target words post-fix.
- **4 Dependabot alerts (1 high, 3 moderate)**, all in the `vite`/
  `esbuild` dev-server path (path traversal, `fs.deny` bypass, NTLM
  hash disclosure, dev-server CORS gap) — dev-tooling only, never
  shipped in the production bundle, but worth closing. Bumped
  `vite` 5.4.10 -> 6.4.3 (latest patched release still on the 6.x
  line — no `vite.config` exists, so no plugins to break, making this
  about as low-risk a bump as they come). Verified: `npm audit` clean,
  production build succeeds, dev server boots normally.
- **`scanLineForWords()` was forward-only, `hasValidSwap()` wasn't.**
  `hasValidSwap()`/`wouldSwapCreateWord()` (the auto-reshuffle safety
  net) already checked both reading directions per `PLAN.md` §2's
  design, but `scanLineForWords()` — what actually clears/scores a
  real swap — only checked forward. That mismatch meant a board could
  satisfy `hasValidSwap()` via a backward-only word, so
  `ensureSolvable()` considered it fine, while zero swaps on it would
  actually clear anything — every swap bounces back forever with no
  in-game recovery short of manually reshuffling repeatedly. Reproduced
  in 1-11% of simulated games depending on level. Fixed by checking the
  reversed substring too (reporting the correctly-spelled dictionary
  word, not the on-board reversed letters, matching what
  `checkWinCondition` compares against).
- **Win/lose popup could appear mid-cascade while the board kept
  animating underneath it.** `checkWinCondition()` (called from both
  `attemptSwap` and `resolveAutoMatches`) can fire `onLevelWon()`/
  `onLevelLost()` partway through a cascade chain, but neither caller
  stopped afterward — they kept clearing, refilling, and recursing
  into further cascade levels underneath the already-visible overlay.
  Reported via screenshot: "Chain x6!" toasts and mid-fall tiles still
  animating while the Next Level/Replay overlay was already on screen.
  Fixed with an early-return guard (`if (this.levelOver) return`) right
  after each `checkWinCondition()` call, and after the
  `resolveAutoMatches`/`ensureSolvable` sequence in `attemptSwap`.

All four verified with `npm run build` passing clean; the visibility
and reverse-word fixes additionally verified with hundreds of
simulated trials each via the playtest script.

**Found, not yet fixed — bigger than a bug:**

`generateGuaranteedBoard()`'s core claim ("solvable in at most
`scrambleCount` swaps by reversing the scramble") doesn't actually
hold under real play. The scramble is applied by directly editing the
letter grid, bypassing game rules — but in the real game, a swap that
doesn't complete some word doesn't just cost nothing, it **reverts
completely**. And a swap that *does* complete a word **destroys those
tiles** (`clearTiles()` + `collapseAndRefill()` — they're removed and
replaced with fresh random letters), it doesn't just reposition them.
So reversing the scramble only works if every individual reverse-swap
also happens to independently complete some word — which is rarely
true. Measured directly: only **1% of GARDEN boards** (2/200) and
**13% of BAG boards** (26/200) have a genuinely legal reverse-path;
in the rest, even the *first* reverse-swap is often already illegal.
This is why the playtest bot's GARDEN win-rate came out so low (~16%
within budget) — not a tuning problem, a solvability problem.

Three options considered for a real fix: (1) precompute verified
boards offline via a real search over legal swap sequences, baked into
`levels.js` as fixed data instead of randomly regenerated per play —
keeps the guarantee, real engineering work, but the "expensive search"
concern from Milestone 6 mostly disappears if it only ever runs once
at authoring time, not per-play; (2) drop the deterministic guarantee
entirely, accept target completion is probabilistic (already how
BAG/CAT behave in practice, ~80% within budget) — smallest change but
a target-word level can be genuinely unwinnable in a given attempt;
(3) change the swap mechanic so target-word tiles don't clear until
the full word completes — biggest change, alters core game feel.
**Decided on (1)** — starting work on the offline solver/generator
next, building and pushing it incrementally rather than as one large
change.

---



Priority order below. Note: kids mode (`PLAN.md` §7) is **not** a
current priority — this is a general-audience game first. Items are
ordered to follow the existing plan (general game first) rather than
around kids-mode-specific concerns.

1. **Build an offline verified-board generator/solver for target-word
   levels** (Milestone 9) — real search over legal swap sequences
   (accounting for clear+cascade+refill), run once per level at
   authoring time, output baked into `levels.js` as fixed boards
   instead of randomly regenerated per play. Supersedes item 3 below
   for target levels specifically — no point tuning scramble counts on
   a generator that isn't reliably solvable in the first place.
2. Revisit Special Tiles' length thresholds (`PLAN.md` §4) now that 6
   is the max word length, not 5.
3. **Divide the alphabet into progressive stages** — e.g. common
   letters unlocked first, rarer ones added in later worlds/levels,
   now that the full A-Z pool is confirmed working.
4. **Playtest scramble-count sweet spot** per word length (see
   Milestone 6) — only still relevant if item 1 above ends up keeping
   any randomized (non-offline-verified) generation path.
5. **Playtest the score-target numbers** (see Milestone 8) — the 2 demo
   free-play levels (300/600 points) are guesses, not verified against
   actual play.
6. **Author the full 200-level list** — pick the remaining ~36 target
   words (themed per world) and ~155 more free-play score targets,
   scaling difficulty per PLAN.md §4's progression curve. Blocked on
   item 1 for the target-word levels specifically.
7. **Expand the main menu** — World map, Daily challenge, Achievements,
   Settings (currently just Play).
8. **My Word Book** (new idea from the reference mockups, not
   previously in `PLAN.md`): a running log of every word the player's
   ever cleared, shown with pronunciation. Cheap to build — log
   distinct cleared words per save, pronunciation via the browser's
   built-in speech API (no audio assets needed). Worth adding as a
   Phase 4/5 nice-to-have.
9. Stars/rating per level, coins/currency, booster inventory
   (Rocket/Rainbow/Bomb/Shuffle as spend-to-use items, distinct from
   the auto-triggered special tiles in `PLAN.md` §4 — worth deciding
   how those two systems relate before building either further).
10. **Bidirectional-match readability** — deprioritized. `scanLineForWords()`
   correctly matches words in either reading direction (`PLAN.md` §2),
   so a board reading e.g. `B-O-L` credits "LOB" without the player
   ever seeing the word in correct left-to-right order — treated as a
   fine puzzle flourish for general play, not a problem to fix, since
   kids mode isn't a current priority. Each match still carries a
   `wasReversed` flag (added, unused by any caller) in case this is
   revisited later; no other behavior changed.

---

### Milestone 10 — World Map planned (docs only)

Reference mockup added at `docs/reference/world-map-mockup.png`
(forest-adventure style World Select grid + Candy Garden level path).
Full implementation plan written up in `PLAN.md` §8.5: two new scenes
(`WorldSelectScene`, `LevelPathScene`), a new `worlds.js` data file, a
new localStorage progress store (levels completed — doesn't exist yet,
blocking this), lock logic (sequential level/world unlocking), and a
build order starting with World 1 (Candy Garden) only. Only 20 unique
art assets needed total (10 thumbnails + 10 backgrounds); nodes/stars/
lock icon/signpost/back button are code-drawn, not per-level art.

No code changed — docs and reference image only.

---

### Milestone 11 — Candy Garden world map art generated + compressed

Generated a world-select thumbnail and a level-path background for
Candy Garden (World 1) via AI image generation, matching the style of
the earlier reference mockup. Originals came in at 2.4MB and 2.8MB —
resized to their actual in-game display size (480x360 thumbnail,
600x900 scrollable path background) and re-encoded as JPEG (no alpha
needed for either), landing at 60KB and 175KB. Saved to
`public/assets/candy-garden-thumb.jpg` and `public/assets/candy-garden-
bg.jpg`.

Not done here: the other 9 worlds' art, and no code wired up yet
(`WorldSelectScene`/`LevelPathScene` from Milestone 10's plan don't
exist yet — this is art assets only).

---

### Milestone 12 — Remaining 9 worlds' art generated + compressed

Same treatment as Milestone 11, one world at a time: Jungle Jumble,
Ocean Words, Dino Valley, Cloud Kingdom, Crystal Forest, Magic
Mountain, Space Words, Ancient Valley, and WordSwoop Kingdom each got
a thumbnail (cropped from a square AI-gen source to 480x360) and a
level-path background (resized from a 1024x1536 portrait source to
600x900), re-encoded as JPEG at quality 82. File sizes landed in the
same 49-72KB (thumb) / 146-220KB (bg) range as Candy Garden. Saved to
`public/assets/<world-slug>-thumb.jpg` and `-bg.jpg`, each world
committed and pushed individually rather than in one batch.

All 10 worlds now have their World Map art. Still not done: any of the
code from Milestone 10's plan (`worlds.js`, the progress store,
`WorldSelectScene`, `LevelPathScene`) — art only, again.

---

### Milestone 13 — Progress store built

First piece of actual persistence in the game — `src/utils/
progressStore.js`, a localStorage-backed store that unblocks the rest
of the World Map plan from Milestone 10.

Rather than store "unlocked" flags directly, it stores only a set of
completed global level ids and derives all lock state from that on
demand (`isWorldUnlocked`, `isLevelUnlocked`), so there's a single
source of truth to update (`completeLevel(id)`) and no way for
"completed" and "unlocked" bookkeeping to drift apart. Lock rules
match the Milestone 10 decision exactly: World 1 always unlocked,
World N unlocks when World N-1's level 20 (its boss) is completed;
Level 1 of an unlocked world always unlocked, Level K unlocks when
Level K-1 in that world completes.

`levelIdFor(worldId, levelNum)` / `worldAndLevelFor(levelId)` bridge
the gap between `levels.js`'s flat global numbering (1, 2, 3, ...) and
the World Map's per-world numbering (1-20 within each world): world 1
= global ids 1-20, world 2 = 21-40, etc. Since only 5 real levels exist
in `levels.js` today, most ids past Candy Garden's first few will
currently resolve via `getLevel()`'s existing fallback rather than
unique content — a content gap, not a bug in the store itself; the
lock/unlock chain works correctly regardless of how much real content
sits behind each id.

Also added a console escape hatch, `window.__wordswoopResetProgress()`,
for testing the unlock chain without manually clearing localStorage.

Not done here: `worlds.js`, `WorldSelectScene`, `LevelPathScene`, or
wiring any of this into `BoardScene`'s win flow (currently `BoardScene`
doesn't call `completeLevel()` at all — that's the next batch).

---

### Milestone 14 — worlds.js data file

`src/data/worlds.js` lists all 10 worlds (id, name, slug) in play
order and derives each one's texture keys/asset paths and global
level-id range from that single slug + `progressStore.js`'s
`LEVELS_PER_WORLD`/`levelIdFor()` — so the level-numbering scheme
lives in exactly one place instead of being repeated here.

Listed all 10 worlds now (not just Candy Garden) since all 10 already
have art from Milestones 11-12 — no reason to hold the data file back
to one world when the assets it points to already exist for every
world. Only Candy Garden has real level content behind its range yet,
same caveat as Milestone 13.

Not done here: `WorldSelectScene`, `LevelPathScene`, wiring into
`BoardScene`.

---

### Milestone 15 — LevelPathScene built (Candy Garden)

`src/scenes/LevelPathScene.js` — the per-world node path screen from
the Milestone 10 plan. Shows a world's 20 levels as numbered nodes
over its background art, node 1 (Start signpost) at the bottom, node
20 (boss, gold ring) at the top, matching the decided bottom-to-top
reading direction. All node/lock/signpost visuals are code-drawn
(Phaser Graphics + text), not art assets, per the original plan.

Node coordinates come from a new `src/data/levelPaths.js` - hand-eyeballed
against `candy-garden-bg.jpg` for World 1 (a first pass, not
pixel-perfect against the art's organic curves), with a generic
sine-wave serpentine as a fallback for every other world until each
one gets the same hand-placement treatment (deferred - those worlds
aren't reachable yet anyway, only World 1 is unlocked at the start).

The background (600x900) is taller than the game's fixed 516x624
canvas, so the scene scrolls vertically by drag rather than shrinking
to fit - camera bounds are set to the scaled background height, and a
small pointer-drag handler pans `scrollY` between the top and bottom.
A drag-distance guard stops an accidental node/back-button tap from
firing mid-pan. View starts scrolled to the bottom, where Level 1 is.

Node state (locked / unlocked / completed) reads directly from
`progressStore.js` from Milestone 13. Tapping an unlocked node goes to
`BoardScene` with the right global level id; locked nodes do nothing.

Registered in `main.js`'s scene list so it's reachable for testing via
`game.scene.start('LevelPathScene', { worldId: 1 })` from the browser
console - nothing links to it in-game yet.

TEMPORARY: the Back button currently falls back to `MainMenuScene`
since `WorldSelectScene` (its real destination) doesn't exist yet -
flagged in a code comment to swap once that scene lands next.

Not done here: `WorldSelectScene`, wiring the Play button or
`BoardScene`'s win flow to any of this, hand-placed paths for the
other 9 worlds.

---

### Milestone 16 — WorldSelectScene built

`src/scenes/WorldSelectScene.js` — the World Map's entry screen. Shows
all 10 worlds as a 2-column grid of thumbnail tiles (5 rows - taller
than the fixed canvas, so it scrolls vertically by drag, same pattern
as `LevelPathScene`). Locked worlds (everything but Candy Garden,
until World 1's boss level 20 is completed) show greyed out via
`setTint` plus a dark overlay and the same code-drawn padlock icon
style as `LevelPathScene`. Tapping an unlocked tile goes to
`LevelPathScene` for that world; locked tiles do nothing.

This closes the loop `LevelPathScene`'s Back button was left pointing
away from in Milestone 15 - it now goes to `WorldSelectScene` instead
of the temporary `MainMenuScene` fallback. `WorldSelectScene`'s own
Back button goes to `MainMenuScene`.

Registered in `main.js`. Still nothing in-game links INTO
`WorldSelectScene` yet - the Main Menu's Play button still goes
straight to `BoardScene` Level 1, same as before. That's the last
piece (wiring the Play button + `BoardScene`'s win flow to actually
call `completeLevel()` and return to the path instead of chaining
global level ids) - next batch.

---

### Milestone 17 — World Map fully wired end-to-end

The last piece of the Milestone 10 plan: the actual navigation chain.

- `MainMenuScene`'s Play button now goes to `WorldSelectScene` instead
  of straight into `BoardScene` Level 1.
- `BoardScene` now accepts `worldId`/`levelNum` (passed by
  `LevelPathScene`) alongside the existing `levelId`. On a win, if
  `worldId` is set, it calls `completeLevel()` from `progressStore.js`
  - the first time anything in the game actually persists progress.
- "Next Level" now means "next level in this world" when reached via
  the World Map (computing the next global id via `levelIdFor()`)
  rather than the old flat global-id chain from `levels.js`. Beating a
  world's boss (level 20) instead shows a "World Map" button and
  returns to `WorldSelectScene`, since beating a boss may have just
  unlocked the next world - more useful than dropping the player
  straight into a world they didn't choose.
- The "Main Menu"/"Try Again" secondary button on loss now returns to
  `LevelPathScene` (relabeled "Level Path") when reached via the World
  Map, instead of always going to `MainMenuScene`.
- Direct/legacy `BoardScene` launches with no `worldId` (e.g. manual
  testing via the console) still work exactly as before, via the
  original `nextLevelId`/`getLevel()` global chain - nothing about
  that path changed.

Also updated `PLAN.md` §8.5 to mark the plan as built (all 10 worlds'
art, not just Candy Garden's) rather than leaving it reading as a
plan-only section now that it's implemented.

**Remaining gap, not a World Map issue:** only 5 real levels exist in
`levels.js` (as its own note has said since Milestone 8/9) - so every
level node past Candy Garden's first few, in every world, currently
loads placeholder content via `getLevel()`'s fallback rather than a
real target word or score target. Authoring the full 200-level list
(update.md's outstanding item 6, still open) is what actually fills
that in - the World Map itself now works correctly end to end
regardless of how much real content sits behind each node.

---

### Milestone 18 — Home Hub screen added between Main Menu and World Map

Per chat: the user provided a reference mockup for a richer "home"
screen and wanted it inserted between the existing splash/logo Main
Menu (Play button) and the World Map grid, rather than Play jumping
straight to the World Map as it did before.

New `src/scenes/HomeHubScene.js`, modeled on that mockup: a top bar
(avatar, name, currency, "+", settings gear), a left icon column (shop,
gallery, trophy, leaderboard), a right icon column (coin shop, daily
calendar, spin wheel, video reward), the existing menu logo plus a
"Word Map" ribbon and a decorative mini-map preview card (a few
code-drawn lock/star nodes, same visual language as the real World
Map - not interactive, just a teaser), and a real "Word Map" button at
the bottom.

Per explicit chat decision: every icon without a real system behind it
(both shop icons, gallery, trophy, leaderboard, calendar, spin wheel,
video) is shown fully styled and tappable rather than omitted or
greyed out - tapping one shows a "Coming Soon" toast. Avatar/name/
currency are placeholders (no account or economy system exists). Only
Settings (reset progress - duplicated from `MainMenuScene`'s panel,
same behavior) and the Word Map button are real.

Navigation updated: `MainMenuScene`'s Play button now goes to
`HomeHubScene` instead of straight to `WorldSelectScene`;
`WorldSelectScene`'s Back button now returns to `HomeHubScene` instead
of `MainMenuScene`, since Home Hub is the new middle layer. Full chain
is now: Main Menu (Play) -> Home Hub (Word Map button) -> World Map ->
Level Path -> Board, with Back buttons unwinding the same path.

All icons are code-drawn (rounded-rect badge + Unicode glyph) - no new
art assets needed, consistent with the lock/star glyph style already
used elsewhere. Settings-panel code is duplicated between
`MainMenuScene` and `HomeHubScene` rather than factored into a shared
file, matching the existing pattern of duplicating the drag-scroll
logic between `WorldSelectScene` and `LevelPathScene`.

---

### Milestone 19 — Home Hub real art, then a separate session's rework, then animations stripped back out

Three rounds of work landed on `HomeHubScene.js`/`MainMenuScene.js` in
quick succession, from two different chat sessions working on the same
repo - noting all three here since only the first was previously
logged.

**Round 1 (this session, commits `4aafc7c`/`6b08c66`):** swapped
Milestone 18's code-drawn top bar/banner/map-preview/icons for the
real generated art (forest bg, wood top bar, "Word Map" banner, map
preview parchment card cropped to a wide strip, 8 side icons re-keyed
for real alpha transparency since the source PNGs had a flat white
background baked in) and added a first animation pass (breathing Word
Map button, spinning wheel icon, pulsing calendar/currency button,
glowing map-preview star, floating letter blocks).

**Round 2 (a separate session, commits `a5821e8`/`3fe7a45`, not
previously logged here):** re-exported several icon assets at higher
resolution and swapped `menu-characters.png` for a `.jpg`; added a
`resolution: devicePixelRatio` setting to `main.js`'s Phaser config to
fix blurry UI (the fixed 516x624 canvas was being upscaled by both
Phaser's FIT mode and the device's own pixel ratio); replaced Round
1's bespoke per-element animations with a shared
`src/utils/effects.js` (`applyGlow`/`applyShine`/
`applyRandomIdleEffect`, picking one of exactly two idle-effect kinds
at random per element) and applied it everywhere Round 1 had used a
bespoke tween; and rebuilt `MainMenuScene` entirely around a single
poster art image (`menu-characters.jpg`) with a template-matched
`PLAY_BANNER_BOX` so the real interactive Play button crop lines up
pixel-for-pixel with the banner already painted into the poster,
replacing the previous layered logo/characters/button/badge/gear
approach.

**Round 3 (this session, commits `354e860`/`813562b`/`5d7369d`):**
per chat, review of an on-device screenshot found the Round 2
glow/shine effects (plus Round 1's semi-transparent white icon backing
card) were producing a "white blink" artifact - removed all of it
rather than reworking it further. Landed as three small batches:

1. Removed every `applyRandomIdleEffect()` call in `HomeHubScene.js`
   (the "+" currency button, every icon, the map preview's star node,
   the letter-block strip, the Word Map button) and the white backing
   rect behind every icon; dropped the spin-wheel icon from the right
   column entirely (not needed) - right column is 3 icons now (coin
   shop, calendar, video), left stays 4.
2. Removed the "Coming Soon" toast on icon tap (tap now just does the
   press-down/up bounce, nothing else) and removed the "Guest_Player"
   placeholder text from the top bar.
3. Removed the same `applyRandomIdleEffect()` call from
   `MainMenuScene`'s Play button.

`src/utils/effects.js` is unreferenced by any scene now - left in
place rather than deleted in case it's useful again, but nothing
currently imports it. The devicePixelRatio fix and the poster-based
`MainMenuScene` rebuild from Round 2 were untouched by Round 3 - only
the idle-animation layer was removed, not the underlying art/layout
changes.

**Still open, not addressed in any of the three rounds above:** icons
drifting out of their fixed column position on some devices, and
swapping the bottom "Word Map" button for the finished text-baked-in
banner art the person supplied
(`ChatGPT_Image_Sep_12__2026__01_42_03_PM.png`, not yet added to
`public/assets/`) instead of the current code-drawn rect+label.

---

### Milestone 20 — icon pop-out bug fixed, 3 more emoji/placeholder swaps for real art

Per chat, a device screenshot showed icons visibly "popping out" of
their slot on tap. Root cause: `createColumnIcon()`'s icons are 280x280
native art shown at 42x42 via `setDisplaySize()` (an implicit base
scale of ~0.15), but the tap-bounce tween set `scale: 0.88` directly -
Phaser's `scale` is absolute, not relative to display size, so tapping
any icon jumped it to ~0.88 absolute scale (~6x its real size) for the
duration of the bounce. Fixed by capturing `baseScale = icon.scale`
right after `setDisplaySize()` and tweening to `baseScale * 0.88` /
`baseScale` instead - same pattern `MainMenuScene`'s Play button
already used correctly. Applied the same fix while wiring in the new
image-based buttons below, so neither repeats the bug.

Also landed, closing out the "still open" item above plus two new
emoji-to-real-art swaps the person asked for:

- **Bottom Word Map button** - replaced the code-drawn blue rounded
  rect + text label with the finished banner art the person sent
  (`word-map-button.png`, "Word Map" already baked into the art,
  already background-removed on their end). Image is the whole button
  now, same tap/navigate behavior as before.
- **Settings button** - replaced the `\u2699` gear emoji + purple
  circle with real wooden gear icon art (`icon-settings.png`). New
  `createImageIconButton()` helper added alongside the existing
  `createSmallIconButton()` (emoji+circle) since the currency "+"
  button still uses the old style - only settings was swapped here.
- **Currency icon** - replaced the `\u{1F451}` crown emoji with a real
  blue gem icon (`icon-gem.png`). Static display only, not a button.

All three new assets arrived already background-removed by the person
- just trimmed/resized/compressed on our end, no alpha re-keying
needed this time (unlike the original 8 side icons in Milestone 19).

**Still open:** icons drifting out of their column position on some
devices - the pop-out *bug* above is fixed, but the earlier *layout
drift* complaint from the Milestone 19 open-issue note hasn't been
specifically re-verified since.

---

### Milestone 21 — Settings rebuilt as its own scrollable scene, filling in one section at a time

Per chat: expanding Settings from "Reset Progress + Close" to a real
list (Account, Audio, Notifications, Support & Legal, Data, About).
The old 220px-tall popup panel in `HomeHubScene` couldn't fit that, so
it's been replaced outright with `src/scenes/SettingsScene.js` — a
full scene using the same fixed-HUD + drag/wheel-scroll pattern as
`WorldSelectScene`/`LevelPathScene`, reached via `scene.start` from the
Home Hub's settings gear instead of an overlay. `HomeHubScene`'s old
`openSettings()`/reset-confirm/button-factory code (the whole
"Settings" block at the bottom of the file) is deleted, not kept
alongside the new scene.

All six sections render now so the whole surface is navigable, but
each row is only wired up in the commit that actually builds it —
until then it renders as a visibly-dimmed row with a "Coming soon"
note (never just omitted). This first pass:

- **Data → Reset Progress**: real, carried over from the old popup
  (same tap-to-arm / tap-again-to-confirm pattern, 2.5s to reset before
  it disarms).
- **About**: real. Version reads live from `package.json` (imported
  directly — Vite supports JSON imports, no build config needed) so it
  never drifts from the actual shipped version; Credits is static
  "Wobblewing Studios" text.
- **Account, Audio, Notifications, Support & Legal, Data → Sign Out**:
  placeholder rows only, landing in their own follow-up commits per
  chat. Account is specifically blocked on the Google sign-in /
  Supabase decision noted below; Notifications is intentionally left
  as placeholder-only for now per chat, not because of a technical
  blocker like Account.

New `src/utils/settingsStore.js` also added (localStorage, same
pattern as `progressStore.js`) with `musicOn`/`sfxOn`/`hapticsOn`
getters/setters — not wired to any row yet (that's the Audio section's
own commit), added now so it's ready to plug into. Worth noting for
whoever builds Audio/Notifications next: there's currently no audio
system in the codebase at all (no `this.sound` usage anywhere) and no
Capacitor dependency installed (`package.json` only has `phaser` +
`vite` — no `@capacitor/*` packages, no `capacitor.config` file),
despite PLAN.md listing Capacitor as the intended stack. So Music/SFX
toggles will need real audio assets + a sound setup before they control
anything, and Vibration needs `@capacitor/haptics` added first.

### Milestone 22 — Support & Legal: Privacy/Terms/Contact wired up (placeholder destinations)

Per chat, the Support & Legal section of `SettingsScene` is real now
for three of its five rows — new `addLinkRow()` helper opens a URL via
`window.open(url, '_blank', 'noopener')` on tap:

- **Privacy Policy** / **Terms of Service** → placeholder URLs
  (`PLACEHOLDER_PRIVACY_URL`/`PLACEHOLDER_TERMS_URL` constants at the
  top of the file) since neither page exists yet — swap these once
  they're published.
- **Contact Support** → `mailto:wordswoop@gmail.com`. Per chat this was
  meant to be a studio-level address rather than a per-game one, but
  that address doesn't exist yet, so this is the placeholder until it
  does (`SUPPORT_EMAIL` constant, same file).

**Rate the App** and **Restore Purchases** stay as "Coming soon"
placeholders, not converted to dead links — no store listing exists
yet for the former, no IAP/RevenueCat setup exists yet for the latter
(see Milestone 21's note on the codebase having neither).

### Milestone 23 — Audio toggles: real switches, persisted, silently no-op

Per chat, Music/Sound effects/Vibration in `SettingsScene` are real
toggle rows now — new `addToggleRow()` helper (track + knob, tap to
flip, tween on state change) reads its initial state from and writes
changes to `settingsStore.js` (added last commit, unused until now).

As flagged when the store was added: there is still no audio system in
the codebase and no `@capacitor/haptics` dependency, so these toggles
persist a real preference across reloads but don't control any actual
sound or vibration yet — nothing plays audio or vibrates regardless of
switch position. `isMusicOn()`/`isSfxOn()`/`isHapticsOn()` are the
getters whatever adds real audio/haptics next should check before
playing anything.

### Milestone 24 — Home Hub sizing pass: bigger icons, wider top bar, "+" button removed

Per chat, off a screenshot review, before moving on to the next
feature set:

- **Side icon columns** (shop/gallery/trophy/leaderboard left,
  coin-shop/calendar/video right): display size 42px -> 58px. Gap
  between icons grown from 78px to 96px (more than the size increase
  alone) so the bigger icons still clear each other with room, not
  edge-to-edge. Column x-offsets adjusted (16px margin -> 12px, right
  column's inset now sized off the new 64px hit-box) to keep both
  columns hugging the same edges as before rather than drifting inward.
- **Top wood bar**: widened from `width - 20` to `width - 8` and
  thickened from 64px to 74px tall, so it reads as a proper substantial
  header rather than a thin strip.
- **Settings icon**: 34px -> 46px. **Currency gem**: 20px -> 30px
  (avatar circle bumped slightly too, 36px -> 40px, to stay
  proportional with the thicker bar). `createImageIconButton()` now
  takes an optional `size` param instead of a hardcoded 34, so this and
  future icon buttons can each pick their own size.
- **"+" add-currency button removed entirely** - there's no economy
  system for it to add currency to yet, so per chat it's gone rather
  than kept as a dead tap target. `createSmallIconButton()` (the
  color-circle-+-glyph button factory, only ever used for this one
  button) removed too rather than left as dead code.

Checked the arithmetic for collisions rather than eyeballing it: at the
new sizes, the tallest column (left, 4 icons) runs from y=92 to y=444;
the map-preview card sits at x=93-423, both icon columns sit outside
that horizontally (left: x=12-76, right: x=440-504) regardless of
vertical position, so there's no overlap in either axis. Top-bar
elements (avatar/gem+label/settings) checked the same way - closest
gap is ~30px between the gem's currency label and the settings icon.

### Milestone 25 — Supabase schema *designed* (see correction below — it was never actually applied)

**Correction, added later:** despite this milestone's title and the
several later references to this schema as "live," the SQL below was
never actually run against the real Supabase project. This surfaced
when the Leaderboard's migration (Milestone 32) failed with `relation
"public.wordswoop_profiles" does not exist`. Google sign-in itself
worked fine (that's Supabase Auth, a separate system from this
table), which is presumably why the gap went unnoticed for 7
milestones. The full schema (table + both triggers + RLS + the
leaderboard view) was finally applied together as part of Milestone
32's fix. Anyone who signed in before that had no profile row
created — see Milestone 32 for why they need to sign out/in once more.

Per chat, decided: guest play stays fully unblocked (Home Hub, World
Map, levels — everything) with no forced sign-in wall; sign-in is only
prompted at natural checkpoints (Settings' guest row, eventually first
level win), matching how Candy Crush/Bookworm-style casual games do
it, since gating the map behind an account before anyone's even seen
the game is a conversion killer. First-sign-in behavior for a guest
with existing local progress: merge (union `completedLevelIds` into
the cloud row), never overwrite — a guest could have real progress
worth keeping.

Reusing Kid Number Adventure's existing Supabase project
(`kaeiaiesavwsebyhkgig`, org `doxxedghostman's Project`) rather than
creating a new one, per chat — it had zero tables/migrations before
this, so nothing was retrofitted. Since one project now serves two
separate games, every WordSwoop table is `wordswoop_`-prefixed to
avoid colliding with whatever KNA adds later.

Applied three migrations:

- **`create_wordswoop_profiles`** — one row per authenticated user
  (`id` = `auth.users.id`, cascade-deleted with the auth user). Columns:
  `display_name`, `avatar_url`, `gems` (int, default 0),
  `completed_level_ids` (jsonb array, mirrors `progressStore.js`'s
  local shape), `settings` (jsonb, mirrors `settingsStore.js`'s
  musicOn/sfxOn/hapticsOn), `created_at`/`updated_at`. RLS on, with
  select/insert/update policies all scoped to `auth.uid() = id` — a
  user can only ever touch their own row. `wordswoop_set_updated_at()`
  trigger keeps `updated_at` current on every write without relying on
  the client to set it. `wordswoop_handle_new_user()` trigger on
  `auth.users` insert auto-creates the profile row on first sign-in,
  pre-filled from whatever the OAuth provider returned — checks both
  `full_name`/`name` and `avatar_url`/`picture` keys in
  `raw_user_meta_data` since the field name varies by provider
  version (Google's response includes a profile photo URL under one
  of these).
- **`harden_wordswoop_trigger_functions`** — the security advisor
  (`Supabase:get_advisors`) flagged `wordswoop_set_updated_at` as
  missing a pinned `search_path` (recreated with `security invoker` +
  `set search_path = public`), and `wordswoop_handle_new_user` as a
  `SECURITY DEFINER` function directly callable via the exposed REST
  RPC endpoint rather than only through its trigger. Revoked EXECUTE
  from `anon`/`authenticated` for the latter.
- **`revoke_public_execute_on_handle_new_user`** — the previous
  per-role revoke didn't actually clear the lint, because Postgres
  grants EXECUTE to the `PUBLIC` pseudo-role by default on function
  creation and both `anon`/`authenticated` were resolving through that
  implicit grant, not a role-specific one. Revoking from `PUBLIC`
  itself cleared it. Re-ran `get_advisors` after — zero findings.

**Still needed before any of this is reachable from the game:**
enabling the Google provider in Supabase Auth needs a Google Cloud
OAuth client ID/secret, which can't be created from here (requires a
Google Cloud Console project under the person's account) — open
question whether Kid Number Adventure already has one to reuse or a
new one's needed. Client side: `@supabase/supabase-js` isn't installed
yet, and none of `SettingsScene`'s Account-section placeholder rows
are wired to real auth calls yet.

### Milestone 26 — Map preview removed, Home Hub spacing pass, looping waterfall background

Per chat, the decorative mini map preview (parchment card + code-drawn
dashed path + lock/star nodes, see Milestone 18-20 for when that was
built) is gone entirely from the Home Hub. First pass only pulled the
dashed path/nodes off the card and left the parchment card itself in
place — but the card doesn't shrink just because what's drawn on it
does, so there was nothing for the letter-block strip to move up into.
Person confirmed: drop the whole card. `createLogoAndMapPreview()` no
longer creates the card/frame/path/nodes at all; `mapPreviewBottom` is
now derived from the ribbon/"Word Map" text position instead of the
(now nonexistent) card's bottom edge, and the letter-block strip sits
directly under that.

Follow-up spacing/sizing pass once that was live, all per chat against
a screenshot of the result:

- **Letter blocks were sitting too close to the logo** now that the
  card's ~130px of vertical space is gone - gap from the ribbon text
  widened 26px -> 55px.
- **All 7 side icons enlarged again** (58px -> 74px display, hit box
  64px -> 82px) - second enlargement pass on top of Milestone 24's,
  person wants them bigger still. Gap between icons in each column
  grown proportionally more than the size increase (96px -> 108px) to
  keep clearance, same "grow the gap by more than the size" approach
  as Milestone 24. Right column's x-offset (`width - 12 - <hitbox>`)
  updated to match the new 82px hit box, otherwise the column would've
  sat 18px further right than intended and clipped closer to the edge.
- **"Word Map" button nudged up** from flush-bottom (`height - 44`) to
  `height - 62` - it read as sitting right on the bottom edge.
- **Logo art swapped** for a new transparent-background version the
  person generated and sent over (`menu-logo.png` replaced in place,
  same asset key, no code changes needed beyond the file itself).

Checked math on the enlarged icons before shipping: left column (4
icons, gap 108) runs y=92 to y=498; right column (3 icons) runs y=92
to y=390. Word Map button's top edge lands ~y=516 at its new position
- 18px clear of the left column's bottom, no overlap.

**Looping waterfall background.** Person generated a 5s image-to-video
clip (PixVerse) from a painted forest/waterfall reference image, with
a prompt asking for static camera + only water/foliage motion. What
came back instead was a continuous camera move - push in on the falls,
then pull back out to a wider mountain view - plus a baked-in
"PixVerse.ai" watermark (fixed screen position, doesn't move with the
zoom). Person had used up their generation credits, so re-generating
wasn't an option; fixed the existing clip instead:

- **Watermark removed** by cropping the fixed watermark region every
  frame, box-blurring just that crop, and compositing it back over the
  original at the same position (`crop` -> `boxblur` -> `overlay` in
  one filter graph) - cheaper than a proper inpaint/delogo and the
  region is sky/cloud, so a blurred patch reads as atmospheric haze
  rather than an obvious edit.
- **Made it loop seamlessly despite the camera move** with a boomerang
  (play the (now watermark-blurred) clip forward, then the same clip
  reversed, concatenated) rather than trying to crossfade a loop point
  - a boomerang is guaranteed to return to the exact starting frame by
  construction, no matching-frames search needed. Net effect: the
  background now reads as a slow zoom-in/zoom-out breathing motion
  rather than the originally-intended fully-static shot, which the
  person accepted after previewing it (trade-off explicitly surfaced
  before wiring it in, not discovered after).
- Re-encoded smaller for a mobile background (832x1024 -> 624x768,
  ~8.2MB -> ~3.75MB) and stripped the audio track entirely - not
  needed for a background loop and it doesn't loop cleanly with the
  boomerang anyway.
- `HomeHubScene.createBackground()` now tries `this.add.video(...)`
  first (muted, looped, scaled to cover exactly like the old static
  image), falling back to the original `forest-background.jpg` image
  if video creation throws - some mobile browsers block autoplay even
  when muted, or don't support the format, and a dead background is
  worse than a static one.

### Milestone 27 — Diagnosed the "blurry/faded" background report, swapped in a proper static-camera loop

Person flagged the Home Hub background as looking blurry/faded after
Milestone 26 shipped. Wasn't actual blur - confirmed by compositing a
video frame with the scene's existing 45%-opacity dark overlay
rectangle offline (Python/PIL) and reproducing the exact washed-out
look from the screenshot. The overlay's opacity had been unchanged
since it was sized for the old *static* forest-background.jpg; the
video's own naturally brighter/hazier palette stacked with that same
0.45 alpha read as "faded" in a way the static image never had.
Fixed by dropping the overlay to 0.15 - confirmed against the same
composite test before shipping, not just by eye in-engine.

Separately, the person supplied a new source clip
(`waterfall_nature_loop.mp4`, 832x1120, 6s, no audio) - genuinely
static-camera this time (first/last frames match almost exactly,
confirmed by diffing them), which sidesteps the Milestone 26 clip's
camera-drift problem entirely. Traded one problem for a different
constraint though: this clip's watermark ("CapCutAI", top-left) sits
over detailed foliage/sky rather than the previous clip's plain sky,
and a boomerang loop was no longer an option - reversing a *waterfall*
specifically (water visibly flowing upward) is far more noticeable
than reversing a camera pan, so a straight crossfade loop was used
instead (1s crossfade blending the tail into the head via `xfade`,
built with `trim`/`split`/`concat` rather than a hard cut).

Watermark removal took three attempts to get fully illegible rather
than just faded: a feathered mask (blurred-edge rounded rect) driving
`maskedmerge` between the sharp and blurred frame gave clean edges,
but the first two blur strengths (sigma 14, then 22) still left a
faint ghost of the bold white text readable through the blur - bold
high-contrast text needs a much larger blur radius to fully smear away
than the previous clip's plain-sky watermark did. sigma=45 (final:
60, for margin) was what actually made it illegible, confirmed by
direct crop-and-zoom inspection, not assumed from the filter graph
alone. Re-encoded to 624x840 for size (~3.4MB -> ~1.3MB).

`HomeHubScene.js` changes: swapped `hub-background-loop.mp4` for the
new clip (same asset key, no scene code changes needed there), updated
the fallback natural-size constants (768 -> 840) used when
`video.height` isn't populated yet, and the overlay opacity fix above.

### Milestone 26 — Supabase client wired in (WIP, not yet reachable from UI)

Checkpoint commit — installed `@supabase/supabase-js` and added
`src/utils/supabaseClient.js` (shared client instance, pointed at the
KNA project's URL + publishable key from Milestone 25). Also added
`setCompletedLevelIds()` to `progressStore.js` — a bulk-replace used by
the upcoming guest->cloud merge-on-sign-in logic (union of local +
cloud completed levels, written back so both agree), as opposed to
`completeLevel()` which stays the one-at-a-time path normal gameplay
uses.

Committed now rather than held pending, since multiple recent commits
have landed on `main` from elsewhere (mobile editor) while this was in
progress — two rounds of stash/pull/reapply already happened this
session (the Capacitor Android scaffold + immersive-mode commits
landed in between). Committing checkpoints as they're verified avoids
compounding that conflict risk further.

**Not done yet:** no auth store (sign-in/sign-out/session functions),
`SettingsScene`'s Account rows are still the same placeholders from
Milestone 21 — none of this is reachable from the UI yet. Also still
blocked on the Google OAuth client ID/secret from KNA before the
provider can be enabled in Supabase and any of this becomes testable
end-to-end.

### Milestone 27 — Found the real cause of the persistent purple strip: stale CSS, not a background-art or scale bug

Per chat (screenshots showing a purple gap above the top bar on both
the Home Hub and Main Menu, "it keep showing" despite Milestone
whatever's edge-to-edge/immersive work) — this was never a background
image sizing problem. `MainActivity.java`'s "fully immersive" change
already made the native side hide the system bars entirely rather than
just making them transparent (its own code comment already correctly
diagnosed the mechanism: a transparent-but-present bar still reserves
its height as a gap). But `index.html`'s `body` rule still had:

```css
padding: env(safe-area-inset-top) env(safe-area-inset-right)
  env(safe-area-inset-bottom) env(safe-area-inset-left);
```

left over from before the app went immersive — originally meant to
keep content clear of notches on an ordinary (non-immersive) mobile
browser tab. With the system bars now fully hidden natively, this was
reserving space for a status bar that no longer exists, which is
exactly the fixed-height purple strip in the screenshots — present on
every scene (Home Hub, Main Menu, "inside the word map" too) because
it's a global `body` rule, not anything scene-specific. Removed the
padding rule entirely (not zeroed - a rule left "just in case" is what
caused this) and left a comment explaining why, and where a *real*
notch/cutout fix should live instead if one's ever needed (a targeted
HUD-layout adjustment in the specific scene, not global body padding).

Verified in the built output (`dist/index.html`) that the padding rule
itself is gone post-build, not just in source.

### Milestone 28 — Main Menu poster now fills the screen (cover, not contain); purple fallback color replaced everywhere

Per chat, off two more screenshots: Milestone 27's CSS fix made the
Home Hub "manageable" but Main Menu still had an obvious flat-color
strip - a genuinely different bug, not the same one recurring.

**Root cause:** `MainMenuScene`'s poster art was deliberately shown at
"contain" scale (`Math.min` of the two axis ratios) - fits the whole
720x1482 poster on screen with no cropping, letterboxing the leftover
space instead. That was a reasonable choice on the old, squarer
516x624 canvas; on the current 516x1118 canvas (stretched to match
real phone aspect ratios per Milestone whatever changed
`CANVAS_SIZE`), this poster's proportions vs. the canvas's proportions
put a visible gap at the top/bottom - and unlike the Home Hub (which
has a wood top bar sitting over the equivalent area), Main Menu has
nothing covering it, so it read as an obvious mistake. Switched the
scale calc to `Math.max` ("cover") - poster now fills the canvas edge
to edge, cropping a small amount off the sides instead (fine here
since the poster's composition - logo, characters, Play banner - is
centered, not near the edges).

**Also, per chat:** consolidated every hardcoded occurrence of the old
purple fallback color (`0x241a3d` / `#241a3d`, 17 call sites across 7
scene files, `main.js`, and `index.html`) into three shared constants
in `config.js` - `APP_BG_COLOR` (Phaser fill color, number),
`APP_BG_COLOR_HEX` (CSS string), `APP_BG_COLOR_RGB` (array, for
`Camera.fadeOut()`'s separate r/g/b args) - and changed the color
itself to a dark forest green (`#17241b`) that blends with the actual
art (both the bright alpine Home Hub and the dusky Main Menu poster)
instead of a distinctly different brand-purple that looks wrong
wherever it's visible. `index.html` can't import the JS constant
directly (it's plain CSS in a static file), so it's hardcoded there
too with a comment to keep it in sync by hand if it ever changes.

Deliberately left the semi-transparent top-bar HUD chrome in
`WorldSelectScene`/`SettingsScene`/`LevelPathScene` using this same
constant rather than carving out an exception - those bars already
shared the exact same hex, and having two different "dark" tones
side by side (old purple bars vs. new green backgrounds) would've
looked more inconsistent than helped.

### Milestone 29 — Google sign-in is real now: auth store, Settings wiring, guest→cloud merge

Per chat: Google OAuth is enabled in Supabase (reusing an existing
Google Cloud client already used by another of the person's live
apps, sharing that Supabase project's identity pool - a deliberate
choice per chat, not an accident). This lands the client-side half
that makes it actually usable from WordSwoop.

**New `src/utils/authStore.js`:**

- `initAuth()` — called once from `main.js` at boot (fire-and-forget,
  doesn't block Phaser starting - guest play never waits on auth).
  Restores an existing session via `supabase.auth.getSession()`, then
  subscribes to `onAuthStateChange` for the rest of the app's life.
- `signInWithGoogle()` — full-page redirect (`signInWithOAuth`), not a
  popup. Popup-based OAuth is unreliable/blocked in WebViews on some
  Android versions; a plain redirect works identically everywhere,
  including inside the Capacitor WebView this app ships in.
- `signOut()`, `getCurrentUser()`, `isSignedIn()`, `getDisplayName()`,
  `getAvatarUrl()` (checks both `avatar_url`/`picture` and
  `full_name`/`name` metadata keys, matching the variance already
  handled server-side in `wordswoop_handle_new_user`'s SQL).
- `onAuthChange(callback)` — pub/sub for scenes to react to sign-in/out
  without polling; fires immediately with current state on subscribe.
- `mergeGuestProgressIntoCloud()` — runs automatically the moment
  `initAuth`'s listener sees signed-out -> signed-in. Implements the
  decision from Milestone 25: unions local + cloud
  `completed_level_ids` and writes the merged set to both sides (never
  a plain overwrite either direction). For `settings`, distinguishes a
  genuinely first sync (cloud row's `created_at === updated_at`, i.e.
  untouched since the auto-provisioning trigger created it) from a
  returning sign-in: first sync pushes local settings up; any later
  sign-in instead pulls the cloud's settings down over local, so a
  second device doesn't clobber preferences already saved from the
  first.

**`SettingsScene`'s Account section is real now**, not a placeholder:
signed-out shows a working "Sign in with Google" row + "Playing as
guest" status; signed-in shows the Google display name and avatar
(loaded as a real texture in `preload()`, circle-masked, falling back
to the plain placeholder circle if no avatar URL exists) + "Data is
synced" status. The whole scene re-`scene.restart()`s on any
`onAuthChange` firing while it's open, rather than hand-patching
individual rows - simplest correct option given how few rows actually
depend on auth state. Data section's **Sign Out is real now** too
(hidden/disabled-looking when already signed out, since it's
meaningless without a session).

**Still not built:** Delete account/delete data (needs care - actually
deleting an `auth.users` row requires the service-role key, which
can't safely live in client code; this needs a Supabase Edge Function,
not a direct client call - separate follow-up). Display-name editing
and a custom avatar picker (currently only Google's own name/photo are
shown, nothing overridable yet).

### Milestone 30 — Settings polish, sign-in/security fixes, and Home Hub icon trim (batch of 9 commits made outside a Claude session)

These landed directly on `main` between sessions and are being logged
here retroactively so the docs catch back up to the code.

**Settings (`SettingsScene.js`):**

- Bigger/bolder section headers, with sections collapsed by default
  instead of all expanded at once — the full row list (Account, Audio,
  Notifications, Support/Legal, Data, About) was too much to scan at a
  glance otherwise.
- Real wood/parchment panel art behind each section, replacing the
  earlier flat colored boxes.
- Fixed text overlapping the wood-knot/scroll-curl cap art once that
  panel art was in place.

**Sign-in / security:**

- Google sign-in now routes through the system browser instead of an
  in-app WebView — some Android WebViews block or flake on Google's
  OAuth consent screen; a system-browser redirect is the reliable path
  and is what Milestone 29 intended, just not yet how it launched.
- Fixed a moderate Dependabot alert: overrode a transitive `uuid`
  dependency (pulled in by the Capacitor packages added earlier) to a
  patched version.
- Fixed a stale purple color hardcoded in the native Android
  `colors.xml` — missed when the in-JS purple fallback was
  consolidated into `APP_BG_COLOR`/forest-green (Milestone 28); the
  native splash/status-bar chrome was still showing the old color
  since that file lives outside the JS bundle.

**Layout / orientation:**

- Fixed the Home Hub letterbox gap by matching the canvas aspect ratio
  to the real device instead of a fixed ratio, closing a visible strip
  of empty space on some screen sizes.
- App locked to portrait orientation, and the letterbox color switched
  from forest green to a light creamy tan — green read fine over the
  in-scene art but looked wrong as a neutral border color once actual
  devices with varied aspect ratios were tested.

**Home Hub icon set trimmed from 8 to 4** (`HomeHubScene.js`): kept
Shop, Leaderboard, Calendar (daily rewards), and Video (rewarded ads);
cut Gallery, Trophy, and Coin Shop rather than leaving them as inert
decoration — they're collection/achievement polish that only pays off
once there's real content depth (levels, cosmetics) to reward, which
doesn't exist yet at 5 demo levels. Coin Shop folded into Shop rather
than kept as a second currency store. Also removed the duplicate "Word
Map" wood-ribbon banner that sat above the letter-block strip (it
labeled the same destination as the real Word Map button at the
bottom, with no functionality of its own), and added a slow, small
vertical float to the 4 remaining side icons for a bit of life (y-only
tween, no alpha/tint — a different mechanism from the glow/shine pass
removed in Milestone 26 for its "white blink" artifact, so it isn't
expected to reproduce that bug).

### Milestone 31 — Calendar (daily rewards) is real, plus the gem balance and a minimal booster inventory to back it

Per chat: of the 4 Home Hub icons, Calendar was picked to build first
(cheapest, highest retention value, no dependency on an economy or an
ad SDK existing first). This also required building two things that
didn't exist at all yet — gems were purely a display value (hardcoded
"0"), and Bomb/Shuffle boosters were only ever documented in PLAN.md
§14 as "planned, not built."

**New `src/utils/currencyStore.js`** — the first real gem balance,
localStorage-backed (same pattern as `progressStore.js`/
`settingsStore.js`). `getGems()`/`addGems(amount)`. Local-only for
now, same as progress — `wordswoop_profiles.gems` already exists in
Supabase (Milestone 25) but nothing client-side reads/writes it;
wiring real cloud sync (with the same guest-merge care
`completedLevelIds` gets) is separate follow-up work.

**New `src/utils/boosterStore.js`** — deliberately minimal: just a
count per booster type (`bomb`, `shuffle`) in localStorage. Makes
Bomb/Shuffle a real, grantable thing for the first time, but does
**not** make them usable — spending one on the board is separate,
bigger follow-up work (BoardScene needs a way to consume one and
apply its effect). Chosen over the alternative (skip the item reward
entirely until boosters are fully built) per chat, since a small
always-visible inventory now was worth it over a delayed reward.

**New `src/utils/dailyRewardStore.js`** — the actual 7-day cycle
logic. Reward schedule (per chat): days 1-3 pay 3 gems, days 4-6 pay 5
gems, day 7 pays one random booster instead of gems. Dates are
compared as local `YYYY-MM-DD` strings, not timestamps, so "today"
matches the player's own calendar day. `getStatus()` is read-only
(viewing the screen never consumes a claim or resets a streak) —
`claimToday()` is the only thing that mutates state. Missing a day
(last claim isn't today or yesterday) resets the streak to Day 1 on
the next claim, per chat's explicit choice of the stricter reset
pattern over a softer pause.

**New `src/scenes/CalendarScene.js`** — the display. Per chat's
direction to make this bolder than the rest of the app and to reuse
existing art rather than invent a new visual language: wood/parchment
textures and the gem icon are the same source files as
`SettingsScene`'s (loaded under their own scene-local keys, matching
the codebase's existing per-scene asset-ownership convention), and the
background is a warm cream/light-brown fill using the existing
`LETTERBOX_BG_COLOR` constant (already the "warm border" tone picked
for the app's letterbox — see `config.js`) instead of the app's usual
dark forest-green scene background. Layout: a 4-across-then-3-across
grid of 7 day cards (7 doesn't divide evenly into a rectangle; 4+3
reads better than 5+2), today's card pulses with a bold gold
border, claimed days show a green checkmark, future days sit at
reduced opacity, and a bottom button reads "CLAIM REWARD" (green,
tappable) or "COME BACK TOMORROW" (grey, disabled) depending on
`getStatus().claimedToday`. Day 7's card shows a gift emoji rather
than a gem count/icon (no dedicated Bomb/Shuffle art exists yet).
Wired into `main.js`'s scene list and reachable from Home Hub's
Calendar icon, which previously just showed a "coming soon" toast like
its 3 sibling icons — that toast path stays for Shop/Leaderboard/Video.

**Home Hub's currency display** now reads `currencyStore.getGems()`
instead of the hardcoded `'0'` it showed since it was first built.

### Milestone 32 — Leaderboard is real; profile syncs on every win/claim, not just first sign-in

Per chat, built directly (not batch by batch) right after Calendar.

**Problem:** `wordswoop_profiles` RLS (Milestone 25) scopes select to
`auth.uid() = id` - correct for account data, but it makes a
leaderboard query impossible as written (nobody can read anyone else's
row, including their own opponent's). Needed a way to expose a public,
limited slice (name/avatar/gems/levels) without loosening the base
table's RLS.

**Required one-time SQL (not run by Claude - this project,
`kaeiaiesavwsebyhkgig`, isn't one the connected Supabase tool has
access to; hand this to the SQL editor directly):**

```sql
create or replace view public.wordswoop_leaderboard as
select
  id,
  display_name,
  avatar_url,
  gems,
  jsonb_array_length(coalesce(completed_level_ids, '[]'::jsonb)) as levels_completed
from public.wordswoop_profiles;

grant select on public.wordswoop_leaderboard to anon, authenticated;
```

A view is owned by whoever creates it (the SQL editor runs as a
privileged role), so it can read every row of the RLS'd base table
while only ever exposing these four columns - no email, no raw id
beyond what's needed for the query, no way to touch the base table
through it (it's not updatable). Standard Postgres/Supabase pattern
for "public read of a slice of a privately-RLS'd table."

**New `authStore.js` export: `syncLocalProgressToCloud()`** - pushes
the signed-in user's current local `completed_level_ids` + `gems` up
to their `wordswoop_profiles` row. A no-op for guests. Until now,
`wordswoop_profiles` only ever got written once, at the moment of
first sign-in (`mergeGuestProgressIntoCloud`) - every level won or
gem earned afterward stayed local-only, so the leaderboard (or
anything else reading the cloud row) would go stale the moment someone
started playing post-sign-in. Wired into the two places that change
either value: `BoardScene`'s level-win handler and `CalendarScene`'s
claim handler. Fire-and-forget (not awaited at either call site), same
philosophy as `initAuth()` - a failed sync shouldn't interrupt
gameplay.

**New `src/scenes/LeaderboardScene.js`** - queries the view above for
the top 10 by gems, renders a plain ranked list (gold/silver/bronze
rank color for the top 3, parchment-colored rows, gem-icon-emoji +
count) rather than reusing Calendar's card grid, since a ranked list
doesn't fit that shape. If the view doesn't exist yet (migration not
yet run) or returns nothing, shows an empty state instead of erroring
visibly. Not signed in → an additional "sign in to join" line, since
guests have no cloud profile row to ever appear in this at all.

Wired into `main.js`'s scene list and Home Hub's Leaderboard icon
(previously a "coming soon" toast, matching Calendar's pattern from
Milestone 31).

### Milestone 33 — Video (Watch to Earn) is real: rewarded AdMob ads

Real AdMob account/ad unit, created by Ayobami in this session (not a
placeholder or test ID):

- App ID: `ca-app-pub-2830006716687955~2244040404`
- Rewarded ad unit ID: `ca-app-pub-2830006716687955/8286704574`
- Ad format is plain **Rewarded**, not "Rewarded interstitial" - the
  latter auto-triggers at breaks like level completion, which doesn't
  match an icon the player has to tap.
- Reward configured in AdMob's own dashboard as "10 Gems" purely so
  its reporting matches reality - the actual grant amount lives in
  `adsStore.js`, not read from AdMob's config at runtime.

**Added `@capacitor-community/admob@8.1.0`.** App ID placed in
`android/app/src/main/AndroidManifest.xml` as the
`com.google.android.gms.ads.APPLICATION_ID` meta-data (this ID is
meant to be public - it identifies the app to the SDK, not a secret);
also added the `ACCESS_NETWORK_STATE` permission AdMob expects.
`npx cap sync android` run to register the plugin.

**New `src/utils/adsStore.js`** — `initAds()` (called once at boot,
`main.js`, no-op on web) and `showRewardedAd()`, which loads and shows
the ad and resolves with `{ granted, amount }` or `{ granted: false,
reason }`. Gems are only granted if the resolved reward amount is
`> 0` — the plugin's web/browser stub always resolves with `amount: 0`
(same as a native ad genuinely dismissed before completion), so both
"running in a dev preview" and "closed the ad early" fall through the
same no-grant path without needing separate platform-check logic.

**Wired into Home Hub's Video icon**
(`HomeHubScene.handleWatchToEarn()`), previously a "coming soon"
toast: shows a "Loading ad…" toast, then either grants gems + syncs
to cloud (signed-in players) + refreshes the currency display, or
shows a toast explaining why not (not on native, closed early, or no
ad available).

**Not yet tested on-device** — this was built and build-verified in
this chat session; Ayobami still needs to run
`npm run build && npx cap sync android` then open/run it in Android
Studio to confirm a real ad actually loads and pays out on a phone.

### Milestone 34 — Lives, Bomb, and the Shuffle economy are all real; Watch to Earn's reward is now a weighted pool instead of always gems

Per chat, built directly (not batch by batch).

**New `src/utils/livesStore.js`** — 5 max, lose 1 on a failed level,
regenerate +1 every 30 min. Regen is computed lazily from an elapsed-
time calculation on read, not a running timer, so it's correct even
after the app was closed the whole wait. `BoardScene.create()` checks
this before building anything else — at 0 lives, `showOutOfLivesWall()`
covers the screen instead: a live countdown to the next free life, a
"Watch Ad for a Life" button (calls the new `showRewardedAdForLife()`,
which always grants exactly 1 life rather than the random pool below —
a guaranteed refill is the whole point of this wall), and a Back
button. The wall auto-recovers (restarts straight into the level) the
moment a life regenerates while it's on screen. Home Hub's top bar now
shows the current lives count (heart emoji, no dedicated art yet)
next to the gem count.

**`boosterStore.js` updated:** starting supply is now 2 Bomb / 5
Shuffle (matching PLAN.md §14's numbers) instead of 0/0 — safe to
change since these are only defaults for an install that's never
touched the store, not a reset of anyone's existing count. Added
`spendBooster(type)` (decrements by 1, returns false if already 0).

**Bomb is spendable** (`BoardScene.createBombButton()`): resets the
current level for a fresh attempt. Implemented as a plain
`scene.restart()` with the same data the level was already launched
with — far simpler and more reliable than hand-resetting moves/board/
score mid-scene, and reuses the exact same tested init path a normal
level start goes through. Needs a tap-then-confirm ("Reset board?",
armed for 2.5s) before it fires, reusing the same tap-to-confirm
pattern `SettingsScene`'s Reset Progress uses, rather than a separate
modal dialog. No passive regen yet - Calendar's Day 7 reward and
Watch to Earn (below) are the only ways to gain more right now.

**Shuffle now has a supply** (`BoardScene.createShuffleButton()`): the
existing manual Shuffle button spends 1 per use and shows the
remaining count; blocks with an "Out of Shuffles!" toast at 0. The
automatic `ensureSolvable()` safety-net shuffle (fires when no legal
swap exists on the board) intentionally does **not** spend from this
supply — it's a fairness mechanic that runs regardless of the player,
not something they chose to do.

**Watch to Earn's reward is now a weighted pool, not always 10
gems** (`adsStore.js`): 70% gems (10), 10% Bomb, 10% Shuffle, 10%
Life - deliberately weighted so Bomb/Shuffle/Life are a rare bonus
("hard to earn" per chat) rather than an even split, with gems as the
safe default most of the time. `showRewardedAd()`'s ad-loading logic
was split out into a shared `playRewardedAdToCompletion()` helper so
`showRewardedAdForLife()` (used by the Out of Lives wall above) can
reuse the same load/show/error handling while guaranteeing a
different, fixed reward. Home Hub's "Loading ad…" toast now shows the
specific reward earned ("+10 Gems!", "You won a Bomb!", "+1 Life!")
instead of a generic message - passed through `scene.restart()`'s
data rather than shown before the restart, since restarting tears
down whatever was on screen.



