import Phaser from 'phaser';
import { getStatus, claimToday, REWARD_SCHEDULE } from '../utils/dailyRewardStore.js';
import { syncLocalProgressToCloud } from '../utils/authStore.js';
import { bindHardwareBack } from '../utils/hardwareBack.js';
import { showRewardPopup } from '../utils/rewardPopup.js';

// Calendar / Daily Rewards has its own fantasy-castle identity. Reward
// timing, streak resets, claim eligibility, and payouts still live wholly
// in dailyRewardStore.js; this scene only visualizes that state.
const INK = '#4a210f';
const CARD_LOCKED_ALPHA = 0.5;

export class CalendarScene extends Phaser.Scene {
  constructor() {
    super('CalendarScene');
  }

  preload() {
    this.load.image('calendarBg', 'assets/calendar-bg.jpg');
    this.load.image('calendarCardFrame', 'assets/calendar-card-frame.png');
    this.load.image('calendarCardFrameGlow', 'assets/calendar-card-frame-glow.png');
    this.load.image('calendarTitleBanner', 'assets/calendar-title-banner.png');
    this.load.image('calendarCheckinScroll', 'assets/calendar-checkin-scroll.png');
    this.load.image('calParchmentMiddle', 'assets/parchment-middle.png');
    this.load.image('calGemIcon', 'assets/icon-gem.png');
    this.load.image('calBackIcon', 'assets/icon-back.png');
    this.load.image('calClaimButton', 'assets/icon-claim-button.png');
    this.load.image('rewardPopupGem', 'assets/icon-gem.png');
    this.load.image('rewardPopupBomb', 'assets/booster-bomb.png');
    this.load.image('rewardPopupShuffle', 'assets/booster-shuffle.png');
    this.load.image('rewardPopupLife', 'assets/icon-life.png');
  }

  create() {
    const { width, height } = this.scale;

    const bg = this.add.image(width / 2, height / 2, 'calendarBg');
    bg.setScale(Math.max(width / bg.width, height / bg.height));
    this.add.rectangle(0, 0, width, height, 0x07122f, 0.12).setOrigin(0);

    this.status = getStatus();
    const layout = this.getLayout(width, height);

    this.createDayGrid(width, layout);
    this.createClaimButton(width, height, layout);
    this.createStreakHeader(width, layout);
    this.createHud(width, layout);
    bindHardwareBack(this, () => this.goBack());
  }

  getLayout(width, height) {
    const bannerH = Phaser.Math.Clamp(height * 0.1, 86, 112);
    const bannerY = 12 + bannerH / 2;
    const scrollH = Phaser.Math.Clamp(height * 0.094, 80, 106);
    const scrollY = bannerY + bannerH / 2 + scrollH / 2 - 5;
    const claimH = Phaser.Math.Clamp(height * 0.105, 92, 116);
    const claimY = height - claimH / 2 - 35;
    const day7H = Phaser.Math.Clamp(height * 0.14, 124, 160);
    const day7Y = claimY - claimH / 2 - day7H / 2 - 22;
    const gridTop = scrollY + scrollH / 2 + 9;
    const pairedBottom = day7Y - day7H / 2 - 12;
    const cardGap = 8;
    const cardW = (width - 32 - cardGap * 2) / 3;
    const rowGap = 10;
    const cardH = Math.min(cardW * 1.3, (pairedBottom - gridTop - rowGap) / 2);
    const pairedHeight = cardH * 2 + rowGap;
    const pairedTop = gridTop + Math.max(0, (pairedBottom - gridTop - pairedHeight) / 2);

    return {
      bannerH,
      bannerY,
      scrollH,
      scrollY,
      claimH,
      claimY,
      day7H,
      day7Y,
      cardGap,
      cardW,
      cardH,
      rowGap,
      pairedTop,
    };
  }

  goBack() {
    this.scene.start('HomeHubScene');
  }

  // --- Streak header ------------------------------------------------------

  createStreakHeader(width, layout) {
    const scrollW = Math.min(width + 4, 520);
    this.add.image(width / 2, layout.scrollY, 'calendarCheckinScroll').setDisplaySize(scrollW, layout.scrollH);

    this.add
      .text(width / 2, layout.scrollY - layout.scrollH * 0.14, 'DAILY CHECK-IN', {
        fontFamily: 'Georgia, serif',
        fontSize: `${Math.round(layout.scrollH * 0.25)}px`,
        fontStyle: 'bold',
        color: INK,
        stroke: '#fff0bd',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    const streakLabel = this.status.willReset
      ? 'Missed a day — reset to Day 1'
      : `Day ${this.status.currentDay} of 7${this.status.claimedToday ? ' — claimed!' : ''}`;

    this.add
      .text(width / 2, layout.scrollY + layout.scrollH * 0.11, streakLabel, {
        fontFamily: 'Georgia, serif',
        fontSize: `${Math.round(layout.scrollH * 0.15)}px`,
        fontStyle: 'bold',
        color: INK,
      })
      .setOrigin(0.5);
  }

  // --- 7-day grid ---------------------------------------------------------

  createDayGrid(width, layout) {
    const gridWidth = layout.cardW * 3 + layout.cardGap * 2;
    const startX = (width - gridWidth) / 2;

    for (let i = 0; i < 6; i += 1) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = startX + col * (layout.cardW + layout.cardGap) + layout.cardW / 2;
      const y = layout.pairedTop + row * (layout.cardH + layout.rowGap) + layout.cardH / 2;
      this.createDayCard(x, y, layout.cardW, layout.cardH, i + 1);
    }

    this.createDayCard(width / 2, layout.day7Y, layout.cardW * 1.9, layout.day7H, 7);
  }

  createDayCard(x, y, w, h, day) {
    const isToday = !this.status.claimedToday && this.status.currentDay === day;
    const isClaimed = this.status.claimedToday
      ? day <= this.status.currentDay
      : day < this.status.currentDay;
    const isFuture = !isToday && !isClaimed;
    const alpha = isFuture ? CARD_LOCKED_ALPHA : 1;

    const shadow = this.add.rectangle(x + 3, y + 5, w * 0.91, h * 0.92, 0x050514, 0.42);
    const panel = this.add.rectangle(x, y, w * 0.78, h * 0.8, 0xf7d799, 1);
    const card = this.add.image(x, y, 'calParchmentMiddle').setDisplaySize(w * 0.8, h * 0.82);
    const frame = this.add
      .image(x, y, isToday ? 'calendarCardFrameGlow' : 'calendarCardFrame')
      .setDisplaySize(w, h);

    const headerW = w * 0.76;
    const headerH = Math.max(25, h * 0.2);
    const headerY = y - h * 0.31;
    const headerColor = day === 7 ? 0x65137f : isToday ? 0x073fba : 0x663313;
    const header = this.add
      .rectangle(x, headerY, headerW, headerH, headerColor, 0.98)
      .setStrokeStyle(2, isToday ? 0xffff8a : 0xd99737, 1);

    [shadow, panel, card, frame, header].forEach((object) => object.setAlpha(alpha));

    this.add
      .text(x, headerY, `DAY ${day}`, {
        fontFamily: 'Georgia, serif',
        fontSize: `${Math.round(Math.min(headerH * 0.64, 25))}px`,
        fontStyle: 'bold',
        color: '#fff5d7',
        stroke: '#4c2107',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(alpha);

    const schedule = REWARD_SCHEDULE[day - 1];
    if (schedule.type === 'gems') {
      const iconD = Math.min(w * 0.49, h * 0.36);
      this.add
        .image(x, y + h * 0.03, 'calGemIcon')
        .setDisplaySize(iconD, iconD)
        .setAlpha(alpha);
      this.add
        .text(x, y + h * 0.31, `${schedule.amount}`, {
          fontFamily: 'Georgia, serif',
          fontSize: `${Math.round(Math.min(h * 0.2, 32))}px`,
          fontStyle: 'bold',
          color: INK,
          stroke: '#fff0b8',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setAlpha(alpha);
    } else {
      this.add
        .text(x, y + h * 0.09, '🎁', { fontSize: `${Math.round(Math.min(h * 0.46, 66))}px` })
        .setOrigin(0.5)
        .setAlpha(alpha);
    }

    if (isClaimed) {
      const badgeX = x + w * 0.39;
      const badgeY = y - h * 0.39;
      this.add.circle(badgeX, badgeY, Math.max(10, w * 0.075), 0x2d963f, 1).setStrokeStyle(2, 0xffe17a);
      this.add
        .text(badgeX, badgeY - 1, '✓', {
          fontFamily: 'Arial',
          fontSize: `${Math.round(Math.max(14, w * 0.12))}px`,
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5);
    }

    if (isToday) {
      this.tweens.add({
        targets: frame,
        scaleX: frame.scaleX * 1.035,
        scaleY: frame.scaleY * 1.035,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // --- Claim button -------------------------------------------------------

  createClaimButton(width, height, layout) {
    const claimable = !this.status.claimedToday;

    if (claimable) {
      const button = this.add.image(width / 2, layout.claimY, 'calClaimButton');
      button.setDisplaySize(Math.min(width * 0.56, 290), layout.claimH);
      const baseScale = button.scale;

      const schedule = REWARD_SCHEDULE[this.status.currentDay - 1];
      const rewardLabel = schedule.type === 'gems' ? `+${schedule.amount} Gems` : 'Mystery Booster';
      const labelY = Math.min(height - 15, layout.claimY + button.displayHeight / 2 + 14);
      this.add
        .rectangle(width / 2, labelY, Math.min(210, width * 0.46), 29, 0x251332, 0.92)
        .setStrokeStyle(2, 0xd69a39, 1);
      this.add
        .text(width / 2, labelY, rewardLabel, {
          fontFamily: 'Georgia, serif',
          fontSize: '17px',
          fontStyle: 'bold',
          color: '#fff3d1',
        })
        .setOrigin(0.5);

      const hit = this.add
        .ellipse(width / 2, layout.claimY, button.displayWidth, button.displayHeight, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.tweens.add({ targets: button, scale: baseScale * 0.94, duration: 70 }));
      hit.on('pointerout', () => this.tweens.add({ targets: button, scale: baseScale, duration: 100 }));
      hit.on('pointerup', () => {
        this.tweens.add({
          targets: button,
          scale: baseScale,
          duration: 100,
          onComplete: async () => {
            const result = claimToday();
            if (result) {
              syncLocalProgressToCloud();
              const dismissed = await showRewardPopup(this, {
                type: result.reward.boosterType || result.reward.type,
                amount: result.reward.amount,
              });
              if (dismissed && this.sys.isActive()) this.scene.restart();
            }
          },
        });
      });
      return;
    }

    const buttonW = Math.min(width * 0.72, 360);
    const buttonH = 58;
    this.add
      .rectangle(width / 2, layout.claimY, buttonW, buttonH, 0x332b42, 0.96)
      .setStrokeStyle(4, 0x9a7c47, 1);
    this.add
      .text(width / 2, layout.claimY, 'COME BACK TOMORROW', {
        fontFamily: 'Georgia, serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#d8d0c3',
        stroke: '#11101a',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
  }

  // --- Title / navigation -------------------------------------------------

  createHud(width, layout) {
    const bannerW = Math.min(width - 24, 492);
    this.add.image(width / 2, layout.bannerY, 'calendarTitleBanner').setDisplaySize(bannerW, layout.bannerH);
    this.add
      .text(width / 2, layout.bannerY + layout.bannerH * 0.08, 'Daily Rewards', {
        fontFamily: 'Georgia, serif',
        fontSize: `${Math.round(layout.bannerH * 0.34)}px`,
        fontStyle: 'bold',
        color: '#fff3c2',
        stroke: '#542103',
        strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 3, color: '#050a2b', blur: 2, fill: true },
      })
      .setOrigin(0.5);

    const backSize = Phaser.Math.Clamp(layout.bannerH * 0.62, 54, 68);
    const backIcon = this.add.image(12 + backSize / 2, 12 + backSize / 2, 'calBackIcon');
    backIcon.setDisplaySize(backSize, backSize);
    const backBase = backIcon.scale;
    const backHit = this.add
      .circle(backIcon.x, backIcon.y, backSize / 2, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    backHit.on('pointerdown', () => this.tweens.add({ targets: backIcon, scale: backBase * 0.9, duration: 70 }));
    backHit.on('pointerout', () => this.tweens.add({ targets: backIcon, scale: backBase, duration: 100 }));
    backHit.on('pointerup', () => {
      this.tweens.add({ targets: backIcon, scale: backBase, duration: 100 });
      this.goBack();
    });
  }
}
