const REWARD_PRESENTATION = {
  gems: { texture: 'rewardPopupGem', label: 'Gems!' },
  bomb: { texture: 'rewardPopupBomb', label: 'Bomb!' },
  shuffle: { texture: 'rewardPopupShuffle', label: 'Shuffle!' },
  life: { texture: 'rewardPopupLife', label: 'Extra Life!' },
};

/**
 * Shows a short, celebratory reward moment over a scene.
 * Resolves true after a tap/automatic dismissal, or false if the scene
 * shuts down first.
 */
export function showRewardPopup(scene, { type, amount, label } = {}) {
  const reward = REWARD_PRESENTATION[type] || REWARD_PRESENTATION.gems;
  const rewardAmount = amount ?? 1;
  const centerX = scene.scale.width / 2;
  const centerY = scene.scale.height / 2;
  const cardWidth = Math.min(330, scene.scale.width - 40);
  const cardHeight = 310;
  const depth = 3000;

  // Only one reward moment should own the screen at a time.
  scene._dismissRewardPopup?.(true);

  const overlay = scene.add
    .rectangle(centerX, centerY, scene.scale.width, scene.scale.height, 0x000000, 0.6)
    .setDepth(depth)
    .setAlpha(0)
    .setInteractive({ useHandCursor: true });

  const card = scene.add.container(centerX, centerY).setDepth(depth + 1).setAlpha(0).setScale(0.85);
  const cardBg = scene.add.graphics();
  cardBg.fillStyle(0x2a1f47, 1);
  cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 22);
  cardBg.lineStyle(2, 0xffffff, 0.15);
  cardBg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 22);

  const title = scene.add
    .text(0, -122, 'REWARD!', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '21px',
      fontStyle: 'bold',
      color: '#ffd93d',
    })
    .setOrigin(0.5);

  const iconWrap = scene.add.container(0, -54);
  const icon = scene.add.image(0, 0, reward.texture);
  icon.setScale(96 / Math.max(icon.width, icon.height));
  iconWrap.add(icon);

  const amountText = scene.add
    .text(0, 34, `+${rewardAmount}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#1b1030',
      strokeThickness: 5,
    })
    .setOrigin(0.5);

  const labelText = scene.add
    .text(0, 88, label || reward.label, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#cfc6e8',
      align: 'center',
      wordWrap: { width: cardWidth - 36 },
    })
    .setOrigin(0.5);

  const hint = scene.add
    .text(0, 132, 'Tap anywhere to continue', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#a79ccf',
    })
    .setOrigin(0.5);

  card.add([cardBg, title, iconWrap, amountText, labelText, hint]);

  const sparkles = [];
  const sparkleColors = [0xffd93d, 0xffffff, 0xe9bc61];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const sparkle = scene.add.graphics();
    const points = [];
    for (let point = 0; point < 8; point += 1) {
      const radius = point % 2 === 0 ? 7 : 2.5;
      const pointAngle = (Math.PI * point) / 4 - Math.PI / 2;
      points.push({ x: Math.cos(pointAngle) * radius, y: Math.sin(pointAngle) * radius });
    }
    sparkle.fillStyle(sparkleColors[i % sparkleColors.length], 1);
    sparkle.fillPoints(points, true);
    sparkle.setPosition(Math.cos(angle) * 48, -54 + Math.sin(angle) * 48).setScale(0).setAlpha(0);
    sparkle._rewardAngle = angle;
    card.add(sparkle);
    sparkles.push(sparkle);
  }

  let closing = false;
  let settled = false;
  let autoDismiss;
  let resolvePopup;
  const completion = new Promise((resolve) => {
    resolvePopup = resolve;
  });

  const cleanup = (completedNormally) => {
    if (settled) return;
    settled = true;
    autoDismiss?.remove(false);
    scene.events.off('shutdown', onShutdown);
    scene.tweens.killTweensOf([overlay, card, iconWrap, ...sparkles]);
    overlay.destroy();
    card.destroy();
    if (scene._dismissRewardPopup === dismiss) scene._dismissRewardPopup = null;
    resolvePopup(completedNormally);
  };

  const dismiss = (immediate = false) => {
    if (settled) return;
    if (immediate) {
      cleanup(false);
      return;
    }
    if (closing) return;
    closing = true;
    autoDismiss?.remove(false);
    overlay.disableInteractive();
    scene.tweens.add({ targets: overlay, alpha: 0, duration: 150 });
    scene.tweens.add({
      targets: card,
      alpha: 0,
      scale: 0.85,
      duration: 150,
      ease: 'Cubic.easeIn',
      onComplete: () => cleanup(true),
    });
  };

  const onShutdown = () => dismiss(true);
  scene._dismissRewardPopup = dismiss;
  scene.events.once('shutdown', onShutdown);
  overlay.on('pointerup', () => dismiss());

  scene.tweens.add({ targets: overlay, alpha: 1, duration: 220 });
  scene.tweens.add({
    targets: card,
    alpha: 1,
    scale: 1,
    duration: 260,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({ targets: iconWrap, scale: 1.15, duration: 150, yoyo: true, ease: 'Sine.easeOut' });
      sparkles.forEach((sparkle, i) => {
        const distance = 92 + (i % 2) * 14;
        scene.tweens.add({
          targets: sparkle,
          x: Math.cos(sparkle._rewardAngle) * distance,
          y: -54 + Math.sin(sparkle._rewardAngle) * distance,
          alpha: { from: 1, to: 0 },
          scale: { from: 0.5, to: 1.15 },
          angle: i % 2 === 0 ? 90 : -90,
          duration: 520,
          ease: 'Cubic.easeOut',
        });
      });
    },
  });

  autoDismiss = scene.time.delayedCall(1800, () => dismiss());
  return completion;
}
