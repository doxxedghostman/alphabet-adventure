import Phaser from 'phaser';
import {
  BOARD_SIZE,
  TILE_SIZE,
  TILE_GAP,
  BOARD_TOP_MARGIN,
  BOARD_SIDE_MARGIN,
  BOARD_PIXEL_SIZE,
  LETTER_COLORS,
  MIN_WORD_LENGTH,
  MAX_WORD_LENGTH,
  randomLetter,
} from '../config.js';
import { WORD_SET } from '../data/wordlist.js';
import { getLevel } from '../data/levels.js';

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

  create(sceneData) {
    this.isBusy = false;
    this.score = 0;
    this.grid = [];

    this.level = getLevel(sceneData?.levelId ?? 1);
    this.movesLeft = this.level.maxSwaps;
    this.targetWord = this.level.targetWord;
    this.levelOver = false;

    // Tap-to-select state (for tap-tap swapping) and swipe tracking (for
    // press-drag-release swapping). Both paths funnel into attemptSwap().
    this.selectedTile = null;
    this.pointerDownTile = null;
    this.pointerDownPos = null;
    this.swipeHandled = false;

    this.createHeader();
    this.createShuffleButton();

    this.createInitialBoard();
    this.setupInput();
    this.ensureSolvable();
  }

  // ---------- header (level / moves / goal / score) ----------

  createHeader() {
    this.createPill(20, 18, `Level ${this.level.id}`, 0xffd93d, 'left');
    this.movesPill = this.createPill(BOARD_PIXEL_SIZE.width - 20, 18, `Moves ${this.movesLeft}`, 0x6bc9ef, 'right');

    this.add
      .text(BOARD_PIXEL_SIZE.width / 2, 60, `Find: ${this.targetWord}`, {
        fontSize: '19px',
        fontStyle: 'bold',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    this.scoreText = this.add
      .text(BOARD_PIXEL_SIZE.width / 2, 92, 'Score: 0', {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#a79ccf',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5, 0);
  }

  // Small rounded-rect + centered text, used for the Level/Moves badges.
  // align 'left' anchors the pill's left edge at x; 'right' anchors its
  // right edge at x (so it hugs the board's right border like the Shuffle
  // button does).
  createPill(x, y, label, color, align = 'left') {
    const width = 92;
    const height = 30;
    const originX = align === 'right' ? 1 : 0;
    const rectX = align === 'right' ? x - width : x;

    const bg = this.add.graphics();
    bg.fillStyle(color, 0.18);
    bg.fillRoundedRect(rectX, y, width, height, 10);
    bg.lineStyle(1.5, color, 0.6);
    bg.strokeRoundedRect(rectX, y, width, height, 10);

    const text = this.add
      .text(rectX + width / 2, y + height / 2, label, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    return { bg, text, x: rectX, y, width, height, originX };
  }

  updateMovesText() {
    this.movesPill.text.setText(`Moves ${this.movesLeft}`);
  }


  // ---------- shuffle / solvability ----------

  createShuffleButton() {
    const bg = this.add
      .rectangle(BOARD_PIXEL_SIZE.width - 20, 54, 84, 26, 0xffffff, 0.12)
      .setOrigin(1, 0)
      .setStrokeStyle(1.5, 0xffffff, 0.4);

    const label = this.add
      .text(BOARD_PIXEL_SIZE.width - 20 - 42, 54 + 13, '⟳ Shuffle', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (this.isBusy || this.levelOver) return;
      this.shuffleBoard(false);
    });

    this.shuffleButtonBg = bg;
    this.shuffleButtonLabel = label;
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
      x: BOARD_SIDE_MARGIN + col * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
      y: BOARD_TOP_MARGIN + row * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
    };
  }

  cellFromPixel(x, y) {
    const col = Math.floor((x - BOARD_SIDE_MARGIN) / (TILE_SIZE + TILE_GAP));
    const row = Math.floor((y - BOARD_TOP_MARGIN) / (TILE_SIZE + TILE_GAP));
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
    return { row, col };
  }

  // ---------- board setup ----------

  createInitialBoard() {
    for (let row = 0; row < BOARD_SIZE; row++) {
      this.grid.push([]);
      for (let col = 0; col < BOARD_SIZE; col++) {
        const letter = this.pickNonMatchingLetter(row, col);
        this.grid[row][col] = this.createTile(row, col, letter);
      }
    }
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
    const spawnY = y - (row + 4) * (TILE_SIZE + TILE_GAP);
    const container = this.add.container(x, spawnAbove ? spawnY : y);

    const color = LETTER_COLORS[letter] ?? 0xffffff;
    const bg = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, color);
    bg.setStrokeStyle(3, 0x1b1030, 0.35);

    const text = this.add
      .text(0, 0, letter, {
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#1b1030',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    container.add([bg, text]);
    container.setSize(TILE_SIZE, TILE_SIZE);

    const tile = { row, col, letter, container, bg, text };
    return tile;
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
    if (this.isBusy || this.levelOver) return;
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
    if (this.isBusy || this.levelOver || this.swipeHandled || !this.pointerDownTile) return;

    const dx = pointer.x - this.pointerDownPos.x;
    const dy = pointer.y - this.pointerDownPos.y;
    const threshold = TILE_SIZE * 0.35;
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
    this.checkTargetWord(wordsFound);

    await this.clearTiles(matchedCells);
    await this.collapseAndRefill();
    await this.resolveAutoMatches(2);
    await this.ensureSolvable();
    this.checkLevelEnd();
    this.isBusy = false;
  }

  // ---------- level end conditions ----------

  spendMove() {
    this.movesLeft = Math.max(0, this.movesLeft - 1);
    this.updateMovesText();
  }

  // The target word can appear either as the direct result of the player's
  // swap, or fall into place a moment later during an auto-cascade - either
  // way it counts, so this is called from both attemptSwap and
  // resolveAutoMatches.
  checkTargetWord(wordsFound) {
    if (this.levelOver) return;
    if (wordsFound.includes(this.targetWord)) {
      this.onLevelWon();
    }
  }

  // Called once the swap + any chained cascades have fully settled. Only
  // reachable here if checkTargetWord() didn't already win the level above,
  // so a level can never simultaneously "win" and "run out of moves" - a
  // win found mid-cascade always takes priority.
  checkLevelEnd() {
    if (this.levelOver) return;
    if (this.movesLeft <= 0) {
      this.onLevelLost();
    }
  }

  onLevelWon() {
    this.levelOver = true;
    this.deselectTile();
    this.showEndBanner(`${this.targetWord} found!\nLevel Complete`, '#7CFC9A');
  }

  onLevelLost() {
    this.levelOver = true;
    this.deselectTile();
    this.showEndBanner(`Out of moves\nTry again`, '#ff4757');
  }

  // Placeholder end-of-level feedback for this batch - a proper Win/Lose
  // popup with Next Level / Retry buttons lands in the next batch. For now
  // this just clearly signals the level is over and blocks further input
  // (handlePointerDown checks this.levelOver).
  showEndBanner(message, color) {
    const overlay = this.add.rectangle(
      BOARD_PIXEL_SIZE.width / 2,
      BOARD_PIXEL_SIZE.height / 2,
      BOARD_PIXEL_SIZE.width,
      BOARD_PIXEL_SIZE.height,
      0x000000,
      0.55
    );

    const label = this.add
      .text(BOARD_PIXEL_SIZE.width / 2, BOARD_PIXEL_SIZE.height / 2, message, {
        fontSize: '26px',
        fontStyle: 'bold',
        color,
        fontFamily: 'system-ui, sans-serif',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.8);

    this.tweens.add({
      targets: [overlay, label],
      alpha: 1,
      duration: 250,
    });
    this.tweens.add({
      targets: label,
      scale: 1,
      duration: 250,
      ease: 'Back.easeOut',
    });
  }

  // Scans a full row/column of letters left-to-right (or top-to-bottom) and
  // greedily takes the longest dictionary word at each position, then jumps
  // past it - so overlapping substrings don't all score separately.
  scanLineForWords(letters) {
    const found = [];
    let i = 0;
    while (i < letters.length) {
      let matchedLen = 0;
      const maxLen = Math.min(MAX_WORD_LENGTH, letters.length - i);
      for (let len = maxLen; len >= MIN_WORD_LENGTH; len--) {
        const word = letters.slice(i, i + len).join('');
        if (WORD_SET.has(word)) {
          found.push({ start: i, length: len, word });
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
    this.checkTargetWord(wordsFound);

    await this.clearTiles(matchedCells);
    await this.collapseAndRefill();
    await this.resolveAutoMatches(chainLevel + 1);
  }

  showWordToast(word, color) {
    const label = this.add
      .text(BOARD_PIXEL_SIZE.width / 2, BOARD_TOP_MARGIN + 30, word, {
        fontSize: '22px',
        fontStyle: 'bold',
        color,
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: label,
      alpha: 1,
      y: label.y - 20,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: label,
          alpha: 0,
          y: label.y - 16,
          delay: 300,
          duration: 300,
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  showComboText(chainLevel, wordsFound, labelOverride) {
    const label = this.add
      .text(
        BOARD_PIXEL_SIZE.width / 2,
        BOARD_TOP_MARGIN + 40,
        labelOverride ? `${wordsFound.join(', ')} ${labelOverride}` : `Chain x${chainLevel}! ${wordsFound.join(', ')}`,
        {
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#ffd93d',
          fontFamily: 'system-ui, sans-serif',
          align: 'center',
          wordWrap: { width: BOARD_PIXEL_SIZE.width - 30 },
        }
      )
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.7);

    this.cameras.main.shake(120, 0.004);

    this.tweens.add({
      targets: label,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: label,
          alpha: 0,
          delay: 350,
          duration: 300,
          onComplete: () => label.destroy(),
        });
      },
    });
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

    await Promise.all(
      tiles.map((tile) =>
        this.tweenPromise({
          targets: tile.container,
          scale: 0,
          alpha: 0,
          duration: 180,
          ease: 'Back.easeIn',
        })
      )
    );

    tiles.forEach((tile) => tile.container.destroy());
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
    this.scoreText.setText(`Score: ${this.score}`);
  }
}
