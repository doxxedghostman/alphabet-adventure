import Phaser from 'phaser';
import { APP_BG_COLOR, LETTERBOX_BG_COLOR } from '../config.js';
import { getStatus, claimToday, REWARD_SCHEDULE } from '../utils/dailyRewardStore.js';

// Calendar / Daily Rewards — Home Hub's Calendar icon used to just
// show a "coming soon" toast; this is the real screen. Per chat: a
// 7-day check-in cycle (days 1-3 pay 3 gems, days 4-6 pay 5 gems, day
// 7 pays a random booster instead), missing a day resets the streak
// back to day 1. Logic lives in dailyRewardStore.js — this file is
// purely the display + claim button.
//
// Visual direction per chat: bolder than the rest of the app's UI so
// far, reusing the wood/parchment art and gem icon already built for
// SettingsScene rather than introducing a new visual language, on a
// warm cream/light-brown background (reusing LETTERBOX_BG_COLOR,
// which was already picked for exactly this "warm border" tone - see
// config.js) instead of the app's usual dark forest-green scene
// background.
const INK = '#3a2411';
const INK_STROKE = '#fff3d6';
const CARD_LOCKED_ALPHA = 0.55;

export class CalendarScene extends Phaser.Scene {
  constructor() {
    super('CalendarScene');
  }

  preload() {
    // Own copies of these keys (per the codebase's existing convention
    // — see HomeHubScene's header comment on owning its own logo load)
    // rather than assuming SettingsScene has already loaded them.
    this.load.image('calWoodCapLeft', 'assets/wood-cap-left.png');
    this.load.image('calWoodCapRight', 'assets/wood-cap-right.png');
    this.load.image('calWoodMiddle', 'assets/wood-middle.png');
    this.load.image('calParchmentMiddle', 'assets/parchment-middle.png');
    this.load.image('calGemIcon', 'assets/icon-gem.png');
  }

  create() {
    const { width, height } = this.scale;
    this.hudHeight = 56;

    // Warm cream background instead of the app's usual dark forest
    // fill, per chat — this screen is meant to feel distinct/bolder,
    // not blend into the same palette as Home Hub/World Map.
    this.add.rectangle(0, this.hudHeight, width, height - this.hudHeight, LETTERBOX_BG_COLOR).setOrigin(0);

    this.status = getStatus();

    this.createStreakHeader(width);
    this.createDayGrid(width);
    this.createClaimButton(width, height);
    this.createHud(width);
  }

  // --- Streak header ------------------------------------------------------

  createStreakHeader(width) {
    const y = this.hudHeight + 46;

    this.add
      .text(width / 2, y, 'DAILY CHECK-IN', {
        fontFamily: 'Arial',
        fontSize: '26px',
        fontStyle: 'bold',
        color: INK,
        stroke: INK_STROKE,
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const streakLabel = this.status.willReset
      ? 'You missed a day — streak reset to Day 1'
      : `Day ${this.status.currentDay} of 7${this.status.claimedToday ? ' — claimed!' : ''}`;

    this.add
      .text(width / 2, y + 30, streakLabel, {
        fontFamily: 'Arial',
        fontSize: '15px',
        fontStyle: 'bold',
        color: INK,
      })
      .setOrigin(0.5);
  }

  // --- 7-day grid -----------------------------------------------------------

  createDayGrid(width) {
    const cardSize = 92;
    const gap = 12;
    const topY = this.hudHeight + 108;

    // 4 across on row 1, 3 across (centered) on row 2 — 7 doesn't
    // divide evenly into a rectangle, and 4+3 reads better than a
    // lopsided 5+2 or a cramped single scrolling row.
    const row1Count = 4;
    const row2Count = 3;
    const row1Width = row1Count * cardSize + (row1Count - 1) * gap;
    const row2Width = row2Count * cardSize + (row2Count - 1) * gap;
    const row1StartX = (width - row1Width) / 2;
    const row2StartX = (width - row2Width) / 2;
    const rowGap = 16;

    for (let i = 0; i < 7; i += 1) {
      const day = i + 1;
      const row = i < row1Count ? 0 : 1;
      const col = i < row1Count ? i : i - row1Count;
      const startX = row === 0 ? row1StartX : row2StartX;
      const x = startX + col * (cardSize + gap) + cardSize / 2;
      const y = topY + row * (cardSize + rowGap) + cardSize / 2;
      this.createDayCard(x, y, cardSize, day);
    }
  }

  createDayCard(x, y, size, day) {
    const isToday = !this.status.claimedToday && this.status.currentDay === day;
    const isClaimed = this.status.claimedToday
      ? day <= this.status.currentDay
      : day < this.status.currentDay;
    const isFuture = !isToday && !isClaimed;

    const card = this.add.image(x, y, 'calParchmentMiddle');
    card.setDisplaySize(size, size);

    // Bold wood-toned border — thicker and gold when it's today's
    // claimable card, so it's the thing the eye catches first.
    const border = this.add.rectangle(x, y, size, size);
    border.setStrokeStyle(isToday ? 5 : 3, isToday ? 0xffd93d : 0x6b4a2b, 1);

    if (isFuture) {
      card.setAlpha(CARD_LOCKED_ALPHA);
      border.setAlpha(CARD_LOCKED_ALPHA);
    }

    this.add
      .text(x, y - size / 2 + 16, `DAY ${day}`, {
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color: INK,
      })
      .setOrigin(0.5)
      .setAlpha(isFuture ? CARD_LOCKED_ALPHA : 1);

    const schedule = REWARD_SCHEDULE[day - 1];
    if (schedule.type === 'gems') {
      const gem = this.add.image(x - 12, y + 10, 'calGemIcon');
      gem.setDisplaySize(28, 28);
      this.add
        .text(x + 10, y + 10, `${schedule.amount}`, {
          fontFamily: 'Arial',
          fontSize: '18px',
          fontStyle: 'bold',
          color: INK,
        })
        .setOrigin(0, 0.5);
      if (isFuture) {
        gem.setAlpha(CARD_LOCKED_ALPHA);
      }
    } else {
      // Day 7 — surprise booster instead of gems. No dedicated art
      // for Bomb/Shuffle exists yet (see boosterStore.js), so this
      // uses a gift emoji as a placeholder "mystery reward" icon,
      // same lightweight-emoji-placeholder approach used elsewhere in
      // this codebase (e.g. HomeHubScene's avatar circle).
      this.add
        .text(x, y + 10, '\u{1F381}', { fontSize: '30px' })
        .setOrigin(0.5)
        .setAlpha(isFuture ? CARD_LOCKED_ALPHA : 1);
    }

    if (isClaimed) {
      this.add
        .text(x + size / 2 - 8, y - size / 2 + 8, '\u2713', {
          fontFamily: 'Arial',
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#2e7d32',
          stroke: '#ffffff',
          strokeThickness: 3,
        })
        .setOrigin(1, 0);
    }

    if (isToday) {
      this.tweens.add({
        targets: [card, border],
        scale: 1.06,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // --- Claim button -----------------------------------------------------

  createClaimButton(width, height) {
    const y = height - 70;
    const w = width * 0.7;
    const h = 60;

    const claimable = !this.status.claimedToday;
    const label = claimable ? 'CLAIM REWARD' : 'COME BACK TOMORROW';
    const fill = claimable ? 0x2e7d32 : 0x8a8a8a;

    const bg = this.add.rectangle(width / 2, y, w, h, fill, 1).setStrokeStyle(4, 0x1b4d1e, 1);
    const text = this.add
      .text(width / 2, y, label, {
        fontFamily: 'Arial',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    if (!claimable) return;

    bg.setInteractive({ useHandCursor: true });
    const baseScale = 1;

    bg.on('pointerdown', () => {
      this.tweens.add({ targets: [bg, text], scale: baseScale * 0.95, duration: 70 });
    });

    bg.on('pointerup', () => {
      this.tweens.add({
        targets: [bg, text],
        scale: baseScale,
        duration: 100,
        onComplete: () => {
          const result = claimToday();
          if (result) this.scene.restart();
        },
      });
    });
  }

  // --- HUD ---------------------------------------------------------------

  createHud(width) {
    const bar = this.add.rectangle(0, 0, width, this.hudHeight, APP_BG_COLOR, 0.95).setOrigin(0);

    this.add
      .text(width / 2, this.hudHeight / 2, 'Daily Rewards', {
        fontFamily: 'Arial',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const backButton = this.add
      .text(16, this.hudHeight / 2, '\u2190 Back', {
        fontFamily: 'Arial',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffd93d',
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerup', () => this.scene.start('HomeHubScene'));
  }
}
