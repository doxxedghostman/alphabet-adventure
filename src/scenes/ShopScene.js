import Phaser from 'phaser';
import { bindHardwareBack } from '../utils/hardwareBack.js';
import { addWoodPanel, preloadWoodPanel } from '../utils/woodPanel.js';
import { getGems } from '../utils/currencyStore.js';
import { getBoosters, MAX_BOOSTERS } from '../utils/boosterStore.js';
import { DAILY_CAP, recordWatch, watchesRemaining } from '../utils/shopStore.js';
import { showRewardedAdForGems, showRewardedAdForBooster, showRewardedAdForBundle } from '../utils/adsStore.js';

const OFFERS = [
  { key: 'gems', title: '+25 Gems', icons: ['gems'], watch: () => showRewardedAdForGems(25) },
  { key: 'bomb', title: '+1 Bomb', icons: ['bomb'], watch: () => showRewardedAdForBooster('bomb') },
  { key: 'shuffle', title: '+1 Shuffle', icons: ['shuffle'], watch: () => showRewardedAdForBooster('shuffle') },
  { key: 'bundle', title: '+1 Bomb &\n+1 Shuffle', icons: ['bomb', 'shuffle'], watch: showRewardedAdForBundle },
];
const INK = '#3a2411';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  preload() {
    preloadWoodPanel(this);
    this.load.image('utilityBg', 'assets/utility-bg.jpg');
    for (const [key, file] of Object.entries({
      gems: 'icon-gem', bomb: 'icon-bomb', shuffle: 'icon-shuffle',
      video: 'icon-video', back: 'icon-back',
    })) this.load.image(`shop-${key}`, `assets/${file}.png`);
  }

  create() {
    const { width, height } = this.scale;
    this.hudHeight = 56;
    this.pendingOffer = null;
    // Distinguishes this visit from a later visit if an async ad outlives shutdown.
    this.visit = {};
    this.events.once('shutdown', () => { this.visit = null; });
    this.add.image(width / 2, height / 2, 'utilityBg').setDisplaySize(width, height);
    this.createHud(width);
    this.add.text(width / 2, 106, 'WATCH & COLLECT', {
      fontFamily: 'Arial', fontSize: '26px', fontStyle: 'bold', color: INK,
      stroke: '#fff3d6', strokeThickness: 3,
    }).setOrigin(0.5);
    this.add.text(width / 2, 140, 'One ad per offer. No gems or money spent.', {
      fontFamily: 'Arial', fontSize: '16px', color: INK,
    }).setOrigin(0.5);
    this.balanceText = this.add.text(width / 2, 174, '', {
      fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: INK,
    }).setOrigin(0.5);

    const gap = 18;
    const cardW = (width - 44 - gap) / 2;
    const cardH = Math.min(330, (height - 290 - gap) / 2);
    const top = 208 + Math.max(0, (height - 290 - gap - cardH * 2) / 2);
    this.cards = OFFERS.map((offer, i) => this.createCard(
      offer, 22 + (i % 2) * (cardW + gap), top + Math.floor(i / 2) * (cardH + gap), cardW, cardH,
    ));
    this.messageText = this.add.text(width / 2, height - 44, '5 watches per offer each day', {
      fontFamily: 'Arial', fontSize: '16px', color: INK, align: 'center',
      wordWrap: { width: width - 44 },
    }).setOrigin(0.5);
    this.refreshCards();
    // Refresh daily limits even when the shop remains open across midnight.
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshCards() });
    bindHardwareBack(this, () => this.goBack());
  }

  createHud(width) {
    addWoodPanel(this, 0, this.hudHeight / 2, width, 90);
    this.add.text(width / 2, this.hudHeight / 2, 'Shop', {
      fontFamily: 'Arial', fontSize: '22px', fontStyle: 'bold', color: '#fff3d6',
      stroke: '#3a2411', strokeThickness: 3,
    }).setOrigin(0.5);
    const size = this.hudHeight - 12;
    const icon = this.add.image(16 + size / 2, this.hudHeight / 2, 'shop-back').setDisplaySize(size, size);
    const base = icon.scale;
    const hit = this.add.circle(icon.x, icon.y, size / 2, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.tweens.add({ targets: icon, scale: base * 0.9, duration: 70 }));
    hit.on('pointerout', () => this.tweens.add({ targets: icon, scale: base, duration: 100 }));
    hit.on('pointerup', () => {
      this.tweens.add({ targets: icon, scale: base, duration: 100 });
      this.goBack();
    });
  }

  goBack() {
    if (this.pendingOffer) return;
    this.scene.start('HomeHubScene');
  }

  createCard(offer, x, y, w, h) {
    const cx = x + w / 2;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.16).fillRoundedRect(x + 3, y + 5, w, h, 20);
    bg.fillStyle(0x2a1f47, 1).fillRoundedRect(x, y, w, h, 20);
    bg.lineStyle(offer.key === 'bundle' ? 3 : 2, 0xe9bc61, offer.key === 'bundle' ? 1 : 0.65)
      .strokeRoundedRect(x, y, w, h, 20);
    if (offer.key === 'bundle') {
      const badge = this.add.graphics();
      badge.fillStyle(0xffd93d).fillRoundedRect(cx - 66, y + 10, 132, 24, 10);
      this.add.text(cx, y + 22, 'BEST VALUE', {
        fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#342047',
      }).setOrigin(0.5);
    }
    const iconSize = Math.min(76, h * 0.25);
    const icons = offer.icons.map((key, i) => {
      const icon = this.add.image(cx + (i - (offer.icons.length - 1) / 2) * (iconSize + 8), y + h * 0.29, `shop-${key}`);
      icon.setScale(iconSize / Math.max(icon.width, icon.height));
      return { key, icon };
    });
    this.add.text(cx, y + h * 0.51, offer.title, {
      fontFamily: 'Arial', fontSize: '22px', fontStyle: 'bold', color: '#fff3d6', align: 'center',
    }).setOrigin(0.5);
    const detail = this.add.text(cx, y + h * 0.65, '', {
      fontFamily: 'Arial', fontSize: '12px', color: '#dfd4ed', align: 'center',
    }).setOrigin(0.5);
    const buttonY = y + h - 61;
    const buttonW = w - 24;
    const buttonBg = this.add.graphics();
    const video = this.add.image(cx - 62, buttonY, 'shop-video');
    video.setScale(30 / Math.max(video.width, video.height));
    const label = this.add.text(cx + 12, buttonY, '', {
      fontFamily: 'Arial', fontSize: '17px', fontStyle: 'bold', color: '#ffffff', align: 'center',
    }).setOrigin(0.5);
    const hit = this.add.rectangle(cx, buttonY, buttonW, 46, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.watchOffer(offer));
    const remaining = this.add.text(cx, y + h - 22, '', {
      fontFamily: 'Arial', fontSize: '13px', color: '#dfd4ed',
    }).setOrigin(0.5);
    return { offer, icons, detail, buttonBg, video, label, hit, remaining, cx, buttonY, buttonW };
  }

  isFull(offer, boosters = getBoosters()) {
    const types = offer.icons.filter((key) => key !== 'gems');
    return types.length > 0 && types.every((key) => boosters[key] >= MAX_BOOSTERS[key]);
  }

  refreshCards() {
    const boosters = getBoosters();
    this.balanceText.setText(`Gems: ${getGems()}   Bombs: ${boosters.bomb}/${MAX_BOOSTERS.bomb}   Shuffles: ${boosters.shuffle}/${MAX_BOOSTERS.shuffle}`);
    for (const card of this.cards) {
      const remaining = watchesRemaining(card.offer.key);
      const full = this.isFull(card.offer, boosters);
      const loading = this.pendingOffer === card.offer.key;
      const enabled = !this.pendingOffer && remaining > 0 && !full;
      const label = loading ? 'Loading Ad...' : remaining === 0 ? 'Come back tomorrow' : full ? 'MAX' : 'Watch Ad';
      card.hit.input.enabled = enabled;
      card.buttonBg.clear().fillStyle(enabled ? 0x2e7d32 : 0x696373)
        .fillRoundedRect(card.cx - card.buttonW / 2, card.buttonY - 23, card.buttonW, 46, 12);
      card.video.setVisible(enabled);
      card.label.setText(label).setFontSize(remaining === 0 && !loading ? 14 : 17)
        .setX(card.cx + (enabled ? 12 : 0));
      card.remaining.setText(`${remaining}/${DAILY_CAP} today`);
      for (const { key, icon } of card.icons) {
        icon.setAlpha(key !== 'gems' && boosters[key] >= MAX_BOOSTERS[key] ? 0.4 : 1);
      }
      const fullTypes = card.offer.icons.filter((key) => key !== 'gems' && boosters[key] >= MAX_BOOSTERS[key]);
      card.detail.setText(card.offer.key === 'bundle'
        ? fullTypes.length === 1 ? `${fullTypes[0] === 'bomb' ? 'Bomb' : 'Shuffle'} full - other booster available` : 'One watch for two boosters'
        : 'Guaranteed reward');
    }
  }

  async watchOffer(offer) {
    // Recheck live storage at tap time, not just the last rendered state.
    if (this.pendingOffer || watchesRemaining(offer.key) === 0 || this.isFull(offer)) return;
    const visit = this.visit;
    this.pendingOffer = offer.key;
    this.messageText.setText('Finish the ad to collect your reward.');
    this.refreshCards();
    let result;
    try {
      result = await offer.watch();
    } catch (error) {
      console.warn('ShopScene: rewarded ad failed', error);
      result = { granted: false, reason: 'error' };
    }
    if (result.granted) recordWatch(offer.key);
    if (this.visit !== visit) return;
    this.pendingOffer = null;
    if (result.granted) {
      const reward = offer.key === 'bundle'
        ? [result.bomb && '+1 Bomb', result.shuffle && '+1 Shuffle'].filter(Boolean).join(' & ')
        : offer.title;
      this.messageText.setText(`${reward || 'Reward'} collected!`);
    } else {
      this.messageText.setText({
        'not-native': 'Rewarded ads are available in the mobile app.',
        dismissed: 'Ad not completed. No watch used.',
        error: 'No ad available right now. Please try again.',
      }[result.reason] || 'No reward earned. Please try again.');
    }
    this.refreshCards();
  }
}
