import Phaser from 'phaser';

// Home Hub (per chat): sits between the splash/logo Main Menu and the
// World Map. Modeled on the reference mockup image the user provided -
// avatar/name/currency/settings bar, a shop/gallery/trophy/leaderboard
// column on the left, a coin-shop/calendar/video column on the right,
// a logo + mini map preview in the center, and a big "Word Map" button
// at the bottom that's the only way forward from here.
//
// Per chat: only the Word Map button and the Settings gear (which now
// opens its own SettingsScene, see that file) are real. The remaining
// icons (shop, gallery, trophy, leaderboard, coin shop, calendar,
// video) are shown but inert - tap just does the press-down bounce,
// no toast/popup, since none of those systems exist yet.
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
// Icons now sit directly on the forest background with no backing box
// and no idle animation anywhere in this scene, only the existing
// press-down/up tap bounce (no toast/popup on tap either). The
// spin-wheel icon was dropped from the right column too (not needed)
// rather than kept and fixed. "Guest_Player" placeholder text was also
// dropped from the top bar - real profile/settings icons and account
// data (Google sign-in + Supabase) are coming next.
export class HomeHubScene extends Phaser.Scene {
  constructor() {
    super('HomeHubScene');
  }

  preload() {
    // Loaded here directly (not inherited from MainMenuScene's load order)
    // since this scene owns its own use of the logo.
    this.load.image('menuLogo', 'assets/menu-logo.png');
    this.load.image('hubTopBar', 'assets/top-bar.png');
    this.load.image('hubWordMapBanner', 'assets/word-map-banner.png');
    this.load.image('hubWordMapButton', 'assets/word-map-button.png');
    this.load.image('hubMapPreviewCard', 'assets/map-preview-card.jpg');
    this.load.image('hubForestBg', 'assets/forest-background.jpg');
    this.load.video('hubBgVideo', 'assets/hub-background-loop-v2.mp4', false);
    this.load.image('hubLetterBlocks', 'assets/letter-blocks-strip.png');

    this.load.image('iconShop', 'assets/icon-shop.png');
    this.load.image('iconGallery', 'assets/icon-gallery.png');
    this.load.image('iconTrophy', 'assets/icon-trophy.png');
    this.load.image('iconLeaderboard', 'assets/icon-leaderboard.png');
    this.load.image('iconCoinShop', 'assets/icon-coin-shop.png');
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
    this.createIconColumn('left', 12);
    this.createIconColumn('right', width - 12 - 82);
    this.createWordMapButton(width, height);
  }

  // --- Background -----------------------------------------------------------

  createBackground(width, height) {
    // Looping waterfall video background (per chat) - falls back to the
    // static forest-background.jpg if video playback fails for any
    // reason (some mobile browsers block autoplay even when muted, or
    // the format isn't supported).
    let bg;
    try {
      const video = this.add.video(width / 2, height / 2, 'hubBgVideo');
      video.setMute(true);
      video.setLoop(true);
      video.play(true);
      const vw = video.width || 624;
      const vh = video.height || 840;
      const scale = Math.max(width / vw, height / vh);
      video.setScale(scale);
      bg = video;
    } catch (e) {
      bg = null;
    }

    if (!bg) {
      // Forest bg is portrait-ish (600x900) but not the same aspect as
      // the fixed game canvas - scale to cover width and center
      // vertically so it fills the frame with no letterboxing, same
      // idea as a CSS background-size: cover.
      bg = this.add.image(width / 2, height / 2, 'hubForestBg');
      const scale = Math.max(width / bg.width, height / bg.height);
      bg.setScale(scale);
    }

    // Dim it slightly so the UI on top stays readable, same role the
    // flat 0x241a3d rectangle used to play. Opacity dropped 0.45 -> 0.15
    // per chat - at 0.45 the video's own bright/hazy palette plus the
    // dark wash combined into a washed-out "faded" look across the
    // whole screen (confirmed by compositing the two to reproduce it),
    // not the actual blur the person suspected - see update.md
    // Milestone 27.
    this.add.rectangle(0, 0, width, height, 0x1a1030, 0.15).setOrigin(0);
  }

  // --- Top bar: avatar, name, currency, add-currency, settings -----------

  createTopBar(width) {
    const barHeight = 74;
    const barY = 6;

    // Widened (closer to the canvas edges) and thicker per chat, so the
    // wood bar reads as a proper substantial header instead of a thin
    // strip.
    const bar = this.add.image(width / 2, barY, 'hubTopBar').setOrigin(0.5, 0);
    bar.setDisplaySize(width - 8, barHeight);

    const cy = barY + barHeight / 2;

    // Avatar (placeholder - no account system yet; real profile icon +
    // account data coming with the Google sign-in / Supabase work).
    this.add.circle(40, cy, 20, 0x8f5c3c, 1).setStrokeStyle(2, 0xffffff, 0.9);
    this.add.text(40, cy, '\u{1F9D2}', { fontSize: '22px' }).setOrigin(0.5);

    // Currency (placeholder - no economy system yet). Enlarged per
    // chat, and the "+" add-currency button removed entirely (no
    // economy system exists for it to add to yet) rather than left as
    // a dead tap target.
    const currencyX = width - 108;
    const gem = this.add.image(currencyX, cy, 'iconGem');
    gem.setDisplaySize(30, 30);
    this.add.text(currencyX + 22, cy, '0', {
      fontFamily: 'Arial',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#8a5a1c',
    }).setOrigin(0, 0.5);

    this.createImageIconButton(width - 40, cy, 'iconSettings', () => this.scene.start('SettingsScene'), 46);
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
    const logo = this.add.image(width / 2, 76, 'menuLogo').setOrigin(0.5, 0);
    logo.setScale(Math.min(1, (width * 0.42) / logo.width));

    const ribbonY = logo.y + logo.displayHeight + 6;
    const banner = this.add.image(width / 2, ribbonY, 'hubWordMapBanner').setOrigin(0.5, 0);
    banner.setDisplaySize(210, 66);
    this.add.text(width / 2, ribbonY + 33, 'Word Map', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#4a2f10',
    }).setOrigin(0.5);

    // Mini map preview removed per chat (parchment card, dashed path,
    // and lock/star nodes all taken out) - the letter-block strip below
    // now sits under the "Word Map" ribbon/text instead of under the
    // map card. Gap widened (26 -> 55) per chat: with the map gone the
    // blocks had ended up sitting right under the logo/ribbon with no
    // breathing room.
    this.mapPreviewBottom = ribbonY + 33;

    // Decorative letter-block strip - purely for flavor, not
    // interactive, no idle animation.
    const blocks = this.add.image(width / 2, this.mapPreviewBottom + 55, 'hubLetterBlocks');
    blocks.setDisplaySize(width * 0.5, (width * 0.5) * (300 / 900));
  }

  // --- Side icon columns ---------------------------------------------------

  createIconColumn(side, x) {
    // Spin-wheel icon removed per chat - not needed.
    const icons = side === 'left'
      ? ['iconShop', 'iconGallery', 'iconTrophy', 'iconLeaderboard']
      : ['iconCoinShop', 'iconCalendar', 'iconVideo'];

    // Enlarged again per chat (58px -> 74px display) - gap grown by
    // more than the size increase (96 -> 108) so the bigger icons still
    // clear each other with room to spare, not just touching edge-to-edge.
    const top = 92;
    const gap = 108;
    icons.forEach((key, i) => this.createColumnIcon(x, top + i * gap, key));
  }

  createColumnIcon(x, y, textureKey) {
    const size = 82;
    const cx = x + size / 2;
    const cy = y + size / 2;

    // No backing card and no idle animation - icons sit directly on the
    // forest background. Tap just does a press-down/up bounce; these
    // systems don't exist yet so there's nothing further to trigger.
    const icon = this.add.image(cx, cy, textureKey);
    icon.setDisplaySize(74, 74);
    // setDisplaySize gives this image a non-1 base scale (native art is
    // 280x280, shown at 42x42, so baseScale ~= 0.15). The tap-bounce
    // tween below must scale *relative to that*, not set scale to a
    // literal 0.88 - doing that was the bug that made icons balloon up
    // to ~6x size on every tap (0.88 absolute vs ~0.15 base), which is
    // the "icon pops out" the person flagged.
    const baseScale = icon.scale;

    const hit = this.add.rectangle(x, y, size, size, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.tweens.add({ targets: icon, scale: baseScale * 0.88, duration: 70 }));
    hit.on('pointerup', () => this.tweens.add({ targets: icon, scale: baseScale, duration: 100 }));
  }

  // --- Bottom: the real navigation forward ----------------------------------

  createWordMapButton(width, height) {
    const w = width * 0.7;
    const x = width / 2;
    // Nudged up per chat (was height - 44) - it was sitting flush at
    // the very bottom edge.
    const y = height - 62;

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
          this.cameras.main.fadeOut(220, 0x24, 0x1a, 0x3d);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('WorldSelectScene');
          });
        },
      });
    });
  }

}
