#!/usr/bin/env python3
"""Auto-place the 20 level nodes onto a world's path artwork.

Why this exists: levelPaths.js's 20 (x, y) points per world were
hand-guessed - a sine-wave shape eyeballed against the art, not
measured from it. That's the best anyone can do by eye, but it's why
nodes drift off the actual dirt/stone path in places. This script
instead finds the path IN THE PICTURE (by color) and places 20 points
evenly along its actual centerline, so new art (see chat: replacing
the mirror-tiled 600x1700 backgrounds with real, non-mirrored art)
gets accurately-placed nodes automatically, with no more eyeballing.

HOW IT WORKS
1. You give it the path artwork and a color to look for (a pixel color
   sampled from the middle of the dirt/stone path in an image editor,
   or a rough guess - see --sample-help below).
2. It keeps only pixels close to that color, cleans up small specks,
   and thins the result down to a 1-pixel-wide centerline (a
   "skeleton").
3. It walks that skeleton from one end to the other and drops 20
   points spaced equally along its actual length (not equally in y -
   a switchback bends a lot near the top and gently near the bottom,
   so equal-length spacing looks even to a player; equal-y spacing
   would not).
4. It prints ready-to-paste JS for levelPaths.js, and saves a preview
   picture with the 20 points drawn on the art so you can check them
   before pasting anything in.

If the path has multiple disconnected color patches (a bridge, a gap
where a decoration overlaps it), it keeps only the largest connected
patch - so trace the whole path in one unbroken color-similar stretch
where possible, or run --sample-help first to check.

USAGE
  # 1) find a good color to trace, by clicking around in the preview:
  python3 tools/trace_path_nodes.py art.png --sample-help
  # (or just pick a pixel color yourself in any image viewer)

  # 2) trace it:
  python3 tools/trace_path_nodes.py art.png \\
      --color 214,178,122 --tolerance 40 \\
      --world-const CANDY_GARDEN_PATH --out /tmp/candy-garden-preview.png

  # 3) look at /tmp/candy-garden-preview.png - dots should sit ON the
  #    path, evenly spaced, dot 1 at the bottom (Start), dot 20 at the
  #    top. If a dot or two looks off (art has a gap/overlap there),
  #    nudge --tolerance or fix it by hand afterward - it's a normal
  #    starting point, not required to be pixel-perfect.

  # 4) paste the printed JS into src/data/levelPaths.js, replacing that
  #    world's array. Coordinates are already in the image's own pixel
  #    space (matches how worlds.js's pathSpace / LevelPathScene.js
  #    already scale nodes - see that file's header comment).

Needs: pip install pillow numpy scipy
"""
import argparse
import json
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi


def skeletonize(mask):
    """Zhang-Suen thinning: shrinks a blob down to a 1px-wide centerline."""
    img = mask.astype(np.uint8)

    def neighbours(y, x, im):
        return [im[y - 1, x], im[y - 1, x + 1], im[y, x + 1], im[y + 1, x + 1],
                im[y + 1, x], im[y + 1, x - 1], im[y, x - 1], im[y - 1, x - 1]]

    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            marked = []
            ys, xs = np.nonzero(img)
            for y, x in zip(ys, xs):
                if y == 0 or x == 0 or y == img.shape[0] - 1 or x == img.shape[1] - 1:
                    continue
                p = neighbours(y, x, img)
                c = sum((p[i] == 0 and p[(i + 1) % 8] == 1) for i in range(8))
                n = sum(p)
                if not (2 <= n <= 6 and c == 1):
                    continue
                if step == 0:
                    if p[0] * p[2] * p[4] != 0 or p[2] * p[4] * p[6] != 0:
                        continue
                else:
                    if p[0] * p[2] * p[6] != 0 or p[0] * p[4] * p[6] != 0:
                        continue
                marked.append((y, x))
            if marked:
                changed = True
                for y, x in marked:
                    img[y, x] = 0
    return img.astype(bool)


def order_skeleton_points(mask):
    """Walks the 1px skeleton end-to-end, returns points in path order."""
    ys, xs = np.nonzero(mask)
    pts = list(zip(ys.tolist(), xs.tolist()))
    if len(pts) < 2:
        raise SystemExit('Traced path has too few pixels - check --color/--tolerance.')
    pset = set(pts)

    def deg(p):
        y, x = p
        return sum((y + dy, x + dx) in pset for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy, dx) != (0, 0))

    ends = [p for p in pts if deg(p) == 1]
    start = ends[0] if ends else pts[0]

    ordered = [start]
    visited = {start}
    current = start
    while True:
        y, x = current
        nxt = None
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                cand = (y + dy, x + dx)
                if cand in pset and cand not in visited:
                    nxt = cand
                    break
            if nxt:
                break
        if not nxt:
            break
        ordered.append(nxt)
        visited.add(nxt)
        current = nxt

    if len(ordered) < 0.6 * len(pts):
        print(f'WARNING: only walked {len(ordered)}/{len(pts)} skeleton pixels - '
              'the traced path may have a branch or gap (a decoration crossing it, '
              'or two separate patches). Check the preview image carefully.', file=sys.stderr)
    return ordered


def resample_by_arc_length(points_yx, n):
    """n points evenly spaced along the walked path's actual length."""
    pts = np.array(points_yx, dtype=float)
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    total = cum[-1]
    targets = np.linspace(0, total, n)
    out = []
    j = 0
    for t in targets:
        while j < len(cum) - 2 and cum[j + 1] < t:
            j += 1
        span = cum[j + 1] - cum[j]
        frac = 0 if span == 0 else (t - cum[j]) / span
        y = pts[j, 0] + frac * (pts[j + 1, 0] - pts[j, 0])
        x = pts[j, 1] + frac * (pts[j + 1, 1] - pts[j, 1])
        out.append((x, y))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('image')
    ap.add_argument('--color', help='R,G,B of the path (sample it from the picture)')
    ap.add_argument('--tolerance', type=int, default=40, help='color match distance, default 40')
    ap.add_argument('--nodes', type=int, default=20)
    ap.add_argument('--start-at', choices=['top', 'bottom'], default='bottom',
                     help='which end is node 1 / Start (default: bottom, per PLAN.md)')
    ap.add_argument('--world-const', default='WORLD_PATH', help='JS const name for the printed array')
    ap.add_argument('--out', default='/tmp/path_preview.png', help='preview image with numbered dots')
    ap.add_argument('--sample-help', action='store_true',
                     help='instead of tracing, save a picture with a coordinate grid so you can pick a --color by eye')
    args = ap.parse_args()

    im = Image.open(args.image).convert('RGB')
    arr = np.array(im)

    if args.sample_help:
        grid = im.copy()
        d = ImageDraw.Draw(grid)
        step = max(20, im.width // 15)
        for gx in range(0, im.width, step):
            d.line([(gx, 0), (gx, im.height)], fill=(255, 0, 255), width=1)
        for gy in range(0, im.height, step):
            d.line([(0, gy), (im.width, gy)], fill=(255, 0, 255), width=1)
        grid.save(args.out)
        print(f'Grid overlay saved to {args.out}. Open it, find a spot in the middle of the '
              'path, and read the RGB color there in any image editor / color picker. '
              'Then re-run with --color R,G,B')
        return

    if not args.color:
        raise SystemExit('--color R,G,B is required (or run --sample-help first)')
    key = np.array([int(v) for v in args.color.split(',')])
    dist = np.linalg.norm(arr.astype(np.float32) - key, axis=2)
    mask = dist < args.tolerance

    mask = ndi.binary_closing(mask, structure=np.ones((7, 7)))
    mask = ndi.binary_opening(mask, structure=np.ones((3, 3)))
    lab, n = ndi.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        raise SystemExit('No pixels matched that color/tolerance. Try --sample-help, '
                          'a different --color, or a higher --tolerance.')
    sizes = ndi.sum(mask, lab, range(1, n + 1))
    biggest = 1 + int(np.argmax(sizes))
    mask = lab == biggest
    kept_frac = mask.sum() / (dist < args.tolerance).sum()
    if kept_frac < 0.9:
        print(f'NOTE: kept the largest connected patch ({kept_frac:.0%} of all matching pixels) - '
              'the rest were separate islands (gaps/overlaps in the art). Check the preview.', file=sys.stderr)

    skel = skeletonize(mask)
    ordered = order_skeleton_points(skel)  # list of (y, x)
    if args.start_at == 'bottom':
        ordered.sort(key=lambda p: 0)  # no-op; orientation fixed below by comparing ends
    if ordered[0][0] < ordered[-1][0]:
        # first point is higher up (smaller y) than the last; flip if bottom should be first
        if args.start_at == 'bottom':
            ordered = ordered[::-1]
    else:
        if args.start_at == 'top':
            ordered = ordered[::-1]

    points_xy = resample_by_arc_length(ordered, args.nodes)

    preview = im.copy()
    d = ImageDraw.Draw(preview)
    ys, xs = np.nonzero(mask)
    overlay = np.array(preview)
    overlay[ys, xs] = (overlay[ys, xs] * 0.4 + np.array([255, 0, 255]) * 0.6).astype(np.uint8)
    preview = Image.fromarray(overlay)
    d = ImageDraw.Draw(preview)
    for i, (x, y) in enumerate(points_xy):
        r = 14
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 220, 0), outline=(0, 0, 0), width=2)
        d.text((x - (7 if i + 1 < 10 else 11), y - 8), str(i + 1), fill=(0, 0, 0))
    preview.save(args.out)

    lines = [f'const {args.world_const} = [']
    for i, (x, y) in enumerate(points_xy):
        tag = '// 1: Start, bottom of the path' if i == 0 else (
            f'// {i + 1}: boss' if i + 1 == args.nodes else '')
        comma_pad = f'  {{ x: {round(x)}, y: {round(y)} }}, {tag}'.rstrip()
        lines.append(comma_pad)
    lines.append('];')
    print('\n'.join(lines))
    print(f'\nPreview with numbered dots saved to {args.out} - check it before pasting the above.', file=sys.stderr)


if __name__ == '__main__':
    main()
