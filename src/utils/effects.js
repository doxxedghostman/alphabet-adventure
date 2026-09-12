import Phaser from 'phaser';

// Per chat: idle UI animations (the ones that loop forever to draw the eye
// to shop icons, the daily-reward calendar, the Word Map CTA, etc.) are no
// longer allowed to be bespoke per element (pulse/spin/breathe/float/etc).
// Every idle effect in the game must be one of exactly two kinds - a soft
// "glow" halo, or a diagonal "shine" sweep - picked at random per element
// so the screen doesn't look uniform. Tap/press feedback (the little
// scale-down-then-back bounce on pointerdown/pointerup) is a different
// thing - it's an interaction cue, not a decorative idle animation, and is
// intentionally left alone everywhere it's used.

/**
 * Soft pulsing halo behind/around a spot. Loops forever.
 * @param {Phaser.Scene} scene
 * @param {{x:number,y:number,radius?:number,color?:number}} opts
 * @returns {{type:'glow', tween:Phaser.Tweens.Tween, objects:Phaser.GameObjects.GameObject[]}}
 */
export function applyGlow(scene, { x, y, radius = 24, color = 0xffe38a }) {
  const glow = scene.add.circle(x, y, radius, color, 0.55);
  glow.setBlendMode(Phaser.BlendModes.ADD);

  const tween = scene.tweens.add({
    targets: glow,
    scale: 1.6,
    alpha: 0,
    duration: 900 + Math.random() * 500,
    repeat: -1,
    ease: 'Sine.easeOut',
  });

  scene.events.once('shutdown', () => glow.destroy());

  return { type: 'glow', tween, objects: [glow] };
}

/**
 * Diagonal light streak that sweeps across a rectangular area, masked so
 * it only shows inside that box. Loops forever with a randomized pause
 * between sweeps so multiple shining elements don't sync up.
 * @param {Phaser.Scene} scene
 * @param {{x:number,y:number,width:number,height:number}} opts
 * @returns {{type:'shine', tween:Phaser.Tweens.Tween, objects:Phaser.GameObjects.GameObject[]}}
 */
export function applyShine(scene, { x, y, width, height }) {
  const maskShape = scene.make.graphics({ x: 0, y: 0, add: false });
  maskShape.fillStyle(0xffffff);
  maskShape.fillRect(x - width / 2, y - height / 2, width, height);
  const mask = maskShape.createGeometryMask();

  const streak = scene.add.rectangle(x - width, y, width * 0.28, height * 1.7, 0xffffff, 0.65);
  streak.setAngle(22);
  streak.setBlendMode(Phaser.BlendModes.ADD);
  streak.setMask(mask);

  const tween = scene.tweens.add({
    targets: streak,
    x: x + width,
    duration: 900,
    repeat: -1,
    repeatDelay: 1200 + Math.random() * 1400,
    ease: 'Sine.easeInOut',
  });

  scene.events.once('shutdown', () => {
    streak.destroy();
    maskShape.destroy();
  });

  return { type: 'shine', tween, objects: [streak] };
}

/**
 * Picks glow or shine at random (50/50) and applies it. Pass a radius for
 * a glow-shaped spot, or width+height for a shine-shaped box - both are
 * accepted since the caller doesn't know in advance which one it'll get.
 * @param {Phaser.Scene} scene
 * @param {{x:number,y:number,radius?:number,width?:number,height?:number,color?:number}} opts
 */
export function applyRandomIdleEffect(scene, opts) {
  const useGlow = Math.random() < 0.5;
  if (useGlow) {
    const radius = opts.radius ?? Math.max(opts.width ?? 48, opts.height ?? 48) / 2;
    return applyGlow(scene, { x: opts.x, y: opts.y, radius, color: opts.color });
  }
  const width = opts.width ?? (opts.radius ?? 24) * 2;
  const height = opts.height ?? (opts.radius ?? 24) * 2;
  return applyShine(scene, { x: opts.x, y: opts.y, width, height });
}
