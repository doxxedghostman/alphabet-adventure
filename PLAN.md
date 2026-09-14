# WordSwoop

*(Originally prototyped under the working title "Alphabet Adventure" —
renamed once a studio/publisher identity was attached. The repo/folder
name is unchanged for now; only in-game and player-facing branding
uses the new name.)*

A word-connect puzzle game where players swap adjacent letter tiles to
spell real words, while automatic Candy-Crush-style cascades reward
lucky board arrangements too — all while completing objectives and
progressing through an adventure world.

Think: Bookworm + Candy Crush + Adventure.

Published by **Wobblewing Studios**.

Stack: Phaser + Capacitor (reusing patterns from Kid Number Adventure),
Next.js if a web/PWA build is wanted later. Backend: Supabase, reusing
Kid Number Adventure's existing project (`wordswoop_`-prefixed tables)
rather than a separate one — see section 8.6 for the account model.

> **Status:** Phase 1 prototype, live on `main`. See `update.md` for the
> detailed progress log — this file is the design doc, not the changelog.

---

## 0. Boot flow

1. **Splash** — studio logo + game name, with a loading bar that ticks
   through 40% -> 70% -> 90% -> 100% checkpoints (visibly pausing at
   each rather than animating smoothly). Whole sequence stays under 3
   seconds, and plays on every app open, not just first launch.
2. **Main menu** — see section 1 below.
3. **Home Hub** — see section 8.6 below. Reached by tapping Play.
4. **World map / Level path / Board** — reached by tapping Home Hub's
   Word Map button. See section 8.5 below.

## 1. Main menu

Currently implemented: full-bleed poster art (logo + two scout
characters + baked-in "Play" banner) with a single real Play button
overlaid on top, leading to the Home Hub (section 8.6) rather than
straight to the board.

Everything below now lives on the Home Hub instead of here:

- World map (button)
- Daily challenge, shop, gallery, trophy, leaderboard (icons shown,
  not yet functional - see 8.6)
- Settings (reset progress)

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

> Not a current priority — the game is being built general-audience
> first. Section kept for reference, not on the near-term roadmap.

- Categories: animals, fruits, colors, vehicles, objects, numbers.
- Picture clues, voice pronunciation, simpler words, hints, larger tap targets.

## 8. Adult mode

- Categories: science, technology, geography, vocabulary.
- Later additions: synonyms, antonyms, riddles, definitions, anagrams, word chains.

## 8.5 World Map — implementation plan

Reference mockup: `docs/reference/world-map-mockup.png` (World Select
grid + Candy Garden level path, forest-adventure art style).

All 10 worlds' art generated and shipped: `public/assets/<world-slug>-
thumb.jpg` (480x360 world-select tile) and `-bg.jpg` (600x900
level-path background, tall enough for a scrollable 20-node path) for
each of Candy Garden, Jungle Jumble, Ocean Words, Dino Valley, Cloud
Kingdom, Crystal Forest, Magic Mountain, Space Words, Ancient Valley,
and WordSwoop Kingdom. All compressed from multi-MB AI-generator
originals down to the 49-72KB/146-220KB range via resize-to-actual-
display-size + JPEG (no transparency needed for either, so JPEG over
PNG for the size win).

- Two new scenes: `WorldSelectScene` (2-column scrollable grid of world
  tiles, locked worlds shown greyed out with a padlock icon per the
  mockup — currently moot, see the lock-logic note above; the padlock
  code path is still there, just unreachable while everything shows
  unlocked) and `LevelPathScene` (per-world winding path of 20 numbered
  nodes over that world's background art, Start signpost at node 1,
  bigger gold-ringed node for the boss level at 20, Back button to
  return to World Select).
- Only 20 unique art images needed total (10 world thumbnails + 10
  path backgrounds), not 200 - nodes, stars, lock icon, signpost, and
  Back button are drawn/reused in code, matching how tiles/popups
  already work in `BoardScene.js`.
- New `worlds.js` data file: id, display name, thumbnail/background
  asset keys, level ID range per world (mirrors `levels.js`'s pattern).
- New progress store (localStorage): tracks completed level ids (and
  later star counts). Needed because Main Menu's Play button currently
  jumps straight to level 1 with no memory of prior sessions - the map
  is what forces this to finally exist.
- Lock logic: a level is locked unless the previous level in its world
  is completed (world's own level 1 unlocks with the world); a world is
  locked unless the previous world's level 20 (boss) is completed.
  **Currently disabled per chat** — `isWorldUnlocked()`/
  `isLevelUnlocked()` in `progressStore.js` both hard-return `true`, so
  every world/level shows unlocked for everyone regardless of
  progress. The original gating logic is still in the file
  (unreachable, not deleted) so it's a one-line revert if the lock
  chain is wanted back — see update.md Milestone 40.
- Node color in the mockup is decorative only (not tied to level type
  or difficulty) - deliberate choice, not an oversight.
- Path reads bottom-to-top (node 1 at the bottom near Start, node 20 at
  the top) - matches the mockup and common genre convention (e.g. Candy
  Crush), confirmed intentional.
- Main Menu's Play button changes from `scene.start('BoardScene',
  {levelId:1})` to `scene.start('WorldSelectScene')` once this exists.
- Build order: progress store -> `worlds.js` for World 1 (Candy Garden,
  the only world with real level data) -> `LevelPathScene` for World 1
  with hand-placed node coordinates -> `WorldSelectScene` with only
  World 1 unlocked (rest locked/placeholder art) -> wire the full
  Main Menu -> World Select -> Level Path -> Board -> back chain with
  real progress saving -> repeat per additional world as it's authored.
- Node placement is hand-placed coordinates per world (not
  procedural), since it's a one-time cost per world (10 total) rather
  than per level, and avoids nodes overlapping background art badly.

**Built:** progress store (`src/utils/progressStore.js`), `worlds.js`
(all 10 worlds, each now with a `gemColor` used by `WorldSelectScene`'s
tile gems), `LevelPathScene` (hand-placed nodes for Candy Garden;
the other 9 worlds use a generic serpentine fallback until their real
paths get hand-tuned - they're unreachable-by-design until then
anyway, though currently reachable in practice since locks are
disabled - see the lock-logic note above), `WorldSelectScene` (2-column
scrollable grid, lock overlay), and the full navigation chain: Main
Menu Play -> World Select -> Level Path -> Board -> back, with
`BoardScene` now calling `completeLevel()` on a win and routing "Next
Level"/"World Map" based on whether the level just beaten was a
world's boss (level 20).

`WorldSelectScene` went through a restyle per chat (see update.md
Milestones 41-42): first tried as one baked composite illustration
(title + all 10 card frames/nameplates/gems + back arrow in a single
image) with invisible tap zones over the card positions. Reverted -
the composite's fixed aspect ratio couldn't adapt to the game's fixed
canvas (fit-to-width left a large empty gap on taller screens; scaling
further to close the gap would've cropped real card content, not just
decorative margin). Landed on a responsive procedural grid instead
(tile size computed from device width, same as before), with each
tile's frame/nameplate/gem drawn in code rather than baked into one
image - keeps the ornate-ish look while staying responsive to any
screen size, same as `HomeHubScene`'s icon grid.

**Not done:** hand-placed node paths for worlds 2-10 (deferred until
each is reachable/authored); the full 200-level content list is now 20
of 200 (see levels.js's own note and update.md Milestone 39) so most
level nodes past Candy Garden's first 20 currently load placeholder
content via `getLevel()`'s fallback rather than unique target
words/score targets - a content-authoring gap, not a World Map code
gap. Also open: a pixel-accurate (transparent-background, not cropped)
ornate frame/nameplate asset, if the code-drawn version's look isn't
close enough to the mockup - see update.md Milestone 42 for how it'd
slot in.

## 8.6 Home Hub — implementation notes

Reference mockup: person-provided screenshot of a richer "home" screen
(top bar, shop/gallery/trophy/leaderboard column, coin-shop/calendar/
video column, logo + mini map preview, Word Map button). Inserted as a
new middle screen: Main Menu (Play) -> **Home Hub** -> World Map ->
Level Path -> Board, replacing the old direct Main Menu -> World Map
jump described in section 1.

**Built** (`src/scenes/HomeHubScene.js`): top bar (avatar circle,
currency count + gem icon, real settings-icon button — the "+"
add-currency button was removed, no economy system exists for it to
add to); a left icon column (Shop, Leaderboard) and right icon column
(Calendar/daily rewards, Video/watch-to-earn) — trimmed from an
earlier 8-icon set (see update.md Milestone 30 for why Gallery/
Trophy/Coin Shop were cut rather than kept as inert decoration); the
menu logo and a letter-block strip beneath it (a duplicate "Word Map"
banner that used to sit between them was removed — see Milestone 30).
The decorative mini map preview (parchment card + code-drawn lock/star
nodes + dashed path) that used to sit between the logo and the letter
blocks was removed entirely per chat — see update.md Milestone
26 for why the first attempt (path/nodes only) didn't free up any
layout space and the card had to go too. A real "Word Map" button
(real banner art, text baked in) that's the only way forward. Settings
is no longer a popup here at all — it's its own scene
(`src/scenes/SettingsScene.js`, real wood/parchment panel art with
collapsible sections — see update.md Milestone 30), reached via
`scene.start`, since a real settings list (Account, Audio,
Notifications, Support/Legal, Data, About) doesn't fit a small overlay
panel. See update.md Milestones 21-24 for that history. The app is
locked to portrait orientation, with a light creamy-tan letterbox
color (see Milestone 30) rather than the forest green used for
in-scene backgrounds.

Background is a looping waterfall video (`hub-background-loop.mp4`,
muted, static-camera source with a seamless 1s crossfade loop point —
see update.md Milestone 27 for why a crossfade replaced Milestone 26's
boomerang once the source clip itself had a fixed camera), falling
back to the original static `forest-background.jpg` if video playback
isn't available. Dim overlay over the background is 0.15 opacity, not
0.45 — the original figure (sized for the old static image) combined
with the video's own brighter palette to produce a washed-out look
that read as "blurry," fixed in Milestone 27. Real art
throughout otherwise (wood top bar, banners, 8 side icons, settings
icon, gem icon, and a newer transparent-background logo swapped in
per Milestone 26) - full detail and the several rounds of
animation-effects-added-then-stripped-back-out is in `update.md`
(Milestones 18-20), not repeated here since it's implementation
history rather than design intent. Design intent that *is* still
true: shop/gallery/trophy/leaderboard/coin-shop/calendar/video are all
placeholders with no real system behind any of them yet (tap just
bounces, does nothing) - section 14 below is the plan for what most of
them eventually become. Avatar/currency/name are also placeholders
pending the Google sign-in work (Supabase schema is live — see
update.md Milestone 25 — but the client-side auth flow isn't wired up
yet).

**Account / sign-in model (decided AND built, see update.md Milestones
25 + 29):** guest play is never blocked — Home Hub, World Map, and
every level are reachable with no account at all, progress saved
locally (`progressStore.js`). Sign-in is only prompted at natural
checkpoints (Settings' Account section - real now, not a placeholder),
not as a wall before the app is usable. On first sign-in, a guest's
local `completedLevelIds` are merged (unioned) into their new cloud
profile, never overwritten — matches how most casual puzzle games
(Candy Crush/Bookworm-style) treat guest-to-account conversion.
Backend is Supabase, reusing Kid Number Adventure's existing project
rather than a new one (`wordswoop_`-prefixed tables so the two games'
schemas don't collide) — `wordswoop_profiles` (display name, avatar,
gems, completed levels, settings, RLS'd to each user's own row) is
live. Google sign-in is enabled and working (`src/utils/authStore.js`)
— reusing an existing Google Cloud OAuth client already used by
another of the person's live apps, sharing that Supabase project's
identity pool by deliberate choice rather than a dedicated
WordSwoop-only client.

**Calendar (daily rewards) is real now** (`src/scenes/CalendarScene.js`
— see update.md Milestone 31): a 7-day check-in cycle, local-only
(localStorage, same pattern as progress/settings — does not yet sync
to `wordswoop_profiles.gems`). Days 1-3 pay 3 gems, days 4-6 pay 5
gems, day 7 pays a random booster (Bomb or Shuffle — see §14, first
time either has existed as a real, grantable thing, via the new
minimal `boosterStore.js`; still not spendable on the board yet).
Missing a day resets the streak to Day 1. The Home Hub currency
display now reads this real gem balance (`currencyStore.js`) instead
of the old hardcoded 0.

**Not done:** Shop icon is still a stub; account delete/data delete
(needs a Supabase Edge Function, not a direct client call, to use the
service-role key safely); display-name editing and a custom avatar
picker (currently shows Google's own name/photo only); booster
inventory has no way to be spent in a level yet.

**Leaderboard is real now** (`src/scenes/LeaderboardScene.js` — see
update.md Milestone 32): top 10 players by gems, read from a new
`wordswoop_leaderboard` Postgres view (public read of a limited slice
of `wordswoop_profiles`, since that table's own RLS only allows
reading your own row). Requires a one-time SQL migration on the
Supabase project (handed over separately, not run by Claude — see
Milestone 32) before it shows real data. `syncLocalProgressToCloud()`
(new, `authStore.js`) now pushes gems + completed levels to the cloud
on every level win and Calendar claim, not just once at first sign-in,
so this stays current for signed-in players. Guests never appear here
(no cloud profile row) — screen shows a "sign in to join" nudge.

## 9. World map

Real adventure structure instead of a flat level list. **Replaced the
original 6-world layout with a 10-world layout** (kept the 200-level
total, just split more finely — 20 levels per world instead of
~33-34):

1. Candy Garden — levels 1-20
2. Jungle Jumble — levels 21-40
3. Ocean Words — levels 41-60
4. Dino Valley — levels 61-80
5. Cloud Kingdom — levels 81-100
6. Crystal Forest — levels 101-120
7. Magic Mountain — levels 121-140
8. Space Words — levels 141-160
9. Ancient Valley — levels 161-180
10. WordSwoop Kingdom — levels 181-200

Each world gets its own art, music, obstacle set, and vocabulary —
rough per-world decoration ideas from the external spec this layout
came from: Candy Garden: candy trees/flowers; Jungle Jumble:
trees/birds/vines; Ocean Words: water/fish/shells; Dino Valley:
dinosaurs/volcanoes, etc. — the rest still need theming as each world
gets built.

Total stays at **200 levels**. Of those, every 5th level (**40 total**)
is a `type: 'target'` level with a specific word to find; the rest are
free-play. Target-word difficulty should climb with world/level number
— early worlds use short common words (CAT, BAG), later worlds use
longer, less obvious ones (BRAVE, and eventually the harder 6-letter
words the board already supports, e.g. GARDEN-length). See §16 Phase 6
and the solvability section below for how target levels are generated.

**Level 200** is a planned capstone ("Ultimate Word Challenge" per the
external spec this world layout came from) — unique board/background,
a hard target word, big coin reward, and a special completion
animation. Not built — just flagged as the intended shape of the last
level once content production gets there.

## 10. Characters

- Lumi — main character. The Alphabet Kingdom has been corrupted; the
  player restores it by solving puzzles.
- Per-world characters (rough first pass matching the new §9 world
  names — not a final design, just placeholders so each world isn't
  characterless): Candy Garden — Candy Guardian; Jungle Jumble — Lion
  King; Ocean Words — Mermaid; Dino Valley — Dino explorer; Cloud
  Kingdom — Cloud spirit; Crystal Forest — Crystal fairy; Magic
  Mountain — Wizard; Space Words — Robot; Ancient Valley — Explorer/
  archaeologist; WordSwoop Kingdom — Lumi's home turf, likely no
  separate guide character since it's the finale.

## 11. Rewards

- 1-3 stars per level (star meter fills as score climbs toward 3
  thresholds — see §14 below), coins, gems, boosters on completion.
- Coins (planned, not built): minimum 5 coins per completed level,
  more for harder/milestone/boss levels (e.g. 10 for a hard level, 20
  for a milestone). Lives in the player's profile/main-menu economy,
  not the board itself.

## 12. Daily challenge

- One special puzzle per day (e.g. "Today's word: VOLCANO").
- Rewards: coins, gems, boosters. Consider a weekly challenge too.
- Daily login reward cycle (planned, not built): a 7-day repeating
  cycle of small rewards (coins, a Shuffle, a Bomb, building to a
  bigger reward on day 7), main-menu-only — doesn't touch the board.

## 13. Achievements

Examples: solve 100 words, create 50 combos, complete World 1, solve a
10-letter word, finish a level without boosters, collect 1,000 coins,
use 10 Shuffles, use 10 Bombs, complete 50 levels, complete all 200
levels. Lives entirely in a profile/achievements screen — doesn't
touch board logic.

## 14. Meta / main-menu systems

Lives, Bomb, and the Shuffle economy are built now (see update.md
Milestone 34) — the rest below is still planned, not built.

- **Lives** — built: 5 max, lose 1 on a failed level, regenerate +1
  every 30 min (`src/utils/livesStore.js`), refillable via a
  guaranteed-reward rewarded ad on the "Out of Lives" wall
  (`BoardScene.showOutOfLivesWall`). Home Hub's top bar shows the
  current count with real art (`icon-life.png`, Milestone 35).
- **Bomb** — built: starts at 2, resets the current level for a fresh
  attempt (simplest reliable implementation: restarts the scene),
  needs a tap-then-confirm ("Confirm?") before it fires. Real icon art
  on the board's Bomb button (`icon-bomb.png`, Milestone 35). Passive
  regen over time is not built — right now the only ways to gain more
  are Calendar's Day 7 reward and Watch to Earn's reward pool.
- **Shuffle economy** — built: starts at 5, the existing manual
  Shuffle button now spends one and shows the remaining count with
  real icon art (`icon-shuffle.png`, Milestone 35); the automatic
  `ensureSolvable()` safety-shuffle stays free (it's a fairness
  mechanic, not a player action, so it doesn't touch this supply).
  Same "no passive regen yet" gap as Bomb above.
- **Combo / streak multiplier** — still planned. Reward consecutive
  words found without a "dead" swap in between (×1 for one word, ×2
  for two in a row, etc., topping out at a "Super Swoop" label for
  4+). This one does touch board scoring (it's a multiplier on points
  earned), but the reward/effect of it (score, animations) can surface
  via a HUD element rather than any new board rule.
- **Boss / Champion levels** — still planned. Every 20th level (so,
  the last level of each 10-world's block) becomes a milestone: unique
  board/background, a harder target word, a bigger coin reward, a
  unique completion animation. This is a content/presentation change
  on existing target-word levels, not a new mechanic.
- **3-star scoring** — still planned. Each level gets 3 score
  thresholds shown as a fillable meter under the level header;
  completing a level shows a 1/2/3-star result and saves the player's
  best score/stars/moves for that level so they can replay to improve
  it. Mostly a level-complete-screen and profile feature; the
  underlying score number already exists.

## 15. Monetization

- Free: hundreds of levels, limited boosters, ads between some levels,
  daily rewards.
- Optional purchases: gem packs, booster packs, remove ads, premium
  progression.
- Not pay-to-win.

## 16. Build phases

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
word length range extended 3-5 -> 3-6, a shuffle bug fixed, the game
renamed to WordSwoop under publisher Wobblewing Studios, and a proper
boot flow added (splash with loading bar -> main menu with a Play
button -> board), replacing what used to be a direct load straight
into the board (see `update.md` for the detailed log of all of this).

**Phase 2 — Level objectives & structure (done, see `update.md`)**
Levels are plain data (`src/data/levels.js`: type + targetWord/
scoreTarget + maxSwaps). The board header shows a Level badge, a Moves
counter, and the goal — "Find: WORD" for `type: 'target'`, "Reach N
points" for `type: 'free'`. A move is spent on every successful swap
(invalid swaps that bounce back are free). The win condition can land
either directly from the player's swap or via a chained cascade —
either way wins the level, even mid-chain, taking priority over running
out of moves. Win and lose each end in a card popup (title, message,
score, two buttons): win -> Next Level / Replay, lose -> Try Again /
Main Menu. 20 levels exist: 16 `type: 'free'` (score-target demo
levels - see §16 Phase 6 for why score target was chosen as the
free-play objective) and 4 `type: 'target'` (BAG/CAT/DOG/SUN at levels
5/10/15/20, built via the guaranteed-board generator - matches the
"every 5th level" rule below; see update.md Milestones 38-39 for the
level-count history).
Not yet built: World Map / Daily Challenge /
Achievements / Settings on the main menu (still Play-only), obstacles,
and special tiles — those stay Phase 3/4 as originally planned.

**Phase 3 — Special mechanics**
Rocket, bomb, wildcard, ice, locks (see section 4, triggers now based
on word length rather than match length).

**Phase 4 — Progression**
Levels, stars, coins, world map, unlock system, save progress. Also
where the §14 meta systems (Lives, Bombs, Combo multiplier, Boss
levels, 3-star scoring) would slot in — all planned, none built yet.

**Phase 5 — Art & audio**
Characters, animated letters, particle effects, explosions, sound
effects, music, level-complete animations.

**Phase 6 — Content**
Target: 10 worlds (§9), **200 levels total**. Every 5th level (40
total) is a `type: 'target'` level (specific word, board generated via
`generateGuaranteedBoard()` — see solvability section below); the rest
(160) are `type: 'free'` — **score target**: reach `scoreTarget` points
within `maxSwaps` swaps, any words count. Chosen over "find N words" or
a bare move-limit objective since it reuses the existing scoring math
directly and doubles as the star threshold for the planned §14 3-star
meter. Both types are implemented in `BoardScene.js`/`levels.js`; 20 of the
planned 200 levels exist so far (4 target, 16 free — all still within
Candy Garden, world 1) — authoring the remaining 180 (words per world,
score targets per difficulty tier) is still open. Build a level-data format
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

## Solvability — resolved for free-play, resolved for target-word levels

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

**Resolved (target-word levels):** a live solver proving "targetWord is
reachable within N swaps" was ruled out as expensive and unreliable
(search over swap sequences, cascades complicate it further). Instead,
`generateGuaranteedBoard()` (`src/utils/levelGenerator.js`) builds the
board backwards from a solved state: place targetWord correctly in a
straight line, fill the rest of the board normally, then apply
`scrambleCount` random adjacent-tile swaps. Since the scramble path is
known, the board is provably solvable in at most `scrambleCount` swaps —
no search needed. `maxSwaps` per level just needs to be >= scrambleCount
(a buffer on top, via `recommendedMaxSwaps()`, gives the player slack
since they won't necessarily find the exact reverse path). Wired into
`BoardScene.createInitialBoard()` for any level with `type: 'target'`.
Placeholder scramble counts by word length live in
`SCRAMBLE_COUNT_BY_LENGTH` (3-letter: 6, 4: 9, 5: 12, 6: 15) — the
sweet spot per length (too few scrambles = word looks near-complete and
easy; too many = eats most of the swap budget resetting the board) still
needs playtesting and tuning, this is just a starting point. Obstacles/
wildcards aren't accounted for yet since they don't exist in the game
yet (Phase 3) — revisit this generator once they're built, since they
could block the scrambled swap path.

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

(This milestone is met — the board plays as described. The splash and
main menu built on top of it are the first pieces of "worlds,
characters, story... around it.")
