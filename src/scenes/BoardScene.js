import Phaser from 'phaser';
import { APP_BG_COLOR, APP_BG_COLOR_RGB } from '../config.js';
import {
  BOARD_SIZE,
  TILE_SIZE,
  TILE_GAP,
  BOARD_SIDE_MARGIN,
  BOARD_PIXEL_SIZE,
  LETTER_COLORS,
  MIN_WORD_LENGTH,
  MAX_WORD_LENGTH,
  randomLetter,
} from '../config.js';
import { WORD_SET } from '../data/wordlist.js';
import { getLevel, getNextLevelId } from '../data/levels.js';
import { generateGuaranteedBoard, SCRAMBLE_COUNT_BY_LENGTH } from '../utils/levelGenerator.js';
import { completeLevel, levelIdFor, LEVELS_PER_WORLD } from '../utils/progressStore.js';
import { syncLocalProgressToCloud } from '../utils/authStore.js';
import { getLivesStatus, loseLife, MAX_LIVES } from '../utils/livesStore.js';
import { showRewardedAdForLife } from '../utils/adsStore.js';
import { getBoosters, spendBooster } from '../utils/boosterStore.js';
import { WORLD_FRAMES, getWorldFrame } from '../data/worldFrames.js';
import { getWorld, WORLDS } from '../data/worlds.js';
import { bindHardwareBack } from '../utils/hardwareBack.js';
import { isMusicOn, isSfxOn, isHapticsOn, setMusicOn, setSfxOn, setHapticsOn } from '../utils/settingsStore.js';
import { preloadBoardHud, computeHudLayout, createBoardHud } from '../utils/boardHud.js';

// Word-Swap mechanic:
// - Tap/swipe two orthogonally-adjacent tiles (up/down/left/right, no
//   diagonals) to swap them.
// - After the swap, the WHOLE board is scanned (every row + every column)
//   for any 3-6 letter straight-line word. A single swap can create more
//   than one word at once (e.g. finishes a word in its row AND a
//   different word in its column) - both clear.
// - If the swap creates no word anywhere on the board, it reverts -
//   classic invalid-swap bounce-back.
// - After every fall - whether from the player's own clear or from a
//   cascade - the board automatically re-scans every row and column for
//   any word that landed there by chance. If one did, it clears
//   automatically too, without the player touching anything, and can
//   keep chaining further cascades, exactly like a Candy Crush combo
//   chain.

export class BoardScene extends Phaser.Scene {
  constructor() {
    super('BoardScene');
  }

  preload() {
    this.load.image('boardBackIcon', 'assets/icon-back.png');
    // Top bar / goal banner / bottom booster bar art (see boardHud.js).
    preloadBoardHud(this);
    // Per-world board frame art (see worldFrames.js) - loaded
    // unconditionally since preload() doesn't know worldId yet, but
    // they're small (~330-530KB each) so loading all of them every
    // time is cheap relative to a per-world conditional load.
    Object.values(WORLD_FRAMES).forEach(({ frameKey, framePath, bossFrameKey, bossFramePath }) => {
      this.load.image(frameKey, framePath);
      if (bossFrameKey) this.load.image(bossFrameKey, bossFramePath);
    });
    // Same reasoning, same unconditional-load pattern - per-world board
    // backdrop (blurred/dimmed crop of that world's own bgPath art, see
    // worlds.js). These are small (~19KB each, already-blurred JPEGs).
    WORLDS.forEach(({ boardBgKey, boardBgPath }) => {
      this.load.image(boardBgKey, boardBgPath);
    });
  }

  // Full-screen wall shown instead of the board when out of lives.
  // Auto-recovers (restarts straight into the level) the moment a life
  // regenerates while this is on screen, so the player never has to
  // manually retry once the timer runs out.
  showOutOfLivesWall(sceneData) {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, APP_BG_COLOR, 1).setOrigin(0);

    this.add
      .text(width / 2, height * 0.35, '\u{1F494} Out of Lives', {
        fontFamily: 'Arial',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.livesWallCountdown = this.add
      .text(width / 2, height * 0.35 + 40, '', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#a79ccf',
      })
      .setOrigin(0.5);

    const adBtnBg = this.add
      .rectangle(width / 2, height * 0.35 + 100, width * 0.7, 54, 0x2e7d32, 1)
      .setStrokeStyle(3, 0x1b4d1e, 1)
      .setInteractive({ useHandCursor: true });
    const adBtnLabel = this.add
      .text(width / 2, height * 0.35 + 100, 'Watch Ad for a Life', {
        fontFamily: 'Arial',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    adBtnBg.on('pointerup', async () => {
      adBtnLabel.setText('Loading ad\u2026');
      const result = await showRewardedAdForLife();
      if (result.granted) {
        this.scene.restart(sceneData);
      } else {
        adBtnLabel.setText('Watch Ad for a Life');
      }
    });

    this.worldId = sceneData?.worldId ?? null;

    // Real icon back button (per chat) replacing the plain "\u2190 Back"
    // text link - same baseScale-relative tap-bounce pattern used in
    // CalendarScene's createHud(). Centered like the text it replaces
    // (this sits in the middle of the out-of-lives wall, not a HUD bar).
    const backSize = 40;
    const backIcon = this.add.image(width / 2, height * 0.35 + 160, 'boardBackIcon');
    backIcon.setDisplaySize(backSize, backSize);
    const backBase = backIcon.scale;

    const backHit = this.add
      .circle(backIcon.x, backIcon.y, backSize / 2, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    backHit.on('pointerdown', () => this.tweens.add({ targets: backIcon, scale: backBase * 0.9, duration: 70 }));
    backHit.on('pointerup', () => {
      this.tweens.add({ targets: backIcon, scale: backBase, duration: 100 });
      this.goBack();
    });

    const tick = () => {
      const status = getLivesStatus();
      if (status.lives > 0) {
        this.scene.restart(sceneData);
        return;
      }
      const mins = Math.floor(status.msUntilNextLife / 60000);
      const secs = Math.floor((status.msUntilNextLife % 60000) / 1000);
      this.livesWallCountdown.setText(`Next life in ${mins}m ${String(secs).padStart(2, '0')}s`);
    };
    tick();
    this.time.addEvent({ delay: 1000, loop: true, callback: tick });
  }

  // Same "leave the board" destination the out-of-lives wall's own
  // Back label uses (see showOutOfLivesWall) - worldId is set by
  // whichever create() path ran before this is ever invoked, so it's
  // safe to read lazily here.
  goBack() {
    this.worldId
      ? this.scene.start('LevelPathScene', { worldId: this.worldId })
      : this.scene.start('MainMenuScene');
  }

  create(sceneData) {
    this.isBusy = false;
    this.isPaused = false;
    this.score = 0;
    this.grid = [];

    // Hardware/gesture back button - same destination as the on-screen
    // Back label above. Registered up front (before the lives-gate
    // branch below) since goBack() only reads this.worldId at press
    // time, by which point either create() path has already set it.
    bindHardwareBack(this, () => this.goBack());

    // Lives gate - per PLAN.md §14, now enforced for real. Checked
    // before anything else builds so an out-of-lives player never
    // even sees the board flash before the wall covers it.
    if (getLivesStatus().lives <= 0) {
      this.showOutOfLivesWall(sceneData);
      return;
    }

    this.level = getLevel(sceneData?.levelId ?? 1);
    this.nextLevelId = getNextLevelId(this.level.id);
    // World Map context (set when launched from LevelPathScene). Null
    // when BoardScene is started directly (e.g. old-style testing) -
    // that path still works via nextLevelId/getLevel's global chain.
    this.worldId = sceneData?.worldId ?? null;
    this.levelNum = sceneData?.levelNum ?? null;
    this.movesLeft = this.level.maxSwaps;
    this.targetWord = this.level.targetWord; // only set for type: 'target'
    this.scoreTarget = this.level.scoreTarget; // only set for type: 'free'
    this.levelOver = false;

    // Tap-to-select state (for tap-tap swapping) and swipe tracking (for
    // press-drag-release swapping). Both paths funnel into attemptSwap().
    this.selectedTile = null;
    this.pointerDownTile = null;
    this.pointerDownPos = null;
    this.swipeHandled = false;

    this.computeBoardGeometry();
    this.createBoardBackdrop();
    this.createBoardFrame();
    this.createHud();

    this.createInitialBoard();
    this.setupInput();
    this.ensureSolvable();
  }

  // ---------- board geometry (per-world tile size + centering) ----------

  // Per-world frame art (worldFrames.js) each needs its own tile
  // size/gap to fit inside that frame's own safe zone without covering
  // its corners (see createBoardFrame()) - so tile size/gap are looked
  // up per-instance from the data table rather than always the
  // config.js constants; worlds with no table entry still get the
  // plain TILE_SIZE/TILE_GAP/no-frame look. This also computes how far
  // to shift the grid+frame so they sit centered in the actual play
  // area below the header, not pinned to its top-left corner - the
  // real device canvas (getCanvasSize()) is often taller than the
  // header+grid actually need, which is why the grid was landing high
  // with empty space below it rather than centered.
  computeBoardGeometry() {
    const worldFrame = getWorldFrame(this.worldId);
    const isBoss = this.worldId && this.levelNum === LEVELS_PER_WORLD;
    this.worldFrame = worldFrame;
    this.isBossFrame = Boolean(worldFrame?.bossFrameKey && isBoss);
    this.tileSize = this.isBossFrame ? worldFrame.bossTileSize : worldFrame ? worldFrame.tileSize : TILE_SIZE;
    this.tileGap = this.isBossFrame ? worldFrame.bossTileGap : worldFrame ? worldFrame.tileGap : TILE_GAP;
    this.tileFontSize = this.isBossFrame ? worldFrame.bossTileFontSize : worldFrame ? worldFrame.tileFontSize : 30;
    this.gridPixelSize = BOARD_SIZE * (this.tileSize + this.tileGap);

    // Horizontal: centers the grid in the canvas width. For the
    // unchanged (non-Candy-Garden) tile size this works out to the same
    // 24px BOARD_SIDE_MARGIN already used everywhere else, so it's a
    // drop-in replacement rather than a behavior change for those
    // worlds.
    this.boardOffsetX = Math.max(0, (this.scale.width - this.gridPixelSize) / 2);

    // Vertical: the HUD (top bar + goal banner above, booster bar below -
    // see boardHud.js) reserves its own space; the frame is centered in
    // whatever is left between them. The HUD shrinks a little on short
    // screens (computeHudLayout) rather than overlapping the frame.
    const frameSize = worldFrame ? worldFrame.frameDisplaySize : this.gridPixelSize;
    this.hudLayout = computeHudLayout(this.scale.width, this.scale.height, frameSize);
    // Sits slightly above the exact middle so the leftover space on tall
    // phones is split ~46/54 (a touch closer to the goal banner).
    const gridCenterY = this.hudLayout.topEnd + (this.hudLayout.boardBottom - this.hudLayout.topEnd) * 0.46;
    this.gridTopY = gridCenterY - this.gridPixelSize / 2;
  }

  // ---------- board backdrop (per-world art) ----------

  // Per chat: fills the whole canvas behind the frame with this world's
  // own board background (worlds.js's boardBgKey/boardBgPath). Worlds
  // are being switched over to new sharp 9:16 art one at a time; worlds
  // not switched yet still have the old small blurred/dimmed picture,
  // which works fine here too. No world context (old-style direct
  // BoardScene launch with no worldId) falls back to the original flat
  // color, unchanged.
  //
  // "Cover" fit: scales the picture up until it fills the canvas in
  // both directions and crops the overflow evenly (phones range from
  // about 1:1.7 to 1:2.6, so the picture is never stretched). New art
  // should therefore keep anything important away from the far left and
  // right edges.
  createBoardBackdrop() {
    if (!this.worldId) return;
    const world = getWorld(this.worldId);
    if (!world?.boardBgKey) return;
    const { width, height } = this.scale;
    const img = this.add.image(width / 2, height / 2, world.boardBgKey);
    img.setScale(Math.max(width / img.width, height / img.height));
  }

  // ---------- board frame (per-world art) ----------

  // Generic per-world frame render, driven entirely by worldFrames.js -
  // see that file's header comment for how each world's
  // frameDisplaySize/tileSize/tileGap were derived (measured off the
  // actual PNG pixels, not guessed). Worlds with no table entry get no
  // frame at all and just render the plain tile grid, same as before
  // any of this existed.
  createBoardFrame() {
    if (!this.worldFrame) return;

    const gridCenterX = this.boardOffsetX + this.gridPixelSize / 2;
    const gridCenterY = this.gridTopY + this.gridPixelSize / 2;
    const frameKey = this.isBossFrame ? this.worldFrame.bossFrameKey : this.worldFrame.frameKey;
    const frameDisplaySize = this.worldFrame.frameDisplaySize;

    this.add.image(gridCenterX, gridCenterY, frameKey).setDisplaySize(frameDisplaySize, frameDisplaySize);
  }

  // ---------- HUD (top bar / goal banner / booster bar) ----------

  // Visual layout lives in utils/boardHud.js; this only feeds it the
  // level's data and wires its buttons to the existing game logic.
  createHud() {
    // 'target' levels show the word to find; 'free' levels show the
    // score to reach, with a progress bar + stars filling toward it.
    const isFree = this.level.type === 'free';
    this.hud = createBoardHud(this, this.hudLayout, {
      level: this.level,
      isFree,
      scoreTarget: this.scoreTarget,
      goalLabel: isFree ? `Reach ${this.scoreTarget} points` : `Find: ${this.targetWord}`,
      moves: this.movesLeft,
      onPause: () => this.showPauseMenu(),
      onBomb: () => this.onBombPressed(),
      onShuffle: () => this.onShufflePressed(),
    });
    this.hud.setProgress(this.score);
  }

  // Popups (word toasts / combo text) float just above the board frame.
  get toastY() {
    return this.gridTopY - 6;
  }

  // Gear button: pauses input and shows Resume / Leave. No Restart here
  // on purpose - Restart is what the Bomb booster costs.
  showPauseMenu() {
    if (this.isPaused || this.levelOver) return;
    this.isPaused = true;
    this.deselectTile();

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Interactive overlay swallows taps so nothing underneath reacts.
    const overlay = this.add
      .rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.6)
      .setDepth(2000)
      .setInteractive();

    const cardWidth = BOARD_PIXEL_SIZE.width - 60;
    const cardHeight = 356;
    const card = this.add.container(centerX, centerY).setDepth(2001);

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x2a1f47, 1);
    cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 22);
    cardBg.lineStyle(2, 0xffffff, 0.15);
    cardBg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 22);

    const title = this.add
      .text(0, -cardHeight / 2 + 42, 'Paused', {
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffd93d',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    const close = () => {
      overlay.destroy();
      card.destroy();
      this.isPaused = false;
    };

    card.add([cardBg, title]);

    // Same saved switches as the Settings page (utils/settingsStore.js),
    // so flipping one here changes it there too.
    this.addPauseToggle(card, cardWidth, -82, 'Music', isMusicOn(), setMusicOn);
    this.addPauseToggle(card, cardWidth, -36, 'Sound effects', isSfxOn(), setSfxOn);
    this.addPauseToggle(card, cardWidth, 10, 'Vibration', isHapticsOn(), setHapticsOn);

    card.add(this.createPopupButton(0, 82, 'Resume', 0xffd93d, '#1b1030', close));
    card.add(
      this.createPopupButton(0, 136, 'Leave Level', 0x3a2c5c, '#ffffff', () => {
        close();
        this.goToMainMenu();
      })
    );
  }

  // One label + on/off switch row for the pause card (look matches the
  // Settings page toggles: green when on, muted brown when off).
  addPauseToggle(card, cardWidth, y, label, initialValue, onChange) {
    const rowW = cardWidth - 56;
    const rowBg = this.add.graphics();
    rowBg.fillStyle(0x3a2c5c, 0.55);
    rowBg.fillRoundedRect(-rowW / 2, y - 20, rowW, 40, 12);

    const labelText = this.add
      .text(-rowW / 2 + 16, y, label, { fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#ffffff' })
      .setOrigin(0, 0.5);

    const trackW = 46;
    const trackH = 26;
    const trackX = rowW / 2 - 16 - trackW / 2;
    const onColor = 0x4caf50;
    const offColor = 0x8a7658;
    const knobOffset = trackW / 2 - trackH / 2;

    const track = this.add.rectangle(trackX, y, trackW, trackH, initialValue ? onColor : offColor, 1);
    track.setStrokeStyle(1, 0x000000, 0.3);
    const knob = this.add.circle(trackX + (initialValue ? knobOffset : -knobOffset), y, trackH / 2 - 3, 0xffffff, 1);

    let value = initialValue;
    const hit = this.add.rectangle(0, y, rowW, 40, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      value = !value;
      onChange(value);
      track.setFillStyle(value ? onColor : offColor);
      this.tweens.add({ targets: knob, x: trackX + (value ? knobOffset : -knobOffset), duration: 120, ease: 'Sine.easeOut' });
    });

    card.add([rowBg, labelText, track, knob, hit]);
  }

  // ---------- shuffle / bomb boosters ----------

  onShufflePressed() {
    if (this.isBusy || this.levelOver || this.isPaused) return;
    if (!spendBooster('shuffle')) {
      this.showWordToast('Out of Shuffles!', '#ff6b6b');
      return;
    }
    this.hud.refreshBoosters();
    this.shuffleBoard(false);
  }

  // Bomb: "clears/resets the current board for another attempt"
  // (PLAN.md §14) - the simplest reliable way to do that is restarting
  // the scene fresh (same init path as a normal level start), rather
  // than trying to hand-reset moves/board/score mid-scene. Needs a
  // confirm tap first (per §14's "avoid accidental taps" note) - tap
  // once to arm (the button pulses + shows a hint), tap again to fire.
  onBombPressed() {
    if (this.isBusy || this.levelOver || this.isPaused) return;
    if (getBoosters().bomb <= 0) {
      this.showWordToast('Out of Bombs!', '#ff6b6b');
      return;
    }
    if (!this.hud.bombArmed) {
      this.hud.setBombArmed(true);
      this.time.delayedCall(2500, () => {
        if (this.hud?.bombArmed) this.hud.setBombArmed(false);
      });
      return;
    }
    this.hud.setBombArmed(false);
    spendBooster('bomb');
    this.restartLevel();
  }

  // Silent safety net: called after the board first appears and after every
  // fall/cascade settles. If literally no swap on the board could create a
  // word, the player has no legal move - so we reshuffle automatically,
  // without a toast, before they'd ever notice. This is what makes the
  // manual Shuffle button "optional" rather than load-bearing.
  async ensureSolvable() {
    if (!this.hasValidSwap()) {
      await this.shuffleBoard(true);
    }
  }

  lineHasWord(letters) {
    for (let i = 0; i < letters.length; i++) {
      const maxLen = Math.min(MAX_WORD_LENGTH, letters.length - i);
      for (let len = MIN_WORD_LENGTH; len <= maxLen; len++) {
        const forward = letters.slice(i, i + len).join('');
        if (WORD_SET.has(forward)) return true;
        const backward = forward.split('').reverse().join('');
        if (WORD_SET.has(backward)) return true;
      }
    }
    return false;
  }

  // True if there exists at least one adjacent pair on the board that,
  // if swapped, would create a word in the row and/or column it lands in.
  // This is the real "is there a legal move" check for the swap mechanic -
  // unlike checking whether a word already exists (which, post-cascade,
  // is normally false anyway since existing words auto-clear).
  hasValidSwap() {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (col + 1 < BOARD_SIZE && this.wouldSwapCreateWord(row, col, row, col + 1)) return true;
        if (row + 1 < BOARD_SIZE && this.wouldSwapCreateWord(row, col, row + 1, col)) return true;
      }
    }
    return false;
  }

  // Temporarily swaps two cells' letters, checks only the rows/columns that
  // could possibly be affected (at most 2 rows + 2 cols), then reverts.
  wouldSwapCreateWord(r1, c1, r2, c2) {
    const tileA = this.grid[r1][c1];
    const tileB = this.grid[r2][c2];
    const letterA = tileA.letter;
    const letterB = tileB.letter;

    tileA.letter = letterB;
    tileB.letter = letterA;

    let found = false;
    for (const r of new Set([r1, r2])) {
      const letters = [];
      for (let c = 0; c < BOARD_SIZE; c++) letters.push(this.grid[r][c].letter);
      if (this.lineHasWord(letters)) {
        found = true;
        break;
      }
    }
    if (!found) {
      for (const c of new Set([c1, c2])) {
        const letters = [];
        for (let r = 0; r < BOARD_SIZE; r++) letters.push(this.grid[r][c].letter);
        if (this.lineHasWord(letters)) {
          found = true;
          break;
        }
      }
    }

    tileA.letter = letterA;
    tileB.letter = letterB;
    return found;
  }

  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // Reassigns existing tiles' letters (no new tiles, no re-layout) to a
  // shuffled arrangement guaranteed to have at least one valid swap,
  // retrying a bounded number of times before giving up and accepting
  // whatever it landed on.
  async shuffleBoard(silent = false) {
    this.deselectTile();
    this.pointerDownTile = null;
    this.isBusy = true;

    const tiles = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        tiles.push(this.grid[row][col]);
      }
    }
    const originalLetters = tiles.map((t) => t.letter);

    // A shuffle only rearranges the existing letter multiset - it can never
    // introduce a letter the board doesn't already have. If a target letter
    // has drifted out entirely, inject it here before shuffling (the later
    // resolveAutoMatches(1) call below won't help with this: it only runs
    // ensureTargetLettersPresent() when a cascade actually happens).
    // Free-play levels have no target word, so nothing to preserve here.
    if (this.targetWord) {
      for (const letter of new Set(this.targetWord.split(''))) {
        if (!originalLetters.includes(letter)) {
          const idx = Math.floor(Math.random() * originalLetters.length);
          originalLetters[idx] = letter;
        }
      }
    }

    let candidate = [...originalLetters];
    let attempts = 0;
    do {
      candidate = [...originalLetters];
      this.shuffleArray(candidate);
      tiles.forEach((t, i) => {
        t.letter = candidate[i];
      });
      attempts += 1;
    } while (!this.hasValidSwap() && attempts < 50);

    await Promise.all(
      tiles.map((tile, i) =>
        this.tweenPromise({
          targets: tile.container,
          scale: 0,
          duration: 110,
          ease: 'Sine.easeIn',
          onComplete: () => {
            tile.text.setText(candidate[i]);
            tile.bg.setFillStyle(LETTER_COLORS[candidate[i]] ?? 0xffffff);
          },
        })
      )
    );
    await Promise.all(
      tiles.map((tile) =>
        this.tweenPromise({
          targets: tile.container,
          scale: 1,
          duration: 140,
          ease: 'Back.easeOut',
        })
      )
    );

    if (!silent) this.showWordToast('Shuffled!', '#6bc9ef');

    // The retry loop above only guarantees a FUTURE swap could create a
    // word - it says nothing about whether the shuffle itself just handed
    // out a word for free. Run the same full-board clear/cascade pass that
    // follows every other board change so an accidental word never just
    // sits there unclaimed (see attemptSwap/collapseAndRefill).
    await this.resolveAutoMatches(1);
    await this.ensureSolvable();
    this.isBusy = false;
  }

  // ---------- geometry ----------

  cellToPixel(row, col) {
    return {
      x: this.boardOffsetX + col * (this.tileSize + this.tileGap) + this.tileSize / 2,
      y: this.gridTopY + row * (this.tileSize + this.tileGap) + this.tileSize / 2,
    };
  }

  cellFromPixel(x, y) {
    const col = Math.floor((x - this.boardOffsetX) / (this.tileSize + this.tileGap));
    const row = Math.floor((y - this.gridTopY) / (this.tileSize + this.tileGap));
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
    return { row, col };
  }

  // ---------- board setup ----------

  createInitialBoard() {
    // Target-word levels (every 5th level, per PLAN.md) use the
    // guaranteed generator: it builds the board backwards from a solved
    // state so targetWord is provably reachable within maxSwaps, instead
    // of the old "fill randomly, hope the letters happen to line up"
    // approach. Free-play levels don't have a fixed word to guarantee, so
    // they keep the original random fill.
    if (this.level.type === 'target') {
      const scrambleCount = this.level.scrambleCount
        ?? SCRAMBLE_COUNT_BY_LENGTH[this.targetWord.length]
        ?? 10;
      const { grid: letterGrid } = generateGuaranteedBoard(this.targetWord, scrambleCount);
      for (let row = 0; row < BOARD_SIZE; row++) {
        this.grid.push([]);
        for (let col = 0; col < BOARD_SIZE; col++) {
          this.grid[row][col] = this.createTile(row, col, letterGrid[row][col]);
        }
      }
      return;
    }

    for (let row = 0; row < BOARD_SIZE; row++) {
      this.grid.push([]);
      for (let col = 0; col < BOARD_SIZE; col++) {
        const letter = this.pickNonMatchingLetter(row, col);
        this.grid[row][col] = this.createTile(row, col, letter);
      }
    }
    this.ensureTargetLettersPresent();
  }

  // Necessary-but-not-sufficient guarantee for target-word solvability
  // (full in-order/adjacency reachability-within-moves is still an open
  // problem - see PLAN.md): makes sure every distinct letter the target
  // word needs actually exists SOMEWHERE on the board. Without this, a
  // level's target can be flat-out impossible from the deal alone (e.g.
  // "BAG" with zero B tiles anywhere) - low-frequency letters like B, Q,
  // X, Z are common enough that this isn't rare bad luck, it happens
  // routinely with a ~2% per-tile chance for a letter like B.
  //
  // Called after the initial deal AND after every refill (new tiles are
  // random too, so a needed letter can vanish again once its last copy on
  // the board gets cleared as part of scoring some other word).
  ensureTargetLettersPresent() {
    if (!this.targetWord) return; // free-play levels have no target word to guarantee
    const needed = [...new Set(this.targetWord.split(''))].filter((letter) => !this.boardHasLetter(letter));
    if (needed.length === 0) return;

    // Sample DISTINCT tiles for the missing letters (not just independent
    // random picks) - otherwise two missing letters can land on the same
    // tile and overwrite each other, silently undoing the guarantee for
    // whichever one got placed first.
    const cells = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) cells.push([row, col]);
    }
    this.shuffleArray(cells);

    needed.forEach((letter, i) => {
      const [row, col] = cells[i];
      const tile = this.grid[row]?.[col];
      if (!tile) return;
      tile.letter = letter;
      tile.text.setText(letter);
      tile.bg.setFillStyle(LETTER_COLORS[letter] ?? 0xffffff);
    });
  }

  boardHasLetter(letter) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (this.grid[row][col]?.letter === letter) return true;
      }
    }
    return false;
  }

  // Avoids spawning a real word by chance so the board isn't handing out a
  // free auto-clear the moment it appears. Only needs to look backward
  // (left/up) since forward cells don't exist yet during generation.
  pickNonMatchingLetter(row, col) {
    let letter = randomLetter();
    let attempts = 0;
    while (this.wouldFormWordAt(row, col, letter) && attempts < 30) {
      letter = randomLetter();
      attempts += 1;
    }
    return letter;
  }

  wouldFormWordAt(row, col, letter) {
    for (let len = MIN_WORD_LENGTH; len <= MAX_WORD_LENGTH; len++) {
      if (col - len + 1 >= 0) {
        let word = '';
        for (let c = col - len + 1; c <= col; c++) {
          word += c === col ? letter : this.grid[row][c]?.letter ?? '';
        }
        if (word.length === len && WORD_SET.has(word)) return true;
      }
      if (row - len + 1 >= 0) {
        let word = '';
        for (let r = row - len + 1; r <= row; r++) {
          word += r === row ? letter : this.grid[r][col]?.letter ?? '';
        }
        if (word.length === len && WORD_SET.has(word)) return true;
      }
    }
    return false;
  }

  createTile(row, col, letter, spawnAbove = false) {
    const { x, y } = this.cellToPixel(row, col);
    const spawnY = y - (row + 4) * (this.tileSize + this.tileGap);
    const container = this.add.container(x, spawnAbove ? spawnY : y);

    const color = LETTER_COLORS[letter] ?? 0xffffff;
    const bg = this.add.rectangle(0, 0, this.tileSize, this.tileSize, color);
    bg.setStrokeStyle(3, 0x1b1030, 0.35);

    const text = this.add
      .text(0, 0, letter, {
        fontSize: `${this.tileFontSize}px`,
        fontStyle: 'bold',
        color: '#1b1030',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    container.add([bg, text]);

    // Glass-tile look (extended to all worlds, per chat), applied on
    // top of the plain color rect (bg) rather than replacing it, since
    // bg still needs its fill/stroke swapped around by
    // setFillStyle/setTileHighlight elsewhere (solvability re-rolls,
    // tap-to-select) - it's a static decoration, not per-letter state,
    // so it never needs to be touched again after creation. Diagonal
    // white-to-transparent sheen (top-left corner brightest) plus a
    // faint dark wash in the bottom-right corner approximates a
    // beveled glass surface; a soft white rim stroke on top of that
    // sells the edge highlight.
    {
      const half = this.tileSize / 2;
      const glass = this.add.graphics();
      glass.fillGradientStyle(0xffffff, 0xffffff, 0x000000, 0x000000, 0.55, 0.12, 0.1, 0.3);
      glass.fillRoundedRect(-half, -half, this.tileSize, this.tileSize, 8);
      glass.lineStyle(1.5, 0xffffff, 0.65);
      glass.strokeRoundedRect(-half, -half, this.tileSize, this.tileSize, 8);
      container.add(glass);
      container.moveTo(glass, 1); // above bg, below text
      container.bringToTop(text);
    }

    container.setSize(this.tileSize, this.tileSize);

    const tile = { row, col, letter, container, bg, text };
    return tile;
  }

  // ---------- glass-shatter clear effect ----------

  // Per chat: match-clears on the glass tiles shatter (all worlds)
  // instead of just scaling/fading out. Cheap approximation - no
  // texture slicing, just a handful of small colored shard rectangles
  // spawned at the tile's position, flung outward with random angle/
  // rotation, and faded over the same rough duration as the old tween
  // so cascades don't feel slower. Shards are added directly to the
  // scene (not the tile's container) so they can fly free of it while
  // the container itself is destroyed immediately.
  shatterTile(tile) {
    const { x, y } = tile.container;
    const color = tile.bg.fillColor;
    const shardCount = 6;
    const promises = [];

    // Quick white flash to sell the "crack" moment before the shards
    // fly, per chat's "shatter" pick over a plain crush/pop.
    const flash = this.add.rectangle(x, y, this.tileSize, this.tileSize, 0xffffff, 0.85);
    flash.setDepth(5);
    promises.push(
      this.tweenPromise({ targets: flash, alpha: 0, duration: 90, ease: 'Sine.easeIn' }).then(() =>
        flash.destroy()
      )
    );

    for (let i = 0; i < shardCount; i++) {
      const shardSize = this.tileSize * Phaser.Math.FloatBetween(0.22, 0.4);
      const shard = this.add.rectangle(x, y, shardSize, shardSize * 0.7, color);
      shard.setAngle(Phaser.Math.Between(0, 360));
      shard.setDepth(4);

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.FloatBetween(this.tileSize * 0.6, this.tileSize * 1.1);
      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance;

      promises.push(
        this.tweenPromise({
          targets: shard,
          x: targetX,
          y: targetY,
          angle: shard.angle + Phaser.Math.Between(-180, 180),
          scale: 0,
          alpha: 0,
          duration: 220,
          ease: 'Cubic.easeOut',
        }).then(() => shard.destroy())
      );
    }

    return Promise.all(promises);
  }

  // ---------- input (tap-tap or swipe to swap) ----------

  setupInput() {
    this.input.on('pointerdown', (pointer) => this.handlePointerDown(pointer));
    this.input.on('pointermove', (pointer) => this.handlePointerMove(pointer));
    this.input.on('pointerup', () => this.handlePointerUp());
    this.input.on('pointerupoutside', () => this.handlePointerUp());
  }

  isOrthogonallyAdjacent(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  selectTile(tile) {
    this.selectedTile = tile;
    this.setTileHighlight(tile, true);
  }

  deselectTile() {
    if (this.selectedTile) this.setTileHighlight(this.selectedTile, false);
    this.selectedTile = null;
  }

  handlePointerDown(pointer) {
    if (this.isBusy || this.levelOver || this.isPaused) return;
    const cell = this.cellFromPixel(pointer.x, pointer.y);
    if (!cell) return;
    const tile = this.grid[cell.row][cell.col];
    if (!tile) return;

    this.pointerDownTile = tile;
    this.pointerDownPos = { x: pointer.x, y: pointer.y };
    this.swipeHandled = false;

    if (this.selectedTile && this.selectedTile !== tile) {
      // Second tap: swap if adjacent, otherwise move the selection.
      if (this.isOrthogonallyAdjacent(this.selectedTile, tile)) {
        const a = this.selectedTile;
        this.deselectTile();
        this.swipeHandled = true;
        this.pointerDownTile = null;
        this.attemptSwap(a, tile);
      } else {
        this.deselectTile();
        this.selectTile(tile);
      }
      return;
    }

    if (this.selectedTile === tile) {
      // Tapping the same tile again deselects it.
      this.deselectTile();
      this.pointerDownTile = null;
      return;
    }

    this.selectTile(tile);
  }

  handlePointerMove(pointer) {
    if (this.isBusy || this.levelOver || this.isPaused || this.swipeHandled || !this.pointerDownTile) return;

    const dx = pointer.x - this.pointerDownPos.x;
    const dy = pointer.y - this.pointerDownPos.y;
    const threshold = this.tileSize * 0.35;
    if (Math.hypot(dx, dy) < threshold) return;

    let dRow = 0;
    let dCol = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      dCol = dx > 0 ? 1 : -1;
    } else {
      dRow = dy > 0 ? 1 : -1;
    }

    const targetRow = this.pointerDownTile.row + dRow;
    const targetCol = this.pointerDownTile.col + dCol;
    if (targetRow < 0 || targetRow >= BOARD_SIZE || targetCol < 0 || targetCol >= BOARD_SIZE) return;

    const targetTile = this.grid[targetRow][targetCol];
    if (!targetTile) return;

    this.swipeHandled = true;
    const a = this.pointerDownTile;
    this.deselectTile();
    this.pointerDownTile = null;
    this.attemptSwap(a, targetTile);
  }

  handlePointerUp() {
    this.pointerDownTile = null;
    this.pointerDownPos = null;
    // this.selectedTile is intentionally left alone here: a plain tap with
    // no swipe leaves the tile selected, awaiting a second tap to swap.
  }

  setTileHighlight(tile, on) {
    tile.bg.setStrokeStyle(on ? 5 : 3, on ? 0xffffff : 0x1b1030, on ? 1 : 0.35);
    this.tweens.add({
      targets: tile.container,
      scale: on ? 1.08 : 1,
      duration: 120,
      ease: 'Sine.easeOut',
    });
  }

  // ---------- swap / commit / cascade loop ----------

  // Swaps two tiles' grid positions and animates their containers to the
  // new spots. Calling this twice in a row on the same pair (swap, then
  // swap again) returns the board to its original state - that's how a
  // rejected swap bounces back.
  async animateSwap(tileA, tileB) {
    this.grid[tileA.row][tileA.col] = tileB;
    this.grid[tileB.row][tileB.col] = tileA;

    const aRow = tileA.row;
    const aCol = tileA.col;
    const bRow = tileB.row;
    const bCol = tileB.col;

    tileA.row = bRow;
    tileA.col = bCol;
    tileB.row = aRow;
    tileB.col = aCol;

    const posA = this.cellToPixel(tileA.row, tileA.col);
    const posB = this.cellToPixel(tileB.row, tileB.col);

    await Promise.all([
      this.tweenPromise({ targets: tileA.container, x: posA.x, y: posA.y, duration: 160, ease: 'Sine.easeInOut' }),
      this.tweenPromise({ targets: tileB.container, x: posB.x, y: posB.y, duration: 160, ease: 'Sine.easeInOut' }),
    ]);
  }

  async attemptSwap(tileA, tileB) {
    if (this.levelOver) return;
    this.isBusy = true;
    await this.animateSwap(tileA, tileB);

    const { matchedCells, wordsFound } = this.findWordMatches();

    if (matchedCells.size === 0) {
      // No word anywhere on the board as a result of this swap - bounce
      // back, classic invalid-swap feedback. Doesn't cost a move.
      const failColor = 0xff4757;
      await Promise.all(
        [tileA, tileB].map((tile) =>
          this.tweenPromise({
            targets: tile.bg,
            fillColor: failColor,
            duration: 90,
            yoyo: true,
          })
        )
      );
      await this.animateSwap(tileA, tileB);
      this.isBusy = false;
      return;
    }

    const points = wordsFound.reduce((sum, w) => sum + w.length * 20, 0);
    this.score += points;
    this.updateScoreText();

    if (wordsFound.length > 1) {
      this.showComboText(1, wordsFound, 'x2!');
    } else {
      this.showWordToast(wordsFound[0], '#7CFC9A');
    }

    this.spendMove();
    this.checkWinCondition(wordsFound);
    if (this.levelOver) {
      // onLevelWon()/onLevelLost() already popped the end-of-level overlay -
      // don't keep clearing/refilling/cascading underneath it. Screenshot
      // bug: without this guard, resolveAutoMatches kept recursing into
      // further cascade chains (visible as "Chain x6!" toasts) while the
      // win popup was already on screen.
      this.isBusy = false;
      return;
    }

    await this.clearTiles(matchedCells);
    await this.collapseAndRefill();
    if (!this.levelOver) this.ensureTargetLettersPresent();
    await this.resolveAutoMatches(2);
    if (this.levelOver) {
      // resolveAutoMatches can win/lose mid-cascade recursion (same fix as
      // above) - if it did, skip ensureSolvable() too, since reshuffling
      // the board is pointless (and visually jarring) once the end-of-level
      // overlay is already showing.
      this.isBusy = false;
      return;
    }
    await this.ensureSolvable();
    this.checkLevelEnd();
    this.isBusy = false;
  }

  // ---------- level end conditions ----------

  spendMove() {
    this.movesLeft = Math.max(0, this.movesLeft - 1);
    this.hud.setMoves(this.movesLeft);
  }

  // The win condition can be met either as the direct result of the
  // player's swap, or a moment later during an auto-cascade - either way
  // it counts, so this is called from both attemptSwap and
  // resolveAutoMatches. Branches by level type:
  //   'target' - wordsFound must include the specific target word.
  //   'free'   - score must reach scoreTarget (wordsFound is irrelevant
  //              here since ANY word contributes to the free-play score).
  checkWinCondition(wordsFound) {
    if (this.levelOver) return;
    if (this.level.type === 'free') {
      if (this.score >= this.scoreTarget) this.onLevelWon();
      return;
    }
    if (wordsFound.includes(this.targetWord)) {
      this.onLevelWon();
    }
  }

  // Called once the swap + any chained cascades have fully settled. Only
  // reachable here if checkWinCondition() didn't already win the level
  // above, so a level can never simultaneously "win" and "run out of
  // moves" - a win found mid-cascade always takes priority.
  checkLevelEnd() {
    if (this.levelOver) return;
    if (this.movesLeft <= 0) {
      this.onLevelLost();
    }
  }

  onLevelWon() {
    this.levelOver = true;
    this.deselectTile();
    if (this.worldId) completeLevel(this.level.id);
    syncLocalProgressToCloud();

    const isBoss = this.worldId && this.levelNum === LEVELS_PER_WORLD;
    const message = this.level.type === 'free' ? `You reached ${this.score} points!` : `You spelled ${this.targetWord}`;
    this.showEndPopup({
      title: 'Great Word!',
      titleColor: '#ffd93d',
      message,
      messageColor: '#7CFC9A',
      primaryLabel: this.worldId ? (isBoss ? 'World Map' : 'Next Level') : this.nextLevelId ? 'Next Level' : 'Back to Menu',
      primaryAction: () => this.goToNextLevelOrMenu(),
      secondaryLabel: 'Replay',
      secondaryAction: () => this.restartLevel(),
    });
  }

  onLevelLost() {
    this.levelOver = true;
    this.deselectTile();
    loseLife();
    const message = this.level.type === 'free'
      ? `Needed: ${this.scoreTarget} points (got ${this.score})`
      : `Needed: ${this.targetWord}`;
    this.showEndPopup({
      title: 'Out of Moves',
      titleColor: '#ff4757',
      message,
      messageColor: '#a79ccf',
      primaryLabel: 'Try Again',
      primaryAction: () => this.restartLevel(),
      secondaryLabel: this.worldId ? 'Level Path' : 'Main Menu',
      secondaryAction: () => this.goToMainMenu(),
    });
  }

  restartLevel() {
    this.scene.restart({ levelId: this.level.id, worldId: this.worldId, levelNum: this.levelNum });
  }

  // Named "main menu" for historical reasons (pre-World Map, this only
  // ever went to MainMenuScene) - now returns to whichever screen makes
  // sense: LevelPathScene if we got here via the World Map, otherwise
  // the actual main menu for direct/legacy BoardScene launches.
  goToMainMenu() {
    this.cameras.main.fadeOut(220, ...APP_BG_COLOR_RGB);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this.worldId) {
        this.scene.start('LevelPathScene', { worldId: this.worldId });
      } else {
        this.scene.start('MainMenuScene');
      }
    });
  }

  goToNextLevelOrMenu() {
    if (this.worldId) {
      const isBoss = this.levelNum === LEVELS_PER_WORLD;
      this.cameras.main.fadeOut(220, ...APP_BG_COLOR_RGB);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        if (isBoss) {
          // Beating a boss may have just unlocked the next world -
          // World Map is more useful here than jumping straight into
          // level 1 of a world the player hasn't chosen to enter yet.
          this.scene.start('WorldSelectScene');
        } else {
          const nextLevelNum = this.levelNum + 1;
          this.scene.start('BoardScene', {
            levelId: levelIdFor(this.worldId, nextLevelNum),
            worldId: this.worldId,
            levelNum: nextLevelNum,
          });
        }
      });
      return;
    }

    if (this.nextLevelId) {
      this.cameras.main.fadeOut(220, ...APP_BG_COLOR_RGB);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('BoardScene', { levelId: this.nextLevelId });
      });
    } else {
      this.goToMainMenu();
    }
  }

  // Card-style end-of-level popup: dim overlay, title, message, score, and
  // one or two buttons. Used for both win and lose - which buttons/colors
  // show is entirely driven by the config object passed in.
  showEndPopup({ title, titleColor, message, messageColor, primaryLabel, primaryAction, secondaryLabel, secondaryAction }) {
    // Use the real canvas size here, not BOARD_PIXEL_SIZE - the canvas is
    // now taller than the board+header content so the dim overlay needs
    // to cover the whole screen, not just the old 516x624 board area.
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const overlay = this.add
      .rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.6)
      .setAlpha(0);

    const cardWidth = BOARD_PIXEL_SIZE.width - 60;
    const cardHeight = 260;
    const card = this.add.container(centerX, centerY).setAlpha(0).setScale(0.85);

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x2a1f47, 1);
    cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 22);
    cardBg.lineStyle(2, 0xffffff, 0.15);
    cardBg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 22);

    const titleText = this.add
      .text(0, -cardHeight / 2 + 44, title, {
        fontSize: '26px',
        fontStyle: 'bold',
        color: titleColor,
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    const messageText = this.add
      .text(0, -cardHeight / 2 + 84, message, {
        fontSize: '16px',
        color: messageColor,
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    const scoreText = this.add
      .text(0, -cardHeight / 2 + 114, `Score: ${this.score}`, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffd93d',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    card.add([cardBg, titleText, messageText, scoreText]);
    card.add(this.createPopupButton(0, 46, primaryLabel, 0xffd93d, '#1b1030', primaryAction));
    card.add(this.createPopupButton(0, 96, secondaryLabel, 0x3a2c5c, '#ffffff', secondaryAction));

    this.tweens.add({ targets: overlay, alpha: 1, duration: 220 });
    this.tweens.add({
      targets: card,
      alpha: 1,
      scale: 1,
      duration: 260,
      ease: 'Back.easeOut',
    });
  }

  createPopupButton(x, y, label, fillColor, textColor, onClick) {
    const width = 200;
    const height = 42;
    const button = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(fillColor, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 14);

    const text = this.add
      .text(0, 0, label, {
        fontSize: '16px',
        fontStyle: 'bold',
        color: textColor,
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    button.add([bg, text]);
    button.setSize(width, height);
    button.setInteractive({ useHandCursor: true });

    button.on('pointerdown', () => {
      this.tweens.add({ targets: button, scale: 0.94, duration: 80 });
    });
    button.on('pointerup', () => {
      this.tweens.add({
        targets: button,
        scale: 1,
        duration: 100,
        onComplete: onClick,
      });
    });
    button.on('pointerout', () => {
      this.tweens.add({ targets: button, scale: 1, duration: 100 });
    });

    return button;
  }

  // Scans a full row/column of letters left-to-right (or top-to-bottom) and
  // greedily takes the longest dictionary word at each position, then jumps
  // past it - so overlapping substrings don't all score separately. Checks
  // BOTH reading directions (matches PLAN.md §2's "row or column, either
  // reading direction" and hasValidSwap/wouldSwapCreateWord's own
  // lineHasWord, which already checked both) - this used to be forward-only,
  // which meant a swap hasValidSwap() considered "legal" (because it forms
  // a backward-reading word) could actually bounce back with zero effect
  // when played, since this function never saw the reverse match. That
  // let a board pass the auto-reshuffle safety-net check while having zero
  // swaps that actually cleared anything - found via playtest simulation,
  // reproducible in ~1-11% of trials depending on level. When a reverse
  // match wins, the reported word is the correctly-spelled dictionary word
  // (not the on-board reversed letters), matching how checkWinCondition
  // compares against `targetWord`.
  scanLineForWords(letters) {
    const found = [];
    let i = 0;
    while (i < letters.length) {
      let matchedLen = 0;
      const maxLen = Math.min(MAX_WORD_LENGTH, letters.length - i);
      for (let len = maxLen; len >= MIN_WORD_LENGTH; len--) {
        const segment = letters.slice(i, i + len).join('');
        if (WORD_SET.has(segment)) {
          found.push({ start: i, length: len, word: segment, wasReversed: false });
          matchedLen = len;
          break;
        }
        const reversed = segment.split('').reverse().join('');
        if (WORD_SET.has(reversed)) {
          // wasReversed: this word matched via the on-board letters read
          // backward (e.g. board shows B-O-L, credited word is LOB). The
          // clear/score logic doesn't need this - `word` is already the
          // correctly-spelled dictionary word - but a future kids-mode
          // clear animation can use this flag to visually flip the tiles
          // or show "BOL -> LOB!" before clearing, so kids always see the
          // word spelled correctly at the moment it's credited, rather
          // than silently crediting a word they never saw in order. See
          // update.md "Next up" for the reasoning.
          found.push({ start: i, length: len, word: reversed, wasReversed: true });
          matchedLen = len;
          break;
        }
      }
      i += matchedLen > 0 ? matchedLen : 1;
    }
    return found;
  }

  findWordMatches() {
    const matchedCells = new Set();
    const wordsFound = [];

    for (let row = 0; row < BOARD_SIZE; row++) {
      const letters = [];
      for (let col = 0; col < BOARD_SIZE; col++) letters.push(this.grid[row][col].letter);
      for (const m of this.scanLineForWords(letters)) {
        wordsFound.push(m.word);
        for (let c = m.start; c < m.start + m.length; c++) matchedCells.add(`${row},${c}`);
      }
    }

    for (let col = 0; col < BOARD_SIZE; col++) {
      const letters = [];
      for (let row = 0; row < BOARD_SIZE; row++) letters.push(this.grid[row][col].letter);
      for (const m of this.scanLineForWords(letters)) {
        wordsFound.push(m.word);
        for (let r = m.start; r < m.start + m.length; r++) matchedCells.add(`${r},${col}`);
      }
    }

    return { matchedCells, wordsFound };
  }

  async resolveAutoMatches(chainLevel) {
    const { matchedCells, wordsFound } = this.findWordMatches();
    if (matchedCells.size === 0) return;

    const points = wordsFound.reduce((sum, w) => sum + w.length * 10, 0) * chainLevel;
    this.score += points;
    this.updateScoreText();

    this.showComboText(chainLevel, wordsFound);
    this.checkWinCondition(wordsFound);
    if (this.levelOver) return; // same guard as attemptSwap - stop the chain once won/lost

    await this.clearTiles(matchedCells);
    await this.collapseAndRefill();
    if (!this.levelOver) this.ensureTargetLettersPresent();
    await this.resolveAutoMatches(chainLevel + 1);
  }

  showWordToast(word, color) {
    this.spawnCandyPop(word, color, { fontSize: '26px', y: this.toastY });
  }

  showComboText(chainLevel, wordsFound, labelOverride) {
    const tierColors = ['#ffd93d', '#ff9f43', '#ff6b9d', '#b57bff'];
    const color = tierColors[Math.min(chainLevel - 1, tierColors.length - 1)];
    const text = labelOverride
      ? `${wordsFound.join(', ')} ${labelOverride}`
      : `Chain x${chainLevel}! ${wordsFound.join(', ')}`;

    this.cameras.main.shake(120, 0.004 + chainLevel * 0.0008);

    this.spawnCandyPop(text, color, {
      fontSize: chainLevel > 1 ? '27px' : '22px',
      y: this.toastY + 10,
      wordWrap: BOARD_PIXEL_SIZE.width - 30,
      sparkle: chainLevel > 1,
    });
  }

  // Candy-Crush-style punchy popup: bold outlined/shadowed text that pops in
  // with an overshoot + tiny rotation wobble, holds briefly, then floats up
  // and fades. Always drawn above the board (see setDepth).
  spawnCandyPop(text, color, opts = {}) {
    const { fontSize = '24px', y = this.toastY, wordWrap, sparkle = false } = opts;
    const x = BOARD_PIXEL_SIZE.width / 2;

    const label = this.add
      .text(x, y, text, {
        fontSize,
        fontStyle: '800',
        color,
        fontFamily: '"Baloo 2", "Arial Black", system-ui, sans-serif',
        align: 'center',
        stroke: '#1b1030',
        strokeThickness: 6,
        shadow: { offsetX: 0, offsetY: 3, color: '#000000', blur: 6, fill: true },
        ...(wordWrap ? { wordWrap: { width: wordWrap } } : {}),
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.4)
      .setRotation(-0.08)
      .setDepth(1000);

    if (sparkle) this.spawnSparkleBurst(x, y, color);

    this.tweens.add({
      targets: label,
      alpha: 1,
      scale: 1.15,
      rotation: 0.03,
      duration: 180,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: label,
          scale: 1,
          rotation: 0,
          duration: 140,
          ease: 'Sine.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: label,
              alpha: 0,
              y: label.y - 18,
              delay: 280,
              duration: 280,
              onComplete: () => label.destroy(),
            });
          },
        });
      },
    });
  }

  // Small burst of candy-colored star sparkles behind bigger combos.
  spawnSparkleBurst(x, y, hexColor) {
    const base = Phaser.Display.Color.HexStringToColor(hexColor).color;
    const palette = [base, 0xffd93d, 0xff9f43, 0x7ce0ff];
    const count = 6;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.25, 0.25);
      const dist = Phaser.Math.Between(30, 50);
      const star = this.add
        .star(x, y, 5, 3, 7, palette[i % palette.length])
        .setDepth(999)
        .setAlpha(0.95)
        .setScale(0.3);

      this.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.9,
        rotation: Phaser.Math.FloatBetween(-1, 1),
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  async clearTiles(matchedKeys) {
    const tiles = [];
    for (const key of matchedKeys) {
      const [row, col] = key.split(',').map(Number);
      const tile = this.grid[row][col];
      if (tile) {
        tiles.push(tile);
        this.grid[row][col] = null;
      }
    }

    // Glass-shatter clear (all worlds, per chat) instead of a plain
    // scale/fade. Container destroyed immediately since the shards
    // (spawned at its position) fly independently of it.
    await Promise.all(
      tiles.map((tile) => {
        // shatterTile reads container.x/y and bg.fillColor
        // synchronously before it awaits anything, so it's safe to
        // destroy the (now-visually-replaced) container right after
        // calling it rather than waiting on it.
        const promise = this.shatterTile(tile);
        tile.container.destroy();
        return promise;
      })
    );
  }

  async collapseAndRefill() {
    const fallPromises = [];

    for (let col = 0; col < BOARD_SIZE; col++) {
      const existing = [];
      for (let row = 0; row < BOARD_SIZE; row++) {
        if (this.grid[row][col]) existing.push(this.grid[row][col]);
      }

      const emptyCount = BOARD_SIZE - existing.length;
      const newColumn = new Array(BOARD_SIZE).fill(null);

      for (let i = 0; i < existing.length; i++) {
        newColumn[emptyCount + i] = existing[i];
      }
      for (let row = 0; row < emptyCount; row++) {
        newColumn[row] = this.createTile(row, col, randomLetter(), true);
      }

      for (let row = 0; row < BOARD_SIZE; row++) {
        const tile = newColumn[row];
        tile.row = row;
        tile.col = col;
        this.grid[row][col] = tile;

        const { x, y } = this.cellToPixel(row, col);
        fallPromises.push(
          this.tweenPromise({
            targets: tile.container,
            x,
            y,
            duration: 260,
            delay: row * 25,
            ease: 'Bounce.easeOut',
          })
        );
      }
    }

    await Promise.all(fallPromises);
  }

  // ---------- helpers ----------

  tweenPromise(tweenConfig) {
    return new Promise((resolve) => {
      this.tweens.add({ ...tweenConfig, onComplete: resolve });
    });
  }

  updateScoreText() {
    this.hud.setProgress(this.score);
  }
}
