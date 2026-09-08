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

// Phase 1 milestone (per PLAN.md):
// 7x7 board -> letter tiles -> swap -> match 3 -> clear -> tiles fall ->
// basic scoring. No target words, no special tiles, no obstacles yet —
// those come in Phase 2/3 once this core loop is confirmed to be fun.
export class BoardScene extends Phaser.Scene {
  constructor() {
    super('BoardScene');
  }

  create() {
    this.isBusy = false;
    this.selected = null;
    this.score = 0;
    this.grid = [];

    this.add
      .text(BOARD_PIXEL_SIZE.width / 2, 30, 'Alphabet Adventure', {
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    this.add
      .text(BOARD_PIXEL_SIZE.width / 2, 58, 'Phase 1 prototype — swap tiles to match 3+', {
        fontSize: '14px',
        color: '#a79ccf',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5);

    this.scoreText = this.add
      .text(BOARD_PIXEL_SIZE.width / 2, 80, 'Score: 0', {
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffd93d',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5, 0);

    this.createInitialBoard();
  }

  // ---------- geometry ----------

  cellToPixel(row, col) {
    return {
      x: BOARD_SIDE_MARGIN + col * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
      y: BOARD_TOP_MARGIN + row * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
    };
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

  // Avoids spawning an already-matched run so the board isn't pre-solved
  // the moment it appears. Falls back after a few tries in case a very
  // unlucky pool ever fights itself into a corner.
  pickNonMatchingLetter(row, col) {
    let letter = randomLetter();
    let attempts = 0;
    while (this.wouldMatchAt(row, col, letter) && attempts < 20) {
      letter = randomLetter();
      attempts += 1;
    }
    return letter;
  }

  wouldMatchAt(row, col, letter) {
    if (col >= 2) {
      const l1 = this.grid[row][col - 1]?.letter;
      const l2 = this.grid[row][col - 2]?.letter;
      if (l1 === letter && l2 === letter) return true;
    }
    if (row >= 2) {
      const l1 = this.grid[row - 1][col]?.letter;
      const l2 = this.grid[row - 2][col]?.letter;
      if (l1 === letter && l2 === letter) return true;
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
    container.setInteractive(
      new Phaser.Geom.Rectangle(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE),
      Phaser.Geom.Rectangle.Contains
    );

    const tile = { row, col, letter, container, bg, text };
    container.on('pointerdown', () => this.onTileClick(tile.row, tile.col));
    return tile;
  }

  // ---------- input ----------

  onTileClick(row, col) {
    if (this.isBusy) return;
    const tile = this.grid[row][col];
    if (!tile) return;

    if (!this.selected) {
      this.selected = tile;
      this.setHighlight(tile, true);
      return;
    }

    if (this.selected === tile) {
      this.setHighlight(tile, false);
      this.selected = null;
      return;
    }

    if (this.areAdjacent(this.selected, tile)) {
      const previouslySelected = this.selected;
      this.setHighlight(previouslySelected, false);
      this.selected = null;
      this.trySwap(previouslySelected, tile);
    } else {
      this.setHighlight(this.selected, false);
      this.selected = tile;
      this.setHighlight(tile, true);
    }
  }

  areAdjacent(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  setHighlight(tile, on) {
    tile.bg.setStrokeStyle(on ? 5 : 3, on ? 0xffffff : 0x1b1030, on ? 1 : 0.35);
    this.tweens.add({
      targets: tile.container,
      scale: on ? 1.08 : 1,
      duration: 120,
      ease: 'Sine.easeOut',
    });
  }

  // ---------- swap / match / resolve loop ----------

  async trySwap(tileA, tileB) {
    this.isBusy = true;
    this.swapGridPositions(tileA, tileB);
    await this.animateSwap(tileA, tileB);

    const matches = this.findMatches();
    if (matches.size === 0) {
      // Not a legal move — swap back.
      this.swapGridPositions(tileA, tileB);
      await this.animateSwap(tileA, tileB);
      this.isBusy = false;
      return;
    }

    await this.resolveMatches(1);
    this.isBusy = false;
  }

  swapGridPositions(tileA, tileB) {
    const { row: rowA, col: colA } = tileA;
    const { row: rowB, col: colB } = tileB;
    this.grid[rowA][colA] = tileB;
    this.grid[rowB][colB] = tileA;
    tileA.row = rowB;
    tileA.col = colB;
    tileB.row = rowA;
    tileB.col = colA;
  }

  animateSwap(tileA, tileB) {
    const posA = this.cellToPixel(tileA.row, tileA.col);
    const posB = this.cellToPixel(tileB.row, tileB.col);
    return Promise.all([
      this.tweenPromise({ targets: tileA.container, x: posA.x, y: posA.y, duration: 160, ease: 'Sine.easeInOut' }),
      this.tweenPromise({ targets: tileB.container, x: posB.x, y: posB.y, duration: 160, ease: 'Sine.easeInOut' }),
    ]);
  }

  findMatches() {
    const matched = new Set();

    // Horizontal runs.
    for (let row = 0; row < BOARD_SIZE; row++) {
      let runStart = 0;
      for (let col = 1; col <= BOARD_SIZE; col++) {
        const prevLetter = this.grid[row][col - 1]?.letter;
        const curLetter = col < BOARD_SIZE ? this.grid[row][col]?.letter : null;
        if (curLetter !== prevLetter) {
          if (col - runStart >= 3) {
            for (let c = runStart; c < col; c++) matched.add(`${row},${c}`);
          }
          runStart = col;
        }
      }
    }

    // Vertical runs.
    for (let col = 0; col < BOARD_SIZE; col++) {
      let runStart = 0;
      for (let row = 1; row <= BOARD_SIZE; row++) {
        const prevLetter = this.grid[row - 1][col]?.letter;
        const curLetter = row < BOARD_SIZE ? this.grid[row][col]?.letter : null;
        if (curLetter !== prevLetter) {
          if (row - runStart >= 3) {
            for (let r = runStart; r < row; r++) matched.add(`${r},${col}`);
          }
          runStart = row;
        }
      }
    }

    return matched;
  }

  async resolveMatches(chainLevel) {
    const matched = this.findMatches();
    if (matched.size === 0) return;

    const points = matched.size * 10 * chainLevel;
    this.score += points;
    this.updateScoreText();

    await this.clearTiles(matched);
    await this.collapseAndRefill();
    await this.resolveMatches(chainLevel + 1);
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

      // Existing tiles keep their relative order and settle at the bottom.
      for (let i = 0; i < existing.length; i++) {
        newColumn[emptyCount + i] = existing[i];
      }
      // Fresh tiles spawn above the board to fill the remaining gaps.
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
