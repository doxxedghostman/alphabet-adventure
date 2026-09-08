# Alphabet Adventure

A match-3 puzzle game where players match, combine, and manipulate letter
tiles to discover words, while completing objectives and progressing
through an adventure world.

Think: Candy Crush + Word Puzzle + Adventure.

Stack: Phaser + Capacitor (reusing patterns from Kid Number Adventure),
Next.js if a web/PWA build is wanted later.

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
- Player swaps adjacent tiles.
- Matching 3+ identical letters clears them; tiles above fall to fill gaps.
- Matching is a means to an end, not the goal itself — the goal is
  building toward a target word.

## 3. Creating words

- Each level gives a target word (e.g. "Find: LION").
- Player manipulates the board via matches to produce the needed letters,
  then connects them (e.g. L -> I -> O -> N) to complete the word.

## 4. Special tiles

- Match 4 -> Rocket letter: clears a row/column.
- Match 5 -> Rainbow/wild letter: stands in for any letter.
- T/L-shape match -> Bomb letter: clears surrounding tiles.
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
- Complete the word within a move limit.
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

**Phase 1 — Prototype**
7x7 board -> letter tiles -> swap -> match 3 -> clear -> tiles fall ->
basic scoring. Goal: confirm the core loop is fun in 5-10 minutes of play
before building anything else.

**Phase 2 — Word system**
Target word, letter collection tracking, word validation, word
completion, level objectives.

**Phase 3 — Special mechanics**
Rocket, bomb, wildcard, ice, locks.

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
Moves: 25
Obstacle: ICE
Goal: Find word
Stars: 10000 / 15000 / 20000
```

This is what makes generating hundreds of levels tractable.

## Open technical risk: solvability

Every level needs a guarantee that the target word is actually
constructible within the given move limit, accounting for obstacles and
wildcards. This needs either:

- A solver/simulator that validates a level before it ships, or
- Manual playtesting per level as part of the content pipeline.

This should be decided before Phase 6 content production scales up.

## Game loop

Open game -> choose level -> match letters -> create combos -> discover
word -> complete objective -> earn stars -> earn rewards -> unlock next
location -> continue adventure -> come back tomorrow for daily challenge.

## First milestone

Can we make a 7x7 board where the player can swap letters, match them,
create special tiles, and use those mechanics to solve a word? If that's
fun after 5-10 minutes of play, build worlds, characters, story,
monetization, and levels around it.

---

## Progress log

### Done — Phase 1 prototype

Built and pushed to `main`: a Phaser + Vite scaffold implementing the
core Phase 1 loop end to end.

- 7x7 board, tiles drawn from a vowel/common-consonant-weighted letter
  pool (not yet word-aware — that's Phase 2).
- Click a tile, click an adjacent tile to attempt a swap; the swap only
  commits if it produces a match, otherwise it animates back.
- Match detection for horizontal/vertical runs of 3+.
- Matched tiles clear, columns collapse, new tiles fall in from above.
- Chain reactions: after a refill, the board re-checks for new matches
  and keeps resolving, with each chain level multiplying the score for
  that cascade.
- Initial board generation avoids spawning a pre-made match.
- No target words, no special tiles (rocket/bomb/wildcard), no
  obstacles, no move limits yet — intentionally out of scope for this
  milestone.

Stack used: Phaser 3 + Vite (plain JS, no Capacitor/Next.js wrapper yet
— those get added once the loop is confirmed fun and worth building on
top of).

### Next — playtest, then Phase 2

1. **Playtest the prototype as-is.** This is the actual first-milestone
   question from the plan: is swap -> match -> clear -> fall fun for
   5-10 minutes on its own, before anything else gets built on top of
   it? Tune tile size, letter pool weighting, and animation speed based
   on how it feels.
2. **Phase 2 — word system**, once the core loop earns its keep:
   - Target word per level (e.g. "Find: LION").
   - Letter collection tracking as matches happen.
   - Word validation + completion detection.
   - Level objective structure (replacing the current endless/free-play
     scoring loop).
3. Revisit the **solvability risk** called out above — once levels have
   a target word and move limit, we need either a solver/simulator that
   validates a level before it ships, or a manual playtest step in the
   content pipeline. Needs a decision before Phase 6 content scales.
