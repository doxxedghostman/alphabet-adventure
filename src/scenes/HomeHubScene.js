import Phaser from 'phaser';
import { APP_BG_COLOR, APP_BG_COLOR_RGB } from '../config.js';
import { getGems } from '../utils/currencyStore.js';

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
  }

  create() {
    const { width, height } = this.scale;

    this.createBackground(width, height);
    this.createTopBar(width);
    this.createLogoAndMapPreview(width);
    this.createIconColumn('left', 14);
    this.createIconColumn('right', width - 14 - 100);
    this.createWordMapButton(width, height);
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
    // Enlarged per chat (74 -> 96) along with everything else on this
    // screen now that the canvas is a proper phone-height, not the old
    // stubby 624-tall one - there's real room to make the header read as
    // substantial instead of thin.
    const barHeight = 96;
    const barY = 8;

    const bar = this.add.image(width / 2, barY, 'hubTopBar').setOrigin(0.5, 0);
    bar.setDisplaySize(width - 8, barHeight);

    const cy = barY + barHeight / 2;

    // Avatar (placeholder - no account system yet; real profile icon +
    // account data coming with the Google sign-in / Supabase work).
    this.add.circle(52, cy, 26, 0x8f5c3c, 1).setStrokeStyle(2, 0xffffff, 0.9);
    this.add.text(52, cy, '\u{1F9D2}', { fontSize: '28px' }).setOrigin(0.5);

    // Currency: now reads a real balance (currencyStore.js), first
    // populated by the Calendar's gem rewards — per chat, previously
    // hardcoded to 0 since nothing granted gems yet. The "+"
    // add-currency button stays removed (still no way to buy gems,
    // just earn them) rather than left as a dead tap target.
    const currencyX = width - 128;
    const gem = this.add.image(currencyX, cy, 'iconGem');
    gem.setDisplaySize(38, 38);
    this.add.text(currencyX + 26, cy, `${getGems()}`, {
      fontFamily: 'Arial',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#8a5a1c',
    }).setOrigin(0, 0.5);

    this.createImageIconButton(width - 48, cy, 'iconSettings', () => this.scene.start('SettingsScene'), 58);
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
  }

  // --- Side icon columns ---------------------------------------------------

  createIconColumn(side, x) {
    // Stripped down to the 4 icons actually worth building next (per
    // chat) - see the header comment for why Gallery/Trophy/Coin Shop
    // were cut rather than kept as before.
    // Calendar is real now (CalendarScene) - the rest are still stubs.
    const icons = side === 'left'
      ? [{ key: 'iconShop', label: 'Shop \u2013 coming soon' }, { key: 'iconLeaderboard', label: 'Leaderboard', action: () => this.scene.start('LeaderboardScene') }]
      : [{ key: 'iconCalendar', label: 'Daily Rewards', action: () => this.scene.start('CalendarScene') }, { key: 'iconVideo', label: 'Watch to Earn \u2013 coming soon' }];

    // Enlarged again per chat (74px -> 92px display) - gap grown by
    // more than the size increase (108 -> 130) so the bigger icons still
    // clear each other with room to spare, not just touching edge-to-edge.
    // Nudged down (92 -> 130) to clear the now-taller top bar/logo.
    const top = 130;
    const gap = 130;
    icons.forEach(({ key, label, action }, i) => this.createColumnIcon(x, top + i * gap, key, label, action));
  }

  // `action`, when given, replaces the default "coming soon" toast -
  // used by Calendar now that it's a real screen. Icons without one
  // still just toast, same as before.
  createColumnIcon(x, y, textureKey, label, action) {
    const size = 100;
    const cx = x + size / 2;
    const cy = y + size / 2;

    // No backing card - icons sit directly on the forest background.
    const icon = this.add.image(cx, cy, textureKey);
    icon.setDisplaySize(92, 92);
    // setDisplaySize gives this image a non-1 base scale (native art is
    // 280x280, shown at 42x42, so baseScale ~= 0.15). The tap-bounce
    // tween below must scale *relative to that*, not set scale to a
    // literal 0.88 - doing that was the bug that made icons balloon up
    // to ~6x size on every tap (0.88 absolute vs ~0.15 base), which is
    // the "icon pops out" the person flagged.
    const baseScale = icon.scale;

    const hit = this.add.rectangle(x, y, size, size, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.tweens.add({ targets: icon, scale: baseScale * 0.88, duration: 70 }));
    hit.on('pointerup', () => {
      this.tweens.add({ targets: icon, scale: baseScale, duration: 100 });
      if (action) action();
      else this.showComingSoonToast(label);
    });

    // Slow float (per chat): a small, gentle up/down drift so the icon
    // reads as alive rather than static, but always returns to and
    // settles at the same home position - not the earlier glow/shine
    // idle effect that got pulled for a "white blink" artifact (see
    // header comment). This only tweens the icon's own y position, no
    // alpha/tint/texture changes at all, so it's a different kind of
    // animation and shouldn't be able to trigger that same bug. The
    // invisible hit rectangle deliberately does NOT move with it - the
    // ~7px drift is small enough that the tap target stays comfortably
    // under the icon at every point in the float. Duration and start
    // delay are both jittered per icon so all 4 don't bob in unison.
    this.tweens.add({
      targets: icon,
      y: cy - 7,
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
