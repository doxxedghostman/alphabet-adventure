import Phaser from 'phaser';
import { APP_BG_COLOR, APP_BG_COLOR_RGB } from '../config.js';
import { getGems } from '../utils/currencyStore.js';
import { getLivesStatus, MAX_LIVES } from '../utils/livesStore.js';
import { showRewardedAd } from '../utils/adsStore.js';
import { syncLocalProgressToCloud, getAvatarUrl, isSignedIn } from '../utils/authStore.js';

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
    // Replaces the old plain wood bar + separately-drawn avatar circle/
    // heart/gem/settings icons (per chat) - avatar, heart, gem, and
    // settings art are now baked directly into one image. See
    // createTopBar() for how the real profile photo and the lives/gem
    // numbers get overlaid on top of the baked badges, and how the
    // settings tap target lines up with the baked gear with no visible
    // icon of its own to draw.
    this.load.image('hubTopBarIcons', 'assets/top-bar-icons.png');
    this.load.image('hubWordMapButton', 'assets/word-map-button.png');
    this.load.image('hubMapPreviewCard', 'assets/map-preview-card.jpg');
    this.load.image('hubForestBg', 'assets/forest-background.jpg');
    this.load.image('hubLetterBlocks', 'assets/letter-blocks-strip.png');

    this.load.image('iconShop', 'assets/icon-shop.png');
    this.load.image('iconLeaderboard', 'assets/icon-leaderboard.png');
    this.load.image('iconCalendar', 'assets/icon-calendar.png');
    this.load.image('iconVideo', 'assets/icon-video.png');

    // Real profile photo (Google avatar) to overlay on the baked-in
    // avatar badge when signed in - same pattern as Settings' signed-in
    // row. Falls back to the baked default face art when there's no
    // photo (guest, or signed in but the provider gave no picture).
    const avatarUrl = getAvatarUrl();
    if (avatarUrl) {
      this.load.image('userAvatarHub', avatarUrl);
    }
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

  // --- Top bar: avatar, hearts, gem, settings - all baked into one image --

  createTopBar(width) {
    // New art (per chat) bakes the avatar/heart/gem/settings badges
    // directly into the bar image itself, rather than a plain wood
    // strip with those drawn separately on top. Native art is
    // 805x310 - scaled to fit the bar width while keeping its own
    // aspect ratio (unlike the old plain strip, forcing a mismatched
    // height here would visibly squash the round badges into ovals).
    // The 4 badge centers below were measured directly off that art
    // (see the coordinate-grid overlay used to find them) - they're
    // fixed to this specific image, not derived from anything dynamic.
    const NATIVE_W = 805;
    const NATIVE_H = 310;
    const BADGE = {
      avatar: { x: 78, y: 150, d: 124 },
      heart: { x: 285, y: 142, d: 100 },
      gem: { x: 505, y: 142, d: 105 },
      gear: { x: 720, y: 150, d: 110 },
    };

    const displayW = width - 8;
    const scale = displayW / NATIVE_W;
    const displayH = NATIVE_H * scale;

    // Positioned so the bar's actual painted content (which has some
    // transparent margin above/below in the source art) starts at the
    // same barY the old plain-strip bar used, not the image's own
    // (0,0) corner.
    const barY = 8;
    const CONTENT_TOP_NATIVE = 76; // where the wood shape actually starts in the source art
    const imgTop = barY - CONTENT_TOP_NATIVE * scale;
    const imgLeft = width / 2 - displayW / 2;

    this.add.image(width / 2, imgTop, 'hubTopBarIcons').setOrigin(0.5, 0).setDisplaySize(displayW, displayH);

    // Maps a badge's native art coordinates to this bar's actual
    // on-screen position at whatever scale it ended up at.
    const toScreen = (b) => ({ x: imgLeft + b.x * scale, y: imgTop + b.y * scale, d: b.d * scale });

    // --- Avatar: overlay the real Google profile photo when signed in
    // (masked circular, sized to sit just inside the baked gold ring),
    // otherwise leave the baked default face art showing as-is.
    const avatarPos = toScreen(BADGE.avatar);
    if (isSignedIn() && this.textures.exists('userAvatarHub')) {
      const photoD = avatarPos.d * 0.82; // inset from the badge's outer gold ring
      const avatar = this.add.image(avatarPos.x, avatarPos.y, 'userAvatarHub');
      avatar.setDisplaySize(photoD, photoD);
      const mask = this.add.circle(avatarPos.x, avatarPos.y, photoD / 2, 0xffffff).setVisible(false);
      avatar.setMask(mask.createGeometryMask());
    }

    // --- Lives/gem counts: rendered as "big metal 3D gold" numbers (per
    // chat) - a dark bronze back-copy offset down-right, plus a bright
    // gold front copy with a bronze stroke and drop shadow on top, which
    // reads as embossed metal rather than flat text. Previous style
    // (small, dark #8a5a1c) blended straight into the wood grain and sat
    // too high above the badge - both fixed here: bigger font, better
    // contrast, vertically re-centered on the badge, and auto-shrunk if
    // it would ever overflow the gap between this badge and the next one
    // (e.g. lives ever going to a 2-digit max).
    const renderMetalNumber = (x, y, text, maxWidth) => {
      let fontSize = 26;
      const style = (offset) => ({
        fontFamily: 'Arial Black, Arial',
        fontStyle: 'bold',
        fontSize: `${fontSize}px`,
        color: offset ? '#3d2408' : '#ffdf70',
        stroke: offset ? '#000000' : '#7a4a12',
        strokeThickness: fontSize * (offset ? 0.16 : 0.14),
        shadow: offset ? undefined : { offsetX: 0, offsetY: 2, color: '#000000', blur: 2, fill: true },
      });

      // Shrink to fit before drawing anything, rather than drawing then
      // measuring - avoids a visible resize flash and extra objects.
      const probe = this.add.text(0, 0, text, style(false)).setVisible(false);
      while (probe.width > maxWidth && fontSize > 14) {
        fontSize -= 2;
        probe.setStyle(style(false));
      }
      probe.destroy();

      const back = this.add.text(x + 2, y + 2, text, style(true)).setOrigin(0, 0.5);
      const front = this.add.text(x, y, text, style(false)).setOrigin(0, 0.5);
      return [back, front];
    };

    // --- Lives count, in the gap between the heart and gem badges.
    const heartPos = toScreen(BADGE.heart);
    const gemPos = toScreen(BADGE.gem);
    const gearPos = toScreen(BADGE.gear);
    const heartGapStart = heartPos.x + heartPos.d / 2 + 6;
    const heartGapEnd = gemPos.x - gemPos.d / 2 - 4;
    renderMetalNumber(heartGapStart, heartPos.y + 2, `${getLivesStatus().lives}/${MAX_LIVES}`, heartGapEnd - heartGapStart);

    // --- Gem count, in the gap between the gem and gear badges.
    const gemGapStart = gemPos.x + gemPos.d / 2 + 6;
    const gemGapEnd = gearPos.x - gearPos.d / 2 - 4;
    renderMetalNumber(gemGapStart, gemPos.y + 2, `${getGems()}`, gemGapEnd - gemGapStart);

    // --- Settings: no icon to draw (it's baked in) - just an invisible
    // hit zone sized to the gear badge so tapping it still navigates.
    // No press-bounce here (unlike the old separately-drawn gear icon)
    // since there's no isolated sprite for just that badge to animate -
    // it's one flat image with everything painted into it.
    this.add.circle(gearPos.x, gearPos.y, gearPos.d / 2, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start('SettingsScene'));
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
