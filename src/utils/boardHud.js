import Phaser from 'phaser';
import { addWoodPanel, preloadWoodPanel } from './woodPanel.js';
import { getGems } from './currencyStore.js';
import { getAvatarUrl, isSignedIn } from './authStore.js';
import { getBoosters } from './boosterStore.js';

// Board screen HUD, restyled after the reference mockup (per chat) but
// built from the wood art set so it looks right in every world. Layout
// from top to bottom:
//   1. wood top bar: profile avatar + level star, gem count, gear (pause)
//   2. goal banner: 3 stars, goal text, progress bar, "Moves" tag
//   3. (the board frame, centered in the space left over)
//   4. wood bottom bar: big Bomb + Lens + Shuffle buttons with count badges
// Deliberately NOT included (per chat): hearts/lives, paw coin, and the
// mockup's right-hand Shuffle/Bomb pills (the bottom bar replaces them).
//
// Everything is sized in canvas px for the fixed 516px-wide canvas and
// multiplied by a single scale `s` (see computeHudLayout) so it can
// shrink a little on short screens instead of overlapping the board.

const SAFE_TOP = 28; // room for the Android status bar / notch (canvas px)
const SAFE_BOTTOM = 20; // room for the gesture / nav bar
const HUD_DEPTH = 10; // above the frame + tiles, below popups (1000)

// Native size of word-map-banner.png and where its wood plank sits
// (measured off the pixels): plank spans y 50..170, the flat wood
// interior spans x 100..600 and y 65..155.
const BANNER = { w: 700, plankTop: 50, plankBottom: 170, textY: 88, barY: 131, interiorW: 500 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function preloadBoardHud(scene) {
  preloadWoodPanel(scene);
  const images = [
    ['hudBanner', 'assets/word-map-banner.png'],
    ['hudGem', 'assets/icon-gem.png'],
    ['hudGear', 'assets/icon-settings.png'],
    ['hudBoosterBomb', 'assets/booster-bomb.png'],
    ['hudBoosterLens', 'assets/booster-lens.png'],
    ['hudBoosterShuffle', 'assets/booster-shuffle.png'],
  ];
  images.forEach(([key, path]) => {
    if (!scene.textures.exists(key)) scene.load.image(key, path);
  });

  // Real profile photo when signed in - same source the Home Hub uses.
  // Guests get a drawn default avatar instead (see createAvatar).
  const avatarUrl = getAvatarUrl();
  if (avatarUrl && !scene.textures.exists('userAvatarBoard')) {
    scene.load.image('userAvatarBoard', avatarUrl);
  }
}

// All positions in one place. `boardSize` is the square frame the board
// needs; if the screen is too short for the nominal HUD plus that frame,
// the HUD shrinks (down to 70%) rather than overlapping it.
export function computeHudLayout(width, height, boardSize) {
  const nominalVariable = 248 - SAFE_TOP + (134 - SAFE_BOTTOM);
  const free = height - boardSize - 12 - SAFE_TOP - SAFE_BOTTOM;
  // Tall phones have room to spare, so the HUD may grow a little (up to
  // 115%); short screens shrink it (down to 70%) instead.
  const s = clamp(free / nominalVariable, 0.7, 1.15);

  const barH = 88 * s;
  const barCY = SAFE_TOP + 50 * s;

  const bannerW = Math.min(440 * s, width - 60);
  const bannerScale = bannerW / BANNER.w;
  const starsY = barCY + 64 * s;
  // Stars sit 8s above the plank's top edge so they don't cover the goal text.
  const bannerTop = starsY + 8 * s - BANNER.plankTop * bannerScale;
  const plankBottomY = bannerTop + BANNER.plankBottom * bannerScale;
  const movesY = plankBottomY + 7 * s;
  const topEnd = movesY + 16 * s + 8 * s;

  const bottomBarH = 112 * s;
  const bottomBarCY = height - SAFE_BOTTOM - 8 * s - 56 * s;
  const buttonD = 76 * s;
  const buttonY = bottomBarCY + 2 * s;
  const boardBottom = buttonY - buttonD / 2 - 10 * s;

  return {
    s,
    width,
    height,
    barH,
    barCY,
    bannerW,
    bannerScale,
    bannerTop,
    starsY,
    movesY,
    topEnd,
    bottomBarH,
    bottomBarCY,
    buttonD,
    buttonY,
    boardBottom,
  };
}

function textStyle(size, color, stroke, strokeThickness) {
  return {
    fontFamily: 'Arial Black, Arial, sans-serif',
    fontSize: `${Math.round(size)}px`,
    color,
    stroke,
    strokeThickness,
    align: 'center',
  };
}

// Round gold-ringed avatar. Signed in -> real photo (circle-masked);
// guest -> drawn default silhouette. Same idea as the Home Hub badge,
// but drawn in code so it stays sharp at this larger size.
function createAvatar(scene, x, y, d) {
  const r = d / 2;
  const innerR = r * 0.78;

  const ring = scene.add.graphics().setDepth(HUD_DEPTH);
  ring.fillStyle(0x5a2f0b, 1).fillCircle(x, y, r);
  ring.fillStyle(0xf2a71b, 1).fillCircle(x, y, r - 2);
  ring.fillStyle(0xffd45a, 1).fillCircle(x, y, r - 5);
  ring.fillStyle(0x4a2c14, 1).fillCircle(x, y, innerR + 1);
  ring.lineStyle(2, 0xfff2b0, 0.9);
  ring.beginPath();
  ring.arc(x, y, r - 3.5, Math.PI * 1.05, Math.PI * 1.55);
  ring.strokePath();

  const maskShape = scene.make.graphics({ x: 0, y: 0 }, false);
  maskShape.fillStyle(0xffffff, 1).fillCircle(x, y, innerR);
  const mask = maskShape.createGeometryMask();

  if (isSignedIn() && scene.textures.exists('userAvatarBoard')) {
    const photo = scene.add.image(x, y, 'userAvatarBoard').setDepth(HUD_DEPTH + 1);
    photo.setDisplaySize(innerR * 2, innerR * 2);
    photo.setMask(mask);
    return;
  }

  // Simple friendly cartoon face (per chat) - was a flat generic
  // "person" silhouette icon that didn't match Home Hub's illustrated
  // default avatar at all. Round head + simple hair cap + dot eyes +
  // a curved smile, in the same skin/hair palette, gets this closer
  // to that same warm look without needing a cut-out art asset (Home
  // Hub's face is baked directly into its big top-bar image, not
  // available as a standalone sprite this scene could just reuse).
  const person = scene.add.graphics().setDepth(HUD_DEPTH + 1);
  const faceR = r * 0.62;
  person.fillStyle(0xf1c27d, 1).fillCircle(x, y + r * 0.02, faceR);
  person.fillStyle(0x4a2c14, 1);
  person.beginPath();
  person.arc(x, y - r * 0.05, faceR * 1.02, Math.PI * 1.02, Math.PI * 1.98, false);
  person.closePath();
  person.fillPath();
  person.fillStyle(0x3a2410, 1);
  person.fillCircle(x - faceR * 0.32, y - r * 0.02, faceR * 0.09);
  person.fillCircle(x + faceR * 0.32, y - r * 0.02, faceR * 0.09);
  person.lineStyle(faceR * 0.11, 0x8a4a1e, 1);
  person.beginPath();
  person.arc(x, y + faceR * 0.05, faceR * 0.42, Math.PI * 0.15, Math.PI * 0.85, false);
  person.strokePath();
  person.setMask(mask);
}

export function createBoardHud(scene, layout, opts) {
  const { s, width } = layout;
  const cx = width / 2;
  const { level, isFree, scoreTarget, goalLabel, moves, onPause, onBomb, onLens, onShuffle } = opts;

  // ---------- 1. top bar ----------
  const barX0 = 8;
  const barW = width - 16;
  addWoodPanel(scene, barX0, layout.barCY, barW, layout.barH).objects.forEach((o) => o.setDepth(HUD_DEPTH - 1));

  const avatarD = 80 * s;
  const avatarX = barX0 + 40 * s;
  createAvatar(scene, avatarX, layout.barCY, avatarD);

  // Level number on a gold star at the avatar's lower-left corner.
  const starR = 22 * s;
  const starX = avatarX - 26 * s;
  const starY = layout.barCY + 30 * s;
  scene.add
    .star(starX, starY, 5, starR * 0.52, starR, 0xffc933)
    .setStrokeStyle(3, 0x7a4a12)
    .setDepth(HUD_DEPTH + 2);
  scene.add
    .text(starX, starY + 1, String(level.id), textStyle(level.id >= 100 ? 12 * s : 15 * s, '#5a2f0b', '#ffe9a8', 0))
    .setOrigin(0.5)
    .setDepth(HUD_DEPTH + 3);

  // Gem + count (gold "metal" text, like the Home Hub numbers).
  const gemX = width * 0.4;
  const gemW = 50 * s;
  scene.add
    .image(gemX, layout.barCY + 1, 'hudGem')
    .setDisplaySize(gemW, gemW * (174 / 200))
    .setDepth(HUD_DEPTH);
  scene.add
    .text(gemX + 34 * s, layout.barCY + 1, String(getGems()), {
      ...textStyle(30 * s, '#ffdf70', '#5a2f0b', 5 * s),
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 3, fill: true },
    })
    .setOrigin(0, 0.5)
    .setDepth(HUD_DEPTH);

  // Gear = pause.
  const gearD = 58 * s;
  const gear = scene.add
    .image(width - barX0 - 44 * s, layout.barCY, 'hudGear')
    .setDisplaySize(gearD, gearD * (190 / 200))
    .setDepth(HUD_DEPTH);
  const gearBase = gear.scale;
  gear.setInteractive({ useHandCursor: true });
  gear.on('pointerdown', () => scene.tweens.add({ targets: gear, scale: gearBase * 0.9, duration: 70 }));
  gear.on('pointerout', () => scene.tweens.add({ targets: gear, scale: gearBase, duration: 100 }));
  gear.on('pointerup', () => {
    scene.tweens.add({ targets: gear, scale: gearBase, duration: 100 });
    onPause();
  });

  // ---------- 2. goal banner ----------
  const sc = layout.bannerScale;
  scene.add.image(cx, layout.bannerTop, 'hudBanner').setOrigin(0.5, 0).setScale(sc).setDepth(HUD_DEPTH);

  const goalText = scene.add
    .text(cx, layout.bannerTop + BANNER.textY * sc, goalLabel, textStyle((isFree ? 22 : 24) * s, '#fff3d6', '#4a2a0c', 4 * s))
    .setOrigin(0.5)
    .setDepth(HUD_DEPTH + 1);
  const maxTextW = BANNER.interiorW * sc - 10 * s;
  if (goalText.width > maxTextW) goalText.setScale(maxTextW / goalText.width);

  // 3 stars sitting on the banner's top edge. Each lights up as another
  // third of the score goal is reached (only on score-goal levels).
  const stars = [];
  if (isFree) {
    const spec = [
      { dx: -46, dy: 4, r: 16, rot: -0.22 },
      { dx: 0, dy: -6, r: 21, rot: 0 },
      { dx: 46, dy: 4, r: 16, rot: 0.22 },
    ];
    spec.forEach(({ dx, dy, r, rot }) => {
      const star = scene.add
        .star(cx + dx * s, layout.starsY + dy * s, 5, r * s * 0.5, r * s, 0x5a4230)
        .setStrokeStyle(3, 0x2a1a0c)
        .setRotation(rot)
        .setDepth(HUD_DEPTH + 2);
      star.lit = false;
      stars.push(star);
    });
  }

  // Progress bar (score-goal levels) or plain score line (word levels).
  const barW2 = BANNER.interiorW * sc * 0.86;
  const barH2 = 16 * s;
  const barCX = cx;
  const barCYb = layout.bannerTop + BANNER.barY * sc;
  const barGfx = scene.add.graphics().setDepth(HUD_DEPTH + 1);
  const barLabel = scene.add
    .text(cx, barCYb, '', textStyle(12 * s, '#ffffff', '#2b1808', 3))
    .setOrigin(0.5)
    .setDepth(HUD_DEPTH + 2);
  const progress = { value: 0 };

  const drawBar = () => {
    barGfx.clear();
    const x = barCX - barW2 / 2;
    const y = barCYb - barH2 / 2;
    barGfx.fillStyle(0x2b1808, 0.85).fillRoundedRect(x, y, barW2, barH2, barH2 / 2);
    barGfx.lineStyle(2, 0xffe2a0, 0.7).strokeRoundedRect(x, y, barW2, barH2, barH2 / 2);
    if (progress.value > 0) {
      const w = Math.max(barH2, barW2 * progress.value);
      barGfx.fillStyle(0xffc933, 1).fillRoundedRect(x, y, w, barH2, barH2 / 2);
      barGfx.fillStyle(0xfff0a0, 0.55).fillRoundedRect(x + 3, y + 2, Math.max(2, w - 6), barH2 * 0.34, barH2 * 0.17);
    }
  };

  let scoreLine = null;
  if (isFree) {
    drawBar();
  } else {
    scoreLine = scene.add
      .text(cx, barCYb, 'Score: 0', textStyle(16 * s, '#fff3d6', '#4a2a0c', 3))
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 1);
  }

  // Moves tag hanging off the banner's lower edge.
  const pillW = 124 * s;
  const pillH = 32 * s;
  const pill = scene.add.graphics().setDepth(HUD_DEPTH + 1);
  pill.fillStyle(0x5b3413, 1).fillRoundedRect(cx - pillW / 2, layout.movesY - pillH / 2, pillW, pillH, pillH / 2);
  pill.lineStyle(2, 0xffd27a, 1).strokeRoundedRect(cx - pillW / 2, layout.movesY - pillH / 2, pillW, pillH, pillH / 2);
  const movesText = scene.add
    .text(cx, layout.movesY, `Moves ${moves}`, textStyle(17 * s, '#fff3d6', '#2b1808', 3))
    .setOrigin(0.5)
    .setDepth(HUD_DEPTH + 2);

  // ---------- 4. bottom booster bar ----------
  const bottomW = 330 * s;
  addWoodPanel(scene, cx - bottomW / 2, layout.bottomBarCY, bottomW, layout.bottomBarH).objects.forEach((o) =>
    o.setDepth(HUD_DEPTH - 1)
  );

  const buttons = {};
  const makeBooster = (type, key, x, action) => {
    const d = layout.buttonD;
    const img = scene.add.image(x, layout.buttonY, key).setDisplaySize(d, d).setDepth(HUD_DEPTH);
    const base = img.scale;
    // Round hit area (the art's corners are transparent).
    img.setInteractive(new Phaser.Geom.Circle(img.width / 2, img.height / 2, img.width / 2), Phaser.Geom.Circle.Contains);
    if (img.input) img.input.cursor = 'pointer';
    img.on('pointerdown', () => scene.tweens.add({ targets: img, scale: base * 0.92, duration: 70 }));
    img.on('pointerout', () => scene.tweens.add({ targets: img, scale: base, duration: 100 }));
    img.on('pointerup', () => {
      scene.tweens.add({ targets: img, scale: base, duration: 100 });
      action();
    });

    const badgeR = 13 * s;
    const bx = x + d * 0.36;
    const by = layout.buttonY + d * 0.36;
    const badge = scene.add.graphics().setDepth(HUD_DEPTH + 1);
    const badgeText = scene.add
      .text(bx, by, '', textStyle(15 * s, '#ffffff', '#5a0b14', 0))
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 2);

    buttons[type] = { img, base, badge, badgeText, bx, by, badgeR, x };
  };
  makeBooster('bomb', 'hudBoosterBomb', cx - 90 * s, onBomb);
  makeBooster('lens', 'hudBoosterLens', cx, onLens);
  makeBooster('shuffle', 'hudBoosterShuffle', cx + 90 * s, onShuffle);

  const drawBadge = (btn, label, count) => {
    btn.badge.clear();
    btn.badge.fillStyle(count > 0 ? 0xe63946 : 0x6b6b6b, 1).fillCircle(btn.bx, btn.by, btn.badgeR);
    btn.badge.lineStyle(2, 0xffffff, 1).strokeCircle(btn.bx, btn.by, btn.badgeR);
    btn.badgeText.setText(label);
  };

  // ---------- public API ----------
  const hud = {
    layout,

    setMoves(n) {
      movesText.setText(`Moves ${n}`);
      movesText.setColor(n <= 3 ? '#ff8f8f' : '#fff3d6');
    },

    // score-goal levels: fills the bar + lights stars. Word levels:
    // just updates the score line.
    setProgress(score) {
      if (!isFree) {
        scoreLine.setText(`Score: ${score}`);
        return;
      }
      const frac = clamp(score / scoreTarget, 0, 1);
      barLabel.setText(`${Math.min(score, scoreTarget)} / ${scoreTarget}`);
      scene.tweens.add({
        targets: progress,
        value: frac,
        duration: 260,
        ease: 'Sine.easeOut',
        onUpdate: drawBar,
      });
      stars.forEach((star, i) => {
        const shouldLight = frac >= (i + 1) / 3;
        if (shouldLight && !star.lit) {
          star.lit = true;
          star.setFillStyle(0xffd23f).setStrokeStyle(3, 0x8a5a00);
          scene.tweens.add({ targets: star, scale: 1.4, duration: 140, yoyo: true, ease: 'Back.easeOut' });
        }
      });
    },

    refreshBoosters() {
      const counts = getBoosters();
      ['bomb', 'lens', 'shuffle'].forEach((type) => {
        const btn = buttons[type];
        const count = counts[type] ?? 0;
        drawBadge(btn, String(count), count);
        btn.img.setAlpha(count > 0 ? 1 : 0.55);
      });
    },
  };

  hud.setMoves(moves);
  hud.refreshBoosters();
  return hud;
}
