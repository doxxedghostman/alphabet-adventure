# Alphabet Adventure

A word-connect puzzle game where players drag through adjacent letter
tiles to spell real words, while automatic Candy-Crush-style cascades
reward lucky board arrangements too — all while completing objectives
and progressing through an adventure world.

Think: Bookworm + Candy Crush + Adventure.

Stack: Phaser + Capacitor (reusing patterns from Kid Number Adventure),
Next.js if a web/PWA build is wanted later.

> **Status:** Phase 1 prototype, live on `main`. See `update.md` for the
> detailed progress log — this file is the design doc, not the changelog.

---

## 1. Main menu

- Play
- World map
- Daily challenge
- Achievements
- Settings

Player starts at World 1, Level 1.

## 2. The puzzle board

- Start with a 7x7 board of letter tiles.
- Player drags in a single straight line — one row (left-right or
  right-left) or one column (up-down or down-up) — Candy Crush style.
  No corners, no diagonals, no zigzags: once the first two tiles set a
  direction, every further tile must continue in that same direction.
- Releasing while the traced letters spell a real 3-5 letter word clears
  those tiles; tiles above fall to fill the gaps.
- After every fall — whether from the player's own clear or from a
  cascade — the board automatically re-scans every row and column for
  any straight-line 3-5 letter word that landed there by chance. If one
  did, it clears automatically too, without the player touching
  anything, and can keep chaining further cascades, exactly like a
  Candy Crush combo chain.
- Spelling words is the core action, not a means to an end anymore —
  the player is always directly forming words; incidental cascades are
  a bonus on top.

## 3. Target words & objectives

- A level can still hand the player an explicit goal on top of free
  word-tracing (e.g. "Find: LION" somewhere on the board), rather than
  every level being open-ended scoring.
- Since the player is already spelling real words as the core loop,
  target-word objectives become "notice and trace this *specific* word
  among the various valid ones available" rather than "assemble letters
  via matches first."

## 4. Special tiles

- Spell a 4-letter word -> Rocket letter: clears a row/column.
- Spell a 5-letter word -> Rainbow/wild letter: stands in for any
  letter in a future trace.
- Combos (e.g. rainbow + rocket) -> large board clears.

## 5. Obstacles (introduced gradually)

- Early: locked letters, ice, vines.
- Mid: bombs, moving tiles, rocks.
- Advanced: disappearing letters, timed tiles, rotating boards, wrong-letter traps.

## 6. Level objective variety

Avoid "find a word" as the only objective. Mix in:

- Collect N of a given letter.
- Find multiple words in one level.
- Clear all obstacles + find a longer word.
- Complete the objective within a limited number of word-traces (the
  drag-trace equivalent of a "move limit").
- Find a hidden themed word (e.g. an animal).

## 7. Kids mode

- Categories: animals, fruits, colors, vehicles, objects, numbers.
- Picture clues, voice pronunciation, simpler words, hints, larger tap targets.

## 8. Adult mode

- Categories: science, technology, geography, vocabulary.
- Later additions: synonyms, antonyms, riddles, definitions, anagrams, word chains.

## 9. World map

Real adventure structure instead of a flat level list:

1. Alphabet Forest — levels 1-30
2. Animal Kingdom — levels 31-60
3. Ocean — levels 61-90
4. Desert — levels 91-120
5. Ice Kingdom — levels 121-150
6. Space — levels 151-180

Each world gets its own art, music, obstacle set, and vocabulary.

## 10. Characters

- Lumi — main character. The Alphabet Kingdom has been corrupted; the
  player restores it by solving puzzles.
- Per-world characters: Forest Guardian, Lion King, Mermaid, Penguin
  explorer, Robot, etc.

## 11. Rewards

- 1-3 stars per level, coins, gems, boosters on completion.

## 12. Daily challenge

- One special puzzle per day (e.g. "Today's word: VOLCANO").
- Rewards: coins, gems, boosters. Consider a weekly challenge too.

## 13. Achievements

Examples: solve 100 words, create 50 combos, complete World 1, solve a
10-letter word, finish a level without boosters.

## 14. Monetization

- Free: hundreds of levels, limited boosters, ads between some levels,
  daily rewards.
- Optional purchases: gem packs, booster packs, remove ads, premium
  progression.
- Not pay-to-win.

## 15. Build phases

**Phase 1 — Prototype (in progress, pivoted mid-phase)**
Originally built as a 7x7 swap-to-match-3 loop (identical letters, no
words). After playtesting confirmed the loop worked technically, the
core mechanic was replaced with Word-Trace: drag through adjacent
letters to spell real words, validated against a bundled dictionary,
with automatic Candy-Crush-style cascades after every fall. The trace
itself was initially allowed to turn corners, but that made valid
words hard to spot by eye (a word could zigzag across the board and
not look like anything); tightened to straight-line-only drags (one
row or one column, either direction) to match Candy Crush's own
selection feel and keep words visually recognizable. This is the
confirmed core loop going forward. UI polish (phone-sized bordered
panel, shuffle, path feedback) is landing incrementally within this
phase — see `update.md`.

**Phase 2 — Level objectives & structure**
Specific target word per level, a limited-traces or time-limit
structure (replacing today's endless free-play scoring), win/lose
conditions, the goal/moves/stars header shown in early mockups.

**Phase 3 — Special mechanics**
Rocket, bomb, wildcard, ice, locks (see section 4, triggers now based
on word length rather than match length).

**Phase 4 — Progression**
Levels, stars, coins, world map, unlock system, save progress.

**Phase 5 — Art & audio**
Characters, animated letters, particle effects, explosions, sound
effects, music, level-complete animations.

**Phase 6 — Content**
Target: ~5 worlds x 30 levels = 150 levels. Build a level-data format
so levels are defined as data, not hand-coded, e.g.:

```
Level: 27
Board: 7x7
Target: ELEPHANT
Traces: 25
Obstacle: ICE
Goal: Find word
Stars: 10000 / 15000 / 20000
```

This is what makes generating hundreds of levels tractable.

## Open technical risk: solvability — resolved for free-play, open for target-word levels

Under the Word-Trace mechanic, the board must always have at least one
valid word traceable somewhere on it — otherwise the player has no
legal action at all.

**Resolved (Phase 1):** `hasValidWord()` in `BoardScene.js` scans every
row and column for a 3-5 letter run (either reading direction) that's
a real word, matching exactly what the straight-line-only drag can now
produce. It runs after the initial deal and after every cascade
settles; if nothing is found, the board silently reshuffles itself
before the player would notice. A manual Shuffle button lets the
player trigger the same reshuffle on demand. Spot-checked with 500
random boards from the current vowel-heavy letter pool: 0 came back
stuck.

Discoverability (can players actually *spot* a word that's there) was
a real problem during the corner-turning version — a word could zigzag
across the board and not look like anything recognizable. Restricting
drags to straight lines (see §2) fixes most of that on its own, since
a valid word now always reads as a normal row/column run, the way
Candy Crush matches do. A hint feature (briefly highlight one valid
line) is still worth adding later, but is no longer load-bearing for
basic playability.

**Still open (Phase 2+):** once levels have a specific *target* word
and a trace limit, the existing solver only proves "a word exists," not
"the target word is reachable within N traces, accounting for
obstacles/wildcards." That needs either a level-specific solver/
simulator run before a level ships, or a manual playtest step in the
content pipeline. Decide before Phase 6 content production scales up.

## Game loop

Open game -> choose level -> drag to spell words -> trigger cascades ->
complete objective -> earn stars -> earn rewards -> unlock next
location -> continue adventure -> come back tomorrow for daily challenge.

## First milestone

Can we make a 7x7 board where the player drags through letters to spell
real words, with satisfying automatic cascades on top? If that's fun
after 5-10 minutes of play, build worlds, characters, story,
monetization, and levels around it.
