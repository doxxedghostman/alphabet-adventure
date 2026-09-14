import Phaser from 'phaser';
import { APP_BG_COLOR, APP_BG_COLOR_RGB } from '../config.js';
import { getGems } from '../utils/currencyStore.js';
import { getLivesStatus, MAX_LIVES } from '../utils/livesStore.js';
import { showRewardedAd } from '../utils/adsStore.js';
import { syncLocalProgressToCloud } from '../utils/authStore.js';

// Home Hub (per chat): sits between the splash/logo Main Menu and the
// World Map. Modeled on the reference mockup image the user provided -
// avatar/name/currency/settings bar, a shop/gallery/trophy/leaderboard
// column on the left, a coin-shop/calendar/video column on the right,
// a logo + mini map preview in the center, and a big "Word Map" button
// at the bottom that's the only way forward from here.
//
// Per chat follow-up: stripped the two side columns down from 7 icons
// to the 4 actually worth building right now - Shop, Leaderboard,
// Calendar (daily rewards), and Video (rewarded ads). Gallery, Trophy,
// and Coin Shop were cut rather than kept as inert decoration: they're
// collection/achievement polish that only pays off once there's real
// content depth (levels, cosmetics) to reward, which doesn't exist yet
// at 5 demo levels. Coin Shop specifically folded into Shop rather
// than staying separate - two currency stores is redundant for a
// 4-icon set. Their load.image() calls were removed along with them,
// following the same precedent as the earlier spin-wheel icon removal
// (asset files left on disk, just unreferenced) rather than deleting
// the now-unused PNGs.
//
// None of the remaining 4 have real functionality yet either - each
// just shows a "coming soon" toast on tap for now (see
// showComingSoonToast()) rather than doing nothing, so tapping still
// gives feedback instead of feeling broken. Real screens for these
// get built one at a time in later passes - per chat, Calendar and
// Leaderboard are next in line (retention/social value, and Supabase
// already covers the backend for both), Shop explicitly stays a
// placeholder "until we think on what to add" to sell.
//
// Art: swapped from code-drawn placeholders to the real generated art
// (forest bg, wood top bar, word-map banner, mini map parchment card,
// 8 side icons, decorative letter blocks) once the user sent it over.
// Icons were re-keyed for transparency on our end (originals had a flat
// white background baked in, not real alpha) before being added.
//
// Per chat follow-up: the glow/shine idle-animation pass from
// utils/effects.js (applied here to the "+" button, every icon, the
// map preview's star node, the letter blocks, and the Word Map button)
// plus the semi-transparent white backing card behind every icon were
// producing a "white blink" artifact on-device - removed entirely.
// Icons sit directly on the forest background with no backing box.
// The spin-wheel icon was dropped from the right column too (not
// needed) rather than kept and fixed. "Guest_Player" placeholder text
// was also dropped from the top bar - real profile/settings icons and
// account data (Google sign-in + Supabase) are coming next.
//
// Per later chat: a slow vertical float WAS added back to the 4 side
// icons (see createColumnIcon()) - just a small y-position tween, no
// alpha/tint/texture involved, which is a different mechanism from
// the glow/shine pass above and shouldn't reproduce that same bug.
export class HomeHubScene extends Phaser.Scene {
  constructor() {
    super('HomeHubScene');
  }

  preload() {
    // Loaded here directly (not inherited from MainMenuScene's load order)
    // since this scene owns its own use of the logo.
    this.load.image('menuLogo', 'assets/menu-logo.png');
    this.load.image('hubTopBar', 'assets/top-bar.png');
    this.load.image('hubWordMapButton', 'assets/word-map-button.png');
    this.load.image('hubMapPreviewCard', 'assets/map-preview-card.jpg');
    this.load.image('hubForestBg', 'assets/forest-background.jpg');
    this.load.image('hubLetterBlocks', 'assets/letter-blocks-strip.png');

    this.load.image('iconShop', 'assets/icon-shop.png');
    this.load.image('iconLeaderboard', 'assets/icon-leaderboard.png');
    this.load.image('iconCalendar', 'assets/icon-calendar.png');
    this.load.image('iconVideo', 'assets/icon-video.png');
    this.load.image('iconSettings', 'assets/icon-settings.png');
    this.load.image('iconGem', 'assets/icon-gem.png');
    this.load.image('iconLife', 'assets/icon-life.png');
  }

  create(sceneData) {
    const { width, height } = this.scale;

    this.createBackground(width, height);
    this.createTopBar(width);
    this.createLogoAndMapPreview(width);
    this.createIconGrid(width);
    this.createWordMapButton(width, height);

    // Set when returning from a successful Watch to Earn (see
    // handleWatchToEarn) - shown after restart rather than before it,
    // since restart() tears down whatever toast was already on screen.
    if (sceneData?.toastMessage) this.showComingSoonToast(sceneData.toastMessage);
  }

  // --- Background -----------------------------------------------------------

  createBackground(width, height) {
    // Static illustrated forest/waterfall background (per chat - replaces
    // the earlier looping video, which was only 624x840 and looked
    // blurry once stretched to fill a phone screen, plus lost ~5% off
    // the top/bottom to the cover-scale crop; this illustration holds up
    // sharp at the same crop since it's clean line/paint art rather than
    // video footage).
    //
    // Forest bg is portrait-ish (600x900) but not the same aspect as the
    // fixed game canvas - scale to cover width/height and center so it
    // fills the frame with no letterboxing, same idea as a CSS
    // background-size: cover.
    const bg = this.add.image(width / 2, height / 2, 'hubForestBg');
    const scale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(scale);

    // Little bit of life instead of a dead-static image: a very slow,
    // barely-perceptible drift/zoom (classic "Ken Burns" pan), yoyoing
    // forever. Subtle on purpose - previous idle-effect passes on this
    // screen (glow/shine on the icons) were tried and then deliberately
    // removed for a plainer look, so this stays understated and lives
    // only on the background, not the UI.
    this.tweens.add({
      targets: bg,
      scale: scale * 1.06,
      x: bg.x - 10,
      y: bg.y - 6,
      duration: 14000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Dim it slightly so the UI on top stays readable, same role the
    // flat APP_BG_COLOR rectangle used to play.
    this.add.rectangle(0, 0, width, height, 0x1a1030, 0.15).setOrigin(0);
  }

  // --- Top bar: avatar, name, currency, add-currency, settings -----------

  createTopBar(width) {
    // Enlarged again per chat (96 -> 118) - the bar read as thin/short
    // relative to the icons sitting on it, especially once those icons
    // themselves got bigger below.
    const barHeight = 118;
    const barY = 8;

    const bar = this.add.image(width / 2, barY, 'hubTopBar').setOrigin(0.5, 0);
    bar.setDisplaySize(width - 8, barHeight);

    const cy = barY + barHeight / 2;

    // Avatar (placeholder - no account system yet; real profile icon +
    // account data coming with the Google sign-in / Supabase work).
    // Enlarged per chat (26 -> 30 radius) along with everything else here.
    this.add.circle(52, cy, 30, 0x8f5c3c, 1).setStrokeStyle(2, 0xffffff, 0.9);
    this.add.text(52, cy, '\u{1F9D2}', { fontSize: '32px' }).setOrigin(0.5);

    // Bold/embossed "3D" number style (per chat) - a dark stroke plus a
    // soft drop shadow reads as chunky/carved rather than flat, matching
    // the logo's own chunky lettering. Shared by the lives and gem
    // counts below rather than duplicated inline.
    const numberStyle = {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#8a5a1c',
      stroke: '#4a2f10',
      strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 2, fill: true },
    };

    // Lives (livesStore.js) - real icon art now (icon-life.png).
    // Enlarged per chat (32 -> 38 icon, 18 -> 22 text).
    const livesX = width - 222;
    const lifeIcon = this.add.image(livesX, cy, 'iconLife');
    lifeIcon.setDisplaySize(38, 38);
    this.add.text(livesX + 24, cy, `${getLivesStatus().lives}/${MAX_LIVES}`, {
      ...numberStyle,
      fontSize: '22px',
    }).setOrigin(0, 0.5);

    // Currency: now reads a real balance (currencyStore.js), first
    // populated by the Calendar's gem rewards — per chat, previously
    // hardcoded to 0 since nothing granted gems yet. The "+"
    // add-currency button stays removed (still no way to buy gems,
    // just earn them) rather than left as a dead tap target.
    // Enlarged per chat (38 -> 44 icon, 20 -> 24 text).
    const currencyX = width - 126;
    const gem = this.add.image(currencyX, cy, 'iconGem');
    gem.setDisplaySize(44, 44);
    this.add.text(currencyX + 28, cy, `${getGems()}`, {
      ...numberStyle,
      fontSize: '24px',
    }).setOrigin(0, 0.5);

    // Enlarged per chat (58 -> 64).
    this.createImageIconButton(width - 50, cy, 'iconSettings', () => this.scene.start('SettingsScene'), 64);
  }

  // Real icon image (wooden settings tile, gem, etc.) with a tap
  // bounce. Uses the baseScale-relative tween pattern - see the icon
  // pop-out fix in createColumnIcon() for why that matters (tweening
  // to a literal scale value instead of baseScale * factor is what
  // caused icons to balloon up on tap).
  createImageIconButton(x, y, textureKey, onTap, size = 34) {
    const icon = this.add.image(x, y, textureKey);
    icon.setDisplaySize(size, size);
    const baseScale = icon.scale;

    const hit = this.add.circle(x, y, size / 2, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.tweens.add({ targets: icon, scale: baseScale * 0.85, duration: 70 }));
    hit.on('pointerup', () => {
      this.tweens.add({ targets: icon, scale: baseScale, duration: 100 });
      onTap();
    });
    return icon;
  }

  // --- Center: logo + decorative mini map preview -------------------------

  createLogoAndMapPreview(width) {
    // Logo enlarged per chat, pushed down slightly (98 vs 76) to sit
    // below the now-taller top bar.
    const logo = this.add.image(width / 2, 118, 'menuLogo').setOrigin(0.5, 0);
    logo.setScale(Math.min(1, (width * 0.56) / logo.width));

    // The decorative "Word Map" wood ribbon + text that used to sit
    // here (hubWordMapBanner) is removed per chat - it duplicated the
    // real "Word Map" button at the bottom of the screen (the actual
    // navigation forward, see createWordMapButton()) with no
    // functionality of its own, which read as two confusing "Word Map"
    // labels on one screen. The letter-block strip now sits directly
    // below the logo instead of below that banner.
    //
    // Mini map preview removed per chat (parchment card, dashed path,
    // and lock/star nodes all taken out) - the letter-block strip below
    // now sits under the logo.
    this.mapPreviewBottom = logo.y + logo.displayHeight + 24;

    // Decorative letter-block strip - purely for flavor, not
    // interactive, no idle animation.
    const blocks = this.add.image(width / 2, this.mapPreviewBottom + 64, 'hubLetterBlocks');
    blocks.setDisplaySize(width * 0.64, (width * 0.64) * (300 / 900));

    // Top of the icon grid (see createIconGrid) - just below the
    // letter blocks' bottom edge, with a little breathing room.
    this.iconGridTop = blocks.y + blocks.displayHeight / 2 + 30;
  }

  // --- Icon grid (moved here from side columns per chat - the empty
  // stretch of background between the letter blocks and the Word Map
  // button had nothing in it, while the icons were cramped into two
  // thin side columns) -------------------------------------------------

  createIconGrid(width) {
    // Shop/Leaderboard were the left column, Calendar/Video were the
    // right column - kept as the same left/right pairing here (now
    // top-row/bottom-row within each column) so the relocation doesn't
    // scramble which icon someone expects to find near which other one.
    const icons = [
      { key: 'iconShop', label: 'Shop \u2013 coming soon' },
      { key: 'iconCalendar', label: 'Daily Rewards', action: () => this.scene.start('CalendarScene') },
      { key: 'iconLeaderboard', label: 'Leaderboard', action: () => this.scene.start('LeaderboardScene') },
      { key: 'iconVideo', label: 'Watch to Earn', action: () => this.handleWatchToEarn() },
    ];

    // 2x2 grid centered in the gap between the letter blocks
    // (this.mapPreviewBottom + ~119 tall) and the Word Map button
    // (top edge ~910 on the 516x1118 canvas) - see the layout comment
    // on CANVAS_SIZE in config.js for where those numbers come from.
    const colX = [width * 0.28, width * 0.72];
    const rowY = [this.iconGridTop + 70, this.iconGridTop + 240];
    const positions = [
      [colX[0], rowY[0]], [colX[1], rowY[0]],
      [colX[0], rowY[1]], [colX[1], rowY[1]],
    ];

    icons.forEach(({ key, label, action }, i) => {
      const [cx, cy] = positions[i];
      this.createGridIcon(cx, cy, key, label, action);
    });
  }

  // `action`, when given, replaces the default "coming soon" toast -
  // used by Calendar/Leaderboard/Video now that they're real screens.
  // Icons without one still just toast, same as before. Takes CENTER
  // coordinates directly (unlike the old side-column version this
  // replaces, which took a top-left corner) since a symmetric grid is
  // simpler to lay out from centers.
  createGridIcon(cx, cy, textureKey, label, action) {
    const size = 100;
    const displaySize = 140; // enlarged per chat now that they have room to breathe

    // No backing card - icons sit directly on the forest background.
    const icon = this.add.image(cx, cy, textureKey);
    icon.setDisplaySize(displaySize, displaySize);
    // setDisplaySize gives this image a non-1 base scale. The tap-bounce
    // tween below must scale *relative to that*, not set scale to a
    // literal value - see the same note on the old createColumnIcon
    // this replaces for the "icon pops out" bug that caused.
    const baseScale = icon.scale;

    const hit = this.add.rectangle(cx, cy, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.tweens.add({ targets: icon, scale: baseScale * 0.88, duration: 70 }));
    hit.on('pointerup', () => {
      this.tweens.add({ targets: icon, scale: baseScale, duration: 100 });
      if (action) action();
      else this.showComingSoonToast(label);
    });

    // Slow float (per chat): a small, gentle up/down drift so the icon
    // reads as alive rather than static - see createIconGrid's sibling
    // note above for why the hit rectangle deliberately doesn't move
    // with it. Duration/delay jittered per icon so all 4 don't bob in
    // unison.
    this.tweens.add({
      targets: icon,
      y: cy - 8,
      duration: 1700 + Phaser.Math.Between(-200, 200),
      delay: Phaser.Math.Between(0, 600),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // Real screens for these get built one at a time (per chat, Calendar
  // and Leaderboard first) - until then, tapping gives feedback rather
  // than feeling broken/dead. Destroys any toast already on screen
  // first so rapid taps across different icons don't stack.
  // Video icon ("Watch to Earn") - the 4th Home Hub icon, real now
  // (see update.md Milestone 33). Shows a rewarded ad via adsStore.js
  // and grants gems only if the player actually watched it through;
  // every other outcome (no ad available, closed early, running in a
  // browser preview) falls back to the same toast the stub icons use,
  // just with a message specific to what happened.
  async handleWatchToEarn() {
    this.showComingSoonToast('Loading ad\u2026');
    const result = await showRewardedAd();

    if (result.granted) {
      const rewardLabel = {
        gems: `+${result.amount} Gems!`,
        bomb: 'You won a Bomb!',
        shuffle: 'You won a Shuffle!',
        life: '+1 Life!',
      }[result.type] || 'Reward earned!';
      syncLocalProgressToCloud();
      this.scene.restart({ toastMessage: rewardLabel });
      return;
    }

    const message = {
      'not-native': 'Ads only work in the installed app, not this preview.',
      dismissed: 'Ad closed early \u2013 watch the whole thing to earn gems!',
      error: 'No ad available right now \u2013 try again soon.',
    }[result.reason] || 'No ad available right now \u2013 try again soon.';

    this.showComingSoonToast(message);
  }

  showComingSoonToast(text) {
    if (this._toastObjects) {
      this._toastObjects.forEach((obj) => obj.destroy());
      this._toastObjects = null;
    }

    const { width, height } = this.scale;
    const y = height * 0.46;

    const label = this.add
      .text(width / 2, y, text, {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(1)
      .setAlpha(0);

    const bg = this.add
      .rectangle(width / 2, y, label.width + 36, label.height + 20, 0x1a1030, 0.92)
      .setStrokeStyle(1, 0xffd93d, 0.6)
      .setDepth(0)
      .setAlpha(0);

    this._toastObjects = [bg, label];

    this.tweens.add({
      targets: [bg, label],
      alpha: 1,
      duration: 120,
      onComplete: () => {
        this.time.delayedCall(1100, () => {
          this.tweens.add({
            targets: [bg, label],
            alpha: 0,
            duration: 200,
            onComplete: () => {
              bg.destroy();
              label.destroy();
              if (this._toastObjects && this._toastObjects[0] === bg) this._toastObjects = null;
            },
          });
        });
      },
    });
  }

  // --- Bottom: the real navigation forward ----------------------------------

  createWordMapButton(width, height) {
    // Enlarged (0.7 -> 0.88 of canvas width) and moved further up from
    // the bottom edge (height - 62 -> height - 150) per chat - on the
    // new taller canvas the old position/size left it small and stranded
    // right at the bottom edge instead of reading as the main CTA.
    const w = width * 0.88;
    const x = width / 2;
    const y = height - 150;

    // Real art with "Word Map" already baked in, replacing the
    // code-drawn blue rect + text label - image is the whole button now.
    const button = this.add.image(x, y, 'hubWordMapButton');
    button.setDisplaySize(w, w * (button.height / button.width));
    const baseScale = button.scale;

    const hit = this.add.rectangle(x, y, button.displayWidth, button.displayHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.tweens.add({ targets: button, scale: baseScale * 0.96, duration: 70 });
    });
    hit.on('pointerup', () => {
      this.tweens.add({
        targets: button,
        scale: baseScale,
        duration: 100,
        onComplete: () => {
          this.cameras.main.fadeOut(220, ...APP_BG_COLOR_RGB);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('WorldSelectScene');
          });
        },
      });
    });
  }

}
