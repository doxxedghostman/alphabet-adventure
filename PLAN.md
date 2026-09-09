# Alphabet Adventure

A word-connect puzzle game where players swap adjacent letter tiles to
spell real words, while automatic Candy-Crush-style cascades reward
lucky board arrangements too — all while completing objectives and
progressing through an adventure world.

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

- Start with a 6x6 board of letter tiles, using the full A-Z alphabet
  (frequency-weighted so common letters like vowels/R/S/T/N/L come up
  more often than rare ones like Q/X/Z/J/K).
- Player taps or swipes two orthogonally-adjacent tiles to swap them —
  classic Candy Crush swap input, not a multi-tile drag.
- After the swap, the whole board is scanned for any 3-6 letter
  straight-line word (row or column, either reading direction) that the
  swap created. A single swap can complete more than one word at once
  (e.g. it finishes a word in its row and a different word in its
  column simultaneously) — both clear.
- If the swap creates no word anywhere on the board, it reverts —
  classic invalid-swap bounce-back.
- After every fall — whether from the player's own clear, a cascade, or
  a shuffle — the board automatically re-scans every row and column for
  any word that landed there by chance. If one did, it clears
  automatically too, without the player touching anything, and can
  keep chaining further cascades, exactly like a Candy Crush combo
  chain.
- At 6x6, a full 6-letter word can span an entire row or column
  edge-to-edge.
- Splitting the full alphabet into progressive stages (e.g. common
  letters unlocked first, rarer ones added in later worlds) is a
  planned follow-up — full alphabet went in first, staging is next.

## 3. Target words & objectives

- A level can still hand the player an explicit goal on top of free
  swapping (e.g. "Find: LION" somewhere on the board), rather than
  every level being open-ended scoring.
- Since the player is already spelling real words as the core loop,
  target-word objectives become "engineer a swap that produces this
  *specific* word" rather than "assemble letters via matches first."

## 4. Special tiles

- Spell a 4-letter word -> Rocket letter: clears a row/column.
- Spell a 5+ letter word -> Rainbow/wild letter: stands in for any
  letter in a future swap.
- Combos (e.g. rainbow + rocket) -> large board clears.
- (Length thresholds above were set when 5 was the max word length;
  worth revisiting now that 6-letter words are possible — e.g. whether
  6-letter words deserve their own tier above Rainbow.)

## 5. Obstacles (introduced gradually)

- Early: locked letters, ice, vines.
- Mid: bombs, moving tiles, rocks.
- Advanced: disappearing letters, timed tiles, rotating boards, wrong-letter traps.

## 6. Level objective variety

Avoid "find a word" as the only objective. Mix in:

- Collect N of a given letter.
- Find multiple words in one level.
- Clear all obstacles + find a longer word.
- Complete the objective within a limited number of swaps (a move
  limit).
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

**Phase 1 — Prototype (in progress, core mechanic now settled)**
The core loop went through a full circle before landing: built first
as a 7x7 swap-to-match-3 loop (identical letters, no words) to prove
the technical plumbing (board gen, swap, match, clear, fall, cascade,
score) worked — it did. That was then replaced with Word-Trace: drag
through adjacent letters to spell real words, first allowing corner
turns, then restricted to straight lines only once corner-turning
proved words were too hard to spot by eye. Word-Trace was then
replaced with **Word-Swap** (the original swap concept, now word-aware
instead of match-aware): tap/swipe two adjacent tiles to swap them,
whole board scanned for any word(s) the swap created. This is the
confirmed core loop going forward. Since then: full A-Z alphabet
restored (was briefly reduced to 10 letters), board resized 7x7 -> 6x6,
word length range extended 3-5 -> 3-6, and a shuffle bug fixed (see
`update.md` for the detailed log of all of this).

**Phase 2 — Level objectives & structure**
Specific target word per level, a limited-swaps or time-limit
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
Board: 6x6
Target: PLANET
Swaps: 25
Obstacle: ICE
Goal: Find word
Stars: 10000 / 15000 / 20000
```

This is what makes generating hundreds of levels tractable.

## Open technical risk: solvability — resolved for free-play, open for target-word levels

Under the Word-Swap mechanic, the board must always have at least one
adjacent swap that would create a word — otherwise the player has no
legal action at all.

**Resolved (Phase 1):** `hasValidSwap()` in `BoardScene.js` checks
every adjacent tile pair on the board and simulates the swap
(`wouldSwapCreateWord()`) to see if it would produce a 3-6 letter word
in the row(s)/column(s) it touches. This replaced an earlier
`hasValidWord()` check that only asked "does a word already exist on
the board" — the wrong question for a swap mechanic, since completed
words normally auto-clear immediately anyway. It runs after the
initial deal and after every cascade settles; if nothing is found, the
board silently reshuffles itself before the player would notice. A
manual Shuffle button lets the player trigger the same reshuffle on
demand. Shuffle itself had a bug where it could hand out an
already-completed word without clearing it (only verified a *future*
swap was possible, not that the shuffle result was itself clean) — now
fixed by running the same clear/cascade pass after shuffling that runs
after every other board change. Spot-checked with 500 random 6x6
boards using the full alphabet and the 3-6 word range: 0 came back
stuck.

**Still open (Phase 2+):** once levels have a specific *target* word
and a swap limit, the existing solver only proves "a word exists," not
"the target word is reachable within N swaps, accounting for
obstacles/wildcards." That needs either a level-specific solver/
simulator run before a level ships, or a manual playtest step in the
content pipeline. Decide before Phase 6 content production scales up.

## Game loop

Open game -> choose level -> swap tiles to spell words -> trigger
cascades -> complete objective -> earn stars -> earn rewards -> unlock
next location -> continue adventure -> come back tomorrow for daily
challenge.

## First milestone

Can we make a 6x6 board where the player swaps adjacent tiles to spell
real words, with satisfying automatic cascades on top? If that's fun
after 5-10 minutes of play, build worlds, characters, story,
monetization, and levels around it.
