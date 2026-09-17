import Phaser from 'phaser';
import { APP_BG_COLOR } from '../config.js';
import { supabase } from '../utils/supabaseClient.js';
import { isSignedIn } from '../utils/authStore.js';
import { bindHardwareBack } from '../utils/hardwareBack.js';

// Leaderboard — Home Hub's Leaderboard icon used to just show a
// "coming soon" toast; this is the real screen. Ranks players by
// gems, reading a new `wordswoop_leaderboard` Postgres VIEW rather
// than `wordswoop_profiles` directly - the profiles table's RLS only
// lets a user read their OWN row (Milestone 25), which is correct for
// account data but makes a leaderboard impossible to query as-is. The
// view exposes only display_name/avatar_url/gems/levels_completed
// (no email, no id) and is owned by a role that bypasses the base
// table's RLS, the standard Postgres/Supabase pattern for "public
// read of a limited slice of a privately-RLS'd table."
//
// IMPORTANT: this view does not exist yet - it has to be created once
// via the Supabase SQL editor (see the migration text handed over
// alongside this commit) before this screen will show real data.
// Until then, the fetch below will error and the screen shows the
// empty state.
//
// Also per this batch: BoardScene (on level win) and CalendarScene
// (on claim) now call authStore's syncLocalProgressToCloud() so a
// signed-in player's gems/completed-levels here stay live instead of
// only updating once at first sign-in.
//
// Guests never appear here at all (they have no wordswoop_profiles
// row) - the empty-state / sign-in nudge covers that case.
const WOOD_TEXT = '#fff3d6';
const INK = '#3a2411';

export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('LeaderboardScene');
  }

  preload() {
    // Own copy of the key (same per-scene-load convention CalendarScene
    // already uses for this same icon) rather than assuming another
    // scene has loaded it first.
    this.load.image('lbBackIcon', 'assets/icon-back.png');
  }

  create() {
    const { width, height } = this.scale;
    this.hudHeight = 56;

    this.add.rectangle(0, this.hudHeight, width, height - this.hudHeight, 0xe8d3a8).setOrigin(0);
    this.createHud(width);

    this.loadingText = this.add
      .text(width / 2, this.hudHeight + 60, 'Loading...', {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: INK,
      })
      .setOrigin(0.5);

    this.fetchLeaderboard(width);
    bindHardwareBack(this, () => this.goBack());
  }

  goBack() {
    this.scene.start('HomeHubScene');
  }

  async fetchLeaderboard(width) {
    const { data, error } = await supabase
      .from('wordswoop_leaderboard')
      .select('display_name, avatar_url, gems, levels_completed')
      .order('gems', { ascending: false })
      .limit(10);

    this.loadingText.destroy();

    if (error || !data || data.length === 0) {
      this.add
        .text(width / 2, this.hudHeight + 60, 'No leaderboard entries yet.', {
          fontFamily: 'Arial',
          fontSize: '16px',
          fontStyle: 'bold',
          color: INK,
        })
        .setOrigin(0.5);
      this.createSignInNote(width);
      return;
    }

    data.forEach((row, i) => this.createRow(width, i, row));
    this.createSignInNote(width);
  }

  createRow(width, rank, row) {
    const rowHeight = 50;
    const y = this.hudHeight + 24 + rank * (rowHeight + 8);
    const margin = 16;

    this.add
      .rectangle(width / 2, y, width - margin * 2, rowHeight, 0xfff3d6, 1)
      .setStrokeStyle(2, 0x6b4a2b, 1);

    const rankColor = rank === 0 ? '#c9860c' : rank === 1 ? '#7a7a7a' : rank === 2 ? '#8a5a1c' : INK;

    this.add
      .text(margin + 14, y, `#${rank + 1}`, {
        fontFamily: 'Arial',
        fontSize: '18px',
        fontStyle: 'bold',
        color: rankColor,
      })
      .setOrigin(0, 0.5);

    this.add
      .text(margin + 58, y, row.display_name || 'Player', {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: INK,
      })
      .setOrigin(0, 0.5);

    this.add
      .text(width - margin - 14, y, `\u{1F48E} ${row.gems ?? 0}`, {
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: INK,
      })
      .setOrigin(1, 0.5);
  }

  createSignInNote(width) {
    if (isSignedIn()) return;
    this.add
      .text(width / 2, this.scale.height - 30, 'Sign in (Settings) to join the leaderboard!', {
        fontFamily: 'Arial',
        fontSize: '13px',
        fontStyle: 'bold',
        color: INK,
      })
      .setOrigin(0.5);
  }

  createHud(width) {
    this.add.rectangle(0, 0, width, this.hudHeight, APP_BG_COLOR, 0.95).setOrigin(0);

    this.add
      .text(width / 2, this.hudHeight / 2, 'Leaderboard', {
        fontFamily: 'Arial',
        fontSize: '22px',
        fontStyle: 'bold',
        color: WOOD_TEXT,
      })
      .setOrigin(0.5);

    // Real icon back button (per chat) replacing the plain "\u2190 Back"
    // text link - same baseScale-relative tap-bounce pattern used in
    // CalendarScene's createHud().
    const backSize = this.hudHeight - 12;
    const backIcon = this.add.image(16 + backSize / 2, this.hudHeight / 2, 'lbBackIcon');
    backIcon.setDisplaySize(backSize, backSize);
    const backBase = backIcon.scale;

    const backHit = this.add
      .circle(backIcon.x, backIcon.y, backSize / 2, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    backHit.on('pointerdown', () => this.tweens.add({ targets: backIcon, scale: backBase * 0.9, duration: 70 }));
    backHit.on('pointerup', () => {
      this.tweens.add({ targets: backIcon, scale: backBase, duration: 100 });
      this.goBack();
    });
  }
}
