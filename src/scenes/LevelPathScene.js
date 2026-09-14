import Phaser from 'phaser';
import { APP_BG_COLOR, APP_BG_COLOR_RGB } from '../config.js';
import { getWorld } from '../data/worlds.js';
import { getPathNodes } from '../data/levelPaths.js';
import { levelIdFor, isLevelUnlocked, isLevelComplete, LEVELS_PER_WORLD } from '../utils/progressStore.js';

// Per-world node path (PLAN.md §8.5), shown as invisible tap targets
// laid over that world's full-bleed background art - node 1 (Start)
// at the bottom, node 20 (boss) at the top, path reads bottom-to-top.
//
// Per chat: this used to be a shorter background scaled to the
// canvas WIDTH only (letterboxing a flat-color gap below it on taller
// phones - see the old screenshot that flagged this) with the path
// line/circles/lock icons/numbers all code-drawn on top. Candy
// Garden's art is now one full illustration with the path, medal
// badges, numbers and stars already painted in, so this scene now
// follows MainMenuScene's approach instead: "cover" scale (fills the
// canvas completely, cropping minimal left/right overflow rather than
// leaving a gap) with real interactive hit circles positioned over
// each baked-in medal via the same poster-space -> screen-space
// mapping MainMenuScene uses for its Play button. No more code-drawn
// path line, node circles, or numbers for this world - only a thin
// lock/complete overlay per node (see drawNodeOverlay) since the art
// itself doesn't encode unlock/completion state.
//
// Other worlds haven't gotten this art treatment yet, so they still
// render via the old code-drawn path (see drawCodePath/drawCodeNode
// below) until each one's background gets replaced the same way (per
// chat: one world at a time, pushed after each).
//
// Tapping an unlocked node goes straight to BoardScene. Tapping a
// locked node just gives a small shake - no action.
export class LevelPathScene extends Phaser.Scene {
  constructor() {
    super('LevelPathScene');
  }

  init(sceneData) {
    this.worldId = sceneData?.worldId ?? 1;
    this.world = getWorld(this.worldId);
    // Only Candy Garden has the new baked-in-nodes art so far.
    this.usesBakedArt = this.worldId === 1;
  }

  preload() {
    this.load.image(this.world.bgKey, this.world.bgPath);
  }

  create() {
    if (this.usesBakedArt) {
      this.createBakedArtPath();
    } else {
      this.createCodeDrawnPath();
    }
    this.createHud();
  }

  // --- New approach: full-bleed baked-in-nodes art (Candy Garden) --------

  createBakedArtPath() {
    const { width, height } = this.scale;
    const space = this.world.pathSpace;

    this.add.rectangle(0, 0, width, height, APP_BG_COLOR).setOrigin(0);

    // Same "cover" math as MainMenuScene.js: fills the canvas edge to
    // edge, cropping only the minimal side overflow.
    const scale = Math.max(width / space.width, height / space.height);
    const artW = space.width * scale;
    const artH = space.height * scale;
    const artX = (width - artW) / 2;
    const artY = (height - artH) / 2;

    const bg = this.add.image(width / 2, height / 2, this.world.bgKey);
    bg.setDisplaySize(artW, artH);

    // Map each baked node's poster-space coords into screen space
    // using that same box, exactly like MainMenuScene maps its Play
    // banner box.
    const nodes = getPathNodes(this.worldId);
    nodes.forEach((n, i) => {
      const levelNum = i + 1;
      const x = artX + n.x * scale;
      const y = artY + n.y * scale;
      this.placeBakedNode(x, y, levelNum, scale);
    });
  }

  placeBakedNode(x, y, levelNum, scale) {
    const isBoss = levelNum === LEVELS_PER_WORLD;
    const unlocked = isLevelUnlocked(this.worldId, levelNum);
    const complete = isLevelComplete(levelIdFor(this.worldId, levelNum));
    // Radius in poster-space, scaled down to screen space - sized to
    // cover the baked medal + its star row as one tap target.
    const radius = (isBoss ? 92 : 76) * scale;

    if (!unlocked) {
      // Art doesn't encode lock state, so dim + lock-badge the node
      // in code. Not interactive - tapping a locked node just shakes.
      const dim = this.add.circle(x, y, radius, 0x1a1230, 0.55);
      this.drawLockIcon(x, y, radius);
      dim.setInteractive({ useHandCursor: false });
      dim.on('pointerup', () => this.shakeLockedNode(dim));
      return;
    }

    // Fully invisible tap target over the baked-in medal art.
    const hitArea = this.add.circle(x, y, radius, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hitArea.on('pointerup', () => this.selectLevel(levelNum));

    if (complete) {
      // Small code-drawn star badge in the corner so completed levels
      // still read as completed even though the art itself is static.
      const badgeX = x + radius * 0.6;
      const badgeY = y - radius * 0.6;
      const badge = this.add.circle(badgeX, badgeY, Math.max(9, radius * 0.24), 0xffc93c, 1);
      badge.setStrokeStyle(2, 0xffffff, 0.9);
      this.add
        .text(badgeX, badgeY, '\u2605', { fontFamily: 'Arial', fontSize: `${Math.max(10, radius * 0.26)}px`, color: '#ffffff' })
        .setOrigin(0.5);
    }
  }

  drawLockIcon(x, y, radius) {
    const s = radius * 0.5;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(x - s * 0.55, y - s * 0.1, s * 1.1, s * 0.85, s * 0.18);
    g.lineStyle(s * 0.18, 0xffffff, 0.95);
    g.beginPath();
    g.arc(x, y - s * 0.15, s * 0.42, Math.PI, 0, false);
    g.strokePath();
  }

  shakeLockedNode(target) {
    const originX = target.x;
    this.tweens.add({
      targets: target,
      x: originX + 6,
      duration: 45,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        target.x = originX;
      },
    });
  }

  // --- Old approach: code-drawn path (worlds without new art yet) --------

  createCodeDrawnPath() {
    const { width, height } = this.scale;
    const space = this.world.pathSpace;

    const bg = this.add.image(0, 0, this.world.bgKey).setOrigin(0);
    this.bgScale = width / (bg.width || space.width);
    bg.setScale(this.bgScale);
    this.bgDisplayHeight = bg.displayHeight;

    // Camera can scroll vertically over the full background height;
    // start scrolled to the bottom, where Level 1 / Start sits.
    this.cameras.main.setBounds(0, 0, width, this.bgDisplayHeight);
    this.cameras.main.scrollY = Math.max(0, this.bgDisplayHeight - height);

    this.setupDragScroll(height);
    this.drawCodePath();
    this.drawCodeNodes();
  }

  // --- Drag-to-scroll (code-drawn worlds only) ----------------------------

  setupDragScroll(viewportHeight) {
    this.dragActive = false;
    this.dragStartY = 0;
    this.dragStartScroll = 0;
    this.dragDistance = 0;

    this.input.on('pointerdown', (pointer) => {
      this.dragActive = true;
      this.dragStartY = pointer.y;
      this.dragStartScroll = this.cameras.main.scrollY;
      this.dragDistance = 0;
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.dragActive || !pointer.isDown) return;
      const delta = pointer.y - this.dragStartY;
      this.dragDistance = Math.max(this.dragDistance, Math.abs(delta));
      const maxScroll = Math.max(0, this.bgDisplayHeight - viewportHeight);
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.dragStartScroll - delta, 0, maxScroll);
    });

    this.input.on('pointerup', () => {
      this.dragActive = false;
    });

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const maxScroll = Math.max(0, this.bgDisplayHeight - viewportHeight);
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY + deltaY, 0, maxScroll);
    });
  }

  // A node/back-button tap should be ignored if the pointer actually
  // dragged past a small threshold - otherwise every pan gesture would
  // also fire whatever node it started on.
  wasDrag() {
    return this.dragDistance > 12;
  }

  drawCodePath() {
    const nodes = getPathNodes(this.worldId);
    const line = this.add.graphics();
    line.lineStyle(6, 0xffffff, 0.35);
    line.beginPath();
    nodes.forEach((n, i) => {
      const x = n.x * this.bgScale;
      const y = n.y * this.bgScale;
      if (i === 0) line.moveTo(x, y);
      else line.lineTo(x, y);
    });
    line.strokePath();
  }

  drawCodeNodes() {
    const nodes = getPathNodes(this.worldId);
    nodes.forEach((n, i) => {
      const levelNum = i + 1;
      const x = n.x * this.bgScale;
      const y = n.y * this.bgScale;
      const isBoss = levelNum === LEVELS_PER_WORLD;
      const unlocked = isLevelUnlocked(this.worldId, levelNum);
      const complete = isLevelComplete(levelIdFor(this.worldId, levelNum));

      if (levelNum === 1) this.drawStartSignpost(x, y);
      this.drawCodeNode(x, y, levelNum, { isBoss, unlocked, complete });
    });
  }

  drawStartSignpost(x, y) {
    const post = this.add.graphics();
    post.fillStyle(0x8b5a2b, 1);
    post.fillRect(x - 4, y - 62, 8, 34);
    post.fillStyle(0xffffff, 1);
    post.fillRoundedRect(x - 34, y - 82, 68, 26, 4);
    const label = this.add.text(x, y - 69, 'START', {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#5a3921',
    });
    label.setOrigin(0.5);
  }

  drawCodeNode(x, y, levelNum, { isBoss, unlocked, complete }) {
    const radius = isBoss ? 34 : 26;

    let fillColor = 0x8f8f9c; // locked
    if (complete) fillColor = 0xffc93c;
    else if (unlocked) fillColor = 0xff6fa5;

    const circle = this.add.graphics();
    if (isBoss) {
      circle.lineStyle(5, 0xffd700, 1);
      circle.strokeCircle(x, y, radius + 6);
    }
    circle.fillStyle(fillColor, 1);
    circle.fillCircle(x, y, radius);
    circle.lineStyle(3, 0xffffff, 0.9);
    circle.strokeCircle(x, y, radius);

    if (!unlocked) {
      this.drawLockIcon(x, y, radius * 1.4);
    } else if (complete) {
      this.add.text(x, y, '\u2605', { fontFamily: 'Arial', fontSize: `${radius}px`, color: '#ffffff' }).setOrigin(0.5);
    } else {
      this.add
        .text(x, y, String(levelNum), {
          fontFamily: 'Arial',
          fontSize: isBoss ? '24px' : '20px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5);
    }

    if (unlocked) {
      const hitArea = this.add.circle(x, y, radius + 8, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hitArea.on('pointerup', () => {
        if (this.wasDrag()) return;
        this.selectLevel(levelNum);
      });
    }
  }

  // --- Shared HUD -----------------------------------------------------------

  createHud() {
    const { width } = this.scale;
    const bar = this.add.rectangle(0, 0, width, 56, APP_BG_COLOR, 0.85).setOrigin(0);
    bar.setScrollFactor(0);

    const title = this.add.text(width / 2, 28, this.world.name, {
      fontFamily: 'Arial',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    title.setOrigin(0.5);
    title.setScrollFactor(0);

    const backButton = this.add
      .text(16, 28, '\u2190 Back', {
        fontFamily: 'Arial',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffd93d',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerup', () => {
      if (this.wasDrag && this.wasDrag()) return;
      this.goBack();
    });
  }

  // --- Navigation ---------------------------------------------------------

  selectLevel(levelNum) {
    const levelId = levelIdFor(this.worldId, levelNum);
    this.cameras.main.fadeOut(220, ...APP_BG_COLOR_RGB);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('BoardScene', { levelId, worldId: this.worldId, levelNum });
    });
  }

  goBack() {
    this.cameras.main.fadeOut(220, ...APP_BG_COLOR_RGB);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('WorldSelectScene');
    });
  }
}
