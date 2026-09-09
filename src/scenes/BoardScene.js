import Phaser from 'phaser';
import {
  BOARD_SIZE,
  TILE_SIZE,
  TILE_GAP,
  BOARD_TOP_MARGIN,
  BOARD_SIDE_MARGIN,
  BOARD_PIXEL_SIZE,
  LETTER_COLORS,
  randomLetter,
} from '../config.js';
import { WORD_SET, PREFIX_SET } from '../data/wordlist.js';

// Word-Trace mechanic:
// - Drag through orthogonally-adjacent letters (up/down/left/right, no
//   diagonals) to trace a 3-5 letter word. The path can turn corners.
// - Release on a valid word -> those tiles clear, score, and the board
//   collapses/refills like match-3.
// - After every fall (both from the player's clear AND from cascades),
//   the board is auto-scanned for any straight-line 3-5 letter word that
//   landed by chance -> it auto-clears too, Candy-Crush style, and can
//   keep chaining until the board settles.

export class BoardScene extends Phaser.Scene {
  constructor() {
    super('BoardScene');
  }

  create() {
    this.isBusy = false;
    this.isDragging = false;
    this.score = 0;
    this.grid = [];
    this.path = [];
    this.pathKeys = new Set();

    this.add
      .text(BOARD_PIXEL_SIZE.width / 2, 26, 'Alphabet Adventure', {
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    this.add
      .text(BOARD_PIXEL_SIZE.width / 2, 52, 'Drag adjacent letters (no diagonals) to spell a 3-5 letter word', {
        fontSize: '13px',
        color: '#a79ccf',
        fontFamily: 'system-ui, sans-serif',
        align: 'center',
        wordWrap: { width: BOARD_PIXEL_SIZE.width - 40 },
      })
      .setOrigin(0.5);

    this.pathText = this.add
      .text(BOARD_PIXEL_SIZE.width / 2, 90, '', {
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: 4,
      })
      .setOrigin(0.5);

    this.scoreText = this.add
      .text(BOARD_PIXEL_SIZE.width / 2, 114, 'Score: 0', {
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffd93d',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5, 0);

    this.createShuffleButton();

    // Drawn once, redrawn on every path change to trace the drag as a line
    // through tile centers.
    this.pathGraphics = this.add.graphics();

    this.createInitialBoard();
    this.setupInput();
    this.ensureSolvable();
  }

  // ---------- shuffle / solvability ----------

  createShuffleButton() {
    const bg = this.add
      .rectangle(BOARD_PIXEL_SIZE.width - 20, 20, 84, 30, 0xffffff, 0.12)
      .setOrigin(1, 0)
      .setStrokeStyle(1.5, 0xffffff, 0.4);

    const label = this.add
      .text(BOARD_PIXEL_SIZE.width - 20 - 42, 20 + 15, '⟳ Shuffle', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (this.isBusy) return;
      this.shuffleBoard(false);
    });

    this.shuffleButtonBg = bg;
    this.shuffleButtonLabel = label;
  }

  // Silent safety net: called after the board first appears and after every
  // fall/cascade settles. If literally no valid word exists anywhere on the
  // board, the player has no legal move — so we reshuffle automatically,
  // without a toast, before they'd ever notice. This is what makes the
  // manual Shuffle button "optional" rather than load-bearing.
  async ensureSolvable() {
    if (!this.hasValidWord()) {
      await this.shuffleBoard(true);
    }
  }

  // DFS from every cell, reusing the same PREFIX_SET pruning as the live
  // drag-trace input, to check whether any 3-5 letter dictionary word can
  // currently be traced anywhere on the board.
  hasValidWord() {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const tile = this.grid[row][col];
        if (!tile) continue;
        if (this.dfsHasWord(row, col, tile.letter, new Set([`${row},${col}`]))) {
          return true;
        }
      }
    }
    return false;
  }

  dfsHasWord(row, col, word, visited) {
    if (word.length >= 3 && WORD_SET.has(word)) return true;
    if (word.length >= 5) return false;
    if (!PREFIX_SET.has(word)) return false;

    const deltas = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of deltas) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      const tile = this.grid[r][c];
      if (!tile) continue;

      visited.add(key);
      if (this.dfsHasWord(r, c, word + tile.letter, visited)) {
        visited.delete(key);
        return true;
      }
      visited.delete(key);
    }
    return false;
  }

  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // Reassigns existing tiles' letters (no new tiles, no re-layout) to a
  // shuffled arrangement that's guaranteed solvable, retrying a bounded
  // number of times before giving up and accepting whatever it landed on.
  async shuffleBoard(silent = false) {
    if (this.isDragging) this.cancelPath();
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
    } while (!this.hasValidWord() && attempts < 50);

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
    for (let len = 3; len <= 5; len++) {
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

  // ---------- input (drag-to-trace) ----------

  setupInput() {
    this.input.on('pointerdown', (pointer) => this.handlePointerDown(pointer));
    this.input.on('pointermove', (pointer) => this.handlePointerMove(pointer));
    this.input.on('pointerup', () => this.endPath());
    this.input.on('pointerupoutside', () => this.endPath());
  }

  handlePointerDown(pointer) {
    if (this.isBusy) return;
    const cell = this.cellFromPixel(pointer.x, pointer.y);
    if (!cell) return;
    const tile = this.grid[cell.row][cell.col];
    if (!tile) return;
    this.startPath(tile);
  }

  handlePointerMove(pointer) {
    if (!this.isDragging || this.isBusy) return;
    const cell = this.cellFromPixel(pointer.x, pointer.y);
    if (!cell) return;
    const tile = this.grid[cell.row][cell.col];
    if (!tile) return;
    this.extendPathTo(tile);
  }

  keyOf(tile) {
    return `${tile.row},${tile.col}`;
  }

  isOrthogonallyAdjacent(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  startPath(tile) {
    this.path = [tile];
    this.pathKeys = new Set([this.keyOf(tile)]);
    this.isDragging = true;
    this.setTileHighlight(tile, true);
    this.updatePathVisuals();
  }

  extendPathTo(tile) {
    const last = this.path[this.path.length - 1];
    if (tile === last) return;

    // Dragging back onto the previous tile undoes the last step.
    if (this.path.length >= 2 && tile === this.path[this.path.length - 2]) {
      const removed = this.path.pop();
      this.pathKeys.delete(this.keyOf(removed));
      this.setTileHighlight(removed, false);
      this.updatePathVisuals();
      return;
    }

    const key = this.keyOf(tile);
    if (this.pathKeys.has(key)) return; // no reusing a tile in the same word
    if (!this.isOrthogonallyAdjacent(last, tile)) return; // must be a legal orthogonal step

    const candidate = this.path.map((t) => t.letter).join('') + tile.letter;
    if (candidate.length > 5) return; // dictionary caps at 5 letters
    if (!PREFIX_SET.has(candidate)) return; // dead end — no word starts this way

    this.path.push(tile);
    this.pathKeys.add(key);
    this.setTileHighlight(tile, true);
    this.updatePathVisuals();
  }

  endPath() {
    if (!this.isDragging) return;
    this.isDragging = false;

    const word = this.path.map((t) => t.letter).join('');
    if (word.length >= 3 && WORD_SET.has(word)) {
      this.commitPath(word);
    } else {
      this.cancelPath();
    }
  }

  cancelPath() {
    const tiles = [...this.path];
    const failColor = 0xff4757;

    // Redraw the traced line in red (instead of leaving it white/vanishing
    // instantly) so the cancel is visible on the path itself, not just the
    // tiles.
    this.pathGraphics.clear();
    if (tiles.length > 1) {
      this.pathGraphics.lineStyle(6, failColor, 0.9);
      this.pathGraphics.beginPath();
      this.pathGraphics.moveTo(tiles[0].container.x, tiles[0].container.y);
      for (let i = 1; i < tiles.length; i++) {
        this.pathGraphics.lineTo(tiles[i].container.x, tiles[i].container.y);
      }
      this.pathGraphics.strokePath();
    }
    this.pathText.setColor('#ff4757');

    tiles.forEach((tile) => {
      this.tweens.add({
        targets: tile.bg,
        fillColor: failColor,
        duration: 90,
        yoyo: true,
        onComplete: () => this.setTileHighlight(tile, false),
      });
    });

    // Path/selection state clears right away so a new drag can start
    // immediately, but the red line + text hold on screen briefly before
    // fading so the cancel actually reads as feedback.
    this.path = [];
    this.pathKeys.clear();
    this.time.delayedCall(180, () => {
      this.pathGraphics.clear();
      this.pathText.setText('');
      this.pathText.setColor('#ffffff');
    });
  }

  resetPathState() {
    this.path = [];
    this.pathKeys.clear();
    this.pathGraphics.clear();
    this.pathText.setText('');
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

  updatePathVisuals() {
    this.pathGraphics.clear();
    const word = this.path.map((t) => t.letter).join('');
    const isReady = word.length >= 3 && WORD_SET.has(word);

    if (this.path.length > 1) {
      this.pathGraphics.lineStyle(6, isReady ? 0x7cfc9a : 0xffffff, 0.85);
      this.pathGraphics.beginPath();
      this.pathGraphics.moveTo(this.path[0].container.x, this.path[0].container.y);
      for (let i = 1; i < this.path.length; i++) {
        this.pathGraphics.lineTo(this.path[i].container.x, this.path[i].container.y);
      }
      this.pathGraphics.strokePath();
    }

    this.pathText.setText(word);
    this.pathText.setColor(isReady ? '#7CFC9A' : '#ffffff');
  }

  // ---------- commit / cascade loop ----------

  async commitPath(word) {
    this.isBusy = true;
    const wordTiles = [...this.path];
    wordTiles.forEach((tile) => this.setTileHighlight(tile, false));
    this.resetPathState();

    this.score += word.length * 20;
    this.updateScoreText();
    this.showWordToast(word, '#7CFC9A');

    const matchedKeys = new Set(wordTiles.map((t) => `${t.row},${t.col}`));
    await this.clearTiles(matchedKeys);
    await this.collapseAndRefill();
    await this.resolveAutoMatches(1);
    await this.ensureSolvable();
    this.isBusy = false;
  }

  // Scans a full row/column of letters left-to-right (or top-to-bottom) and
  // greedily takes the longest dictionary word at each position, then jumps
  // past it — so overlapping substrings don't all score separately.
  scanLineForWords(letters) {
    const found = [];
    let i = 0;
    while (i < letters.length) {
      let matchedLen = 0;
      const maxLen = Math.min(5, letters.length - i);
      for (let len = maxLen; len >= 3; len--) {
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

    if (chainLevel > 1) {
      this.showComboText(chainLevel, wordsFound);
    } else {
      wordsFound.forEach((w, i) => {
        this.time.delayedCall(i * 120, () => this.showWordToast(w, '#ffd93d'));
      });
    }

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

  showComboText(chainLevel, wordsFound) {
    const label = this.add
      .text(BOARD_PIXEL_SIZE.width / 2, BOARD_TOP_MARGIN + 40, `Chain x${chainLevel}! ${wordsFound.join(', ')}`, {
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffd93d',
        fontFamily: 'system-ui, sans-serif',
        align: 'center',
        wordWrap: { width: BOARD_PIXEL_SIZE.width - 30 },
      })
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
