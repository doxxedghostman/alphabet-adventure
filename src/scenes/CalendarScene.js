import Phaser from 'phaser';
import { APP_BG_COLOR } from '../config.js';
import { getStatus, claimToday, REWARD_SCHEDULE } from '../utils/dailyRewardStore.js';
import { syncLocalProgressToCloud } from '../utils/authStore.js';
import { bindHardwareBack } from '../utils/hardwareBack.js';

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
    this.load.image('calBackIcon', 'assets/icon-back.png');
    this.load.image('calClaimButton', 'assets/icon-claim-button.png');
    // Procedural warm-parchment vignette (radial gradient + subtle paper
    // grain, generated - not a photo), per chat: this screen shouldn't
    // be flat solid color, but per this file's own header comment above
    // it's also deliberately NOT meant to reuse the forest art Home
    // Hub/World Map use, so a textured wash in the same cream family
    // instead of a flat rectangle. Shared with SettingsScene/
    // LeaderboardScene (same 'utilityBg' key, same file) for a
    // consistent light-screen identity across all three.
    this.load.image('utilityBg', 'assets/utility-bg.jpg');
  }

  create() {
    const { width, height } = this.scale;
    this.hudHeight = 56;

    // Warm cream background instead of the app's usual dark forest
    // fill, per chat — this screen is meant to feel distinct/bolder,
    // not blend into the same palette as Home Hub/World Map. Was a
    // flat rectangle; now a textured (but still non-forest, still
    // cream-family) image instead, per later chat.
    this.add.image(width / 2, this.hudHeight + (height - this.hudHeight) / 2, 'utilityBg')
      .setDisplaySize(width, height - this.hudHeight);

    this.status = getStatus();

    this.createStreakHeader(width);
    this.createDayGrid(width, height);
    this.createClaimButton(width, height);
    this.createHud(width);
    bindHardwareBack(this, () => this.goBack());
  }

  goBack() {
    this.scene.start('HomeHubScene');
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

  createDayGrid(width, height) {
    const cols = 2;
    const gap = 14;
    const margin = 22;
    const rowGap = 14;
    const topY = this.hudHeight + 118;
    // Reserve room at the bottom for the new (taller) claim button plus
    // the reward-value line under it - see createClaimButton().
    const bottomReserved = 168;

    // Per chat: fill the screen width with 2 cards per row (days 1-2,
    // 3-4, 5-6) instead of the old lopsided 4-across-then-3-across grid,
    // then Day 7 sits alone on its own row, centered, below days 5-6 -
    // it's the big/surprise reward day so it reads as a standout rather
    // than just another grid cell.
    const cardW = (width - margin * 2 - gap * (cols - 1)) / cols;
    const availableH = height - topY - bottomReserved;
    const rows = 4; // 3 paired rows + Day 7's own row
    const cardH = Math.min(cardW, (availableH - rowGap * (rows - 1)) / rows);

    const gridWidth = cols * cardW + (cols - 1) * gap;
    const startX = (width - gridWidth) / 2;

    for (let i = 0; i < 6; i += 1) {
      const day = i + 1;
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * (cardW + gap) + cardW / 2;
      const y = topY + row * (cardH + rowGap) + cardH / 2;
      this.createDayCard(x, y, cardW, cardH, day);
    }

    // Day 7, centered on its own row underneath.
    const day7Y = topY + 3 * (cardH + rowGap) + cardH / 2;
    this.createDayCard(width / 2, day7Y, cardW, cardH, 7);
  }

  createDayCard(x, y, w, h, day) {
    const isToday = !this.status.claimedToday && this.status.currentDay === day;
    const isClaimed = this.status.claimedToday
      ? day <= this.status.currentDay
      : day < this.status.currentDay;
    const isFuture = !isToday && !isClaimed;

    // Soft drop shadow for a bit of depth/"professional" polish (per
    // chat) - static, not animated, so this doesn't reintroduce any of
    // the idle-effect complaints from Home Hub's earlier rounds.
    const shadow = this.add.rectangle(x + 3, y + 4, w, h, 0x000000, 0.18);

    const card = this.add.image(x, y, 'calParchmentMiddle');
    card.setDisplaySize(w, h);

    // Rounded-rect border via Graphics instead of the old sharp-corner
    // Rectangle stroke - reads less "programmer art", matches the
    // rounded wood-plank language used everywhere else in the app.
    const border = this.add.graphics();
    const lineW = isToday ? 5 : 3;
    border.lineStyle(lineW, isToday ? 0xffd93d : 0x6b4a2b, 1);
    border.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);

    if (isFuture) {
      card.setAlpha(CARD_LOCKED_ALPHA);
      border.setAlpha(CARD_LOCKED_ALPHA);
      shadow.setAlpha(CARD_LOCKED_ALPHA * 0.5);
    }

    const dayFontSize = Math.round(h * 0.15);
    this.add
      .text(x, y - h / 2 + dayFontSize * 0.9, `DAY ${day}`, {
        fontFamily: 'Arial',
        fontSize: `${dayFontSize}px`,
        fontStyle: 'bold',
        color: INK,
      })
      .setOrigin(0.5)
      .setAlpha(isFuture ? CARD_LOCKED_ALPHA : 1);

    const iconD = Math.round(h * 0.34);
    const valueFontSize = Math.round(h * 0.2);
    const schedule = REWARD_SCHEDULE[day - 1];
    if (schedule.type === 'gems') {
      const gem = this.add.image(x - iconD * 0.45, y + h * 0.12, 'calGemIcon');
      gem.setDisplaySize(iconD, iconD);
      this.add
        .text(x + iconD * 0.25, y + h * 0.12, `${schedule.amount}`, {
          fontFamily: 'Arial',
          fontSize: `${valueFontSize}px`,
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
        .text(x, y + h * 0.12, '\u{1F381}', { fontSize: `${Math.round(h * 0.36)}px` })
        .setOrigin(0.5)
        .setAlpha(isFuture ? CARD_LOCKED_ALPHA : 1);
    }

    if (isClaimed) {
      this.add
        .text(x + w / 2 - 8, y - h / 2 + 8, '\u2713', {
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
        scale: 1.05,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // --- Claim button -----------------------------------------------------

  createClaimButton(width, height) {
    const y = height - 100;
    const claimable = !this.status.claimedToday;

    if (claimable) {
      // Real "CLAIM" banner art (per chat) replacing the old plain
      // green rectangle, with today's reward value shown underneath it
      // rather than baked into the button itself - the art's label is
      // fixed ("CLAIM"), the reward amount isn't, so it has to be a
      // separate text layer. Sized by height, not width - the source
      // art is a squarish medallion (gem crown + ribbon), not a wide
      // bar, so scaling it to a fraction of the screen width like a
      // typical button would blow it up far too large.
      const button = this.add.image(width / 2, y, 'calClaimButton');
      const targetH = 118;
      button.setDisplaySize(targetH * (button.width / button.height), targetH);
      const baseScale = button.scale;

      const schedule = REWARD_SCHEDULE[this.status.currentDay - 1];
      const rewardLabel = schedule.type === 'gems' ? `+${schedule.amount} Gems` : 'Mystery Booster';
      this.add
        .text(width / 2, y + button.displayHeight / 2 + 14, rewardLabel, {
          fontFamily: 'Arial',
          fontSize: '18px',
          fontStyle: 'bold',
          color: INK,
        })
        .setOrigin(0.5);

      const hit = this.add.circle(width / 2, y, button.displayWidth / 2, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.tweens.add({ targets: button, scale: baseScale * 0.94, duration: 70 }));
      hit.on('pointerup', () => {
        this.tweens.add({
          targets: button,
          scale: baseScale,
          duration: 100,
          onComplete: () => {
            const result = claimToday();
            if (result) {
              syncLocalProgressToCloud();
              this.scene.restart();
            }
          },
        });
      });
      return;
    }

    // Not claimable today - plain disabled-looking state, no art needed
    // since there's nothing to tap.
    const w = width * 0.7;
    const h = 60;
    this.add.rectangle(width / 2, y, w, h, 0x8a8a8a, 1).setStrokeStyle(4, 0x5a5a5a, 1);
    this.add
      .text(width / 2, y, 'COME BACK TOMORROW', {
        fontFamily: 'Arial',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
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

    // Real gem-themed back button (per chat) replacing the plain
    // "\u2190 Back" text link - same baseScale-relative tap-bounce
    // pattern used everywhere else in this codebase (see HomeHubScene's
    // icon pop-out fix for why that matters).
    const backSize = this.hudHeight - 12;
    const backIcon = this.add.image(16 + backSize / 2, this.hudHeight / 2, 'calBackIcon');
    backIcon.setDisplaySize(backSize, backSize);
    const backBase = backIcon.scale;

    const backHit = this.add.circle(backIcon.x, backIcon.y, backSize / 2, 0xffffff, 0).setInteractive({ useHandCursor: true });
    backHit.on('pointerdown', () => this.tweens.add({ targets: backIcon, scale: backBase * 0.9, duration: 70 }));
    backHit.on('pointerup', () => {
      this.tweens.add({ targets: backIcon, scale: backBase, duration: 100 });
      this.goBack();
    });
  }
}
