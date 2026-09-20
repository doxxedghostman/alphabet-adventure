#!/usr/bin/env python3
"""Cut a flat magenta background out of AI-generated art (buttons/icons).

Usage:  python3 tools/cutout_magenta.py input.png output.png [--size 256]

Why not a plain color key: the Shuffle button has pink arrows that are
close to magenta, so a global key would eat them. This only removes
key-colored pixels that are CONNECTED TO THE IMAGE BORDER (flood fill),
so anything enclosed by the artwork survives. The 2px edge band is then
"un-mixed" (background color subtracted out) so there is no pink fringe
around the ring when the icon sits on a dark or light background.

Then crops to the artwork, pads 2%, makes it square, and shrinks to
--size with premultiplied alpha (no dark/pink halo from the resize).
Needs: pip install pillow numpy scipy
Ask the image generator for a "solid flat pure magenta (#FF00FF)
background" - do NOT ask for a transparent one (it bakes in a fake
checkerboard).
"""
import argparse
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def cutout(path):
    rgb = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    key = np.median(border, axis=0)
    dist = np.linalg.norm(rgb - key, axis=2)
    lab, _ = ndi.label(dist < 90, structure=np.ones((3, 3)))
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge))
    inside = ~outside
    core = ndi.binary_erosion(inside, iterations=2)
    band = ndi.binary_dilation(inside, iterations=2) & ~core
    _, idx = ndi.distance_transform_edt(~core, return_indices=True)
    nearest = rgb[idx[0], idx[1]]
    d = nearest - key
    a = np.clip(((rgb - key) * d).sum(axis=2) / np.maximum((d * d).sum(axis=2), 1e-3), 0, 1)
    alpha = np.zeros((h, w), np.float32)
    alpha[core] = 1
    alpha[band] = a[band]
    out = rgb.copy()
    fix = band & (alpha > 0.3)
    out[fix] = np.clip((rgb[fix] - (1 - alpha[fix, None]) * key) / alpha[fix, None], 0, 255)
    low = band & (alpha <= 0.3)
    out[low] = nearest[low]
    rgba = np.dstack([out, alpha * 255]).astype(np.uint8)

    ys, xs = np.where(alpha > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    side = max(y1 - y0, x1 - x0) + 1
    half = side // 2 + int(side * 0.02)
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    canvas = np.zeros((half * 2, half * 2, 4), np.uint8)
    sy, sx = cy - half, cx - half
    ys0, xs0 = max(sy, 0), max(sx, 0)
    ys1, xs1 = min(sy + 2 * half, h), min(sx + 2 * half, w)
    canvas[ys0 - sy:ys1 - sy, xs0 - sx:xs1 - sx] = rgba[ys0:ys1, xs0:xs1]
    return Image.fromarray(canvas, 'RGBA'), int(((dist < 60) & inside).sum())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input')
    ap.add_argument('output')
    ap.add_argument('--size', type=int, default=256)
    args = ap.parse_args()
    im, pockets = cutout(args.input)
    arr = np.array(im).astype(np.float32)
    arr[..., :3] *= arr[..., 3:4] / 255  # premultiply before resizing
    small = Image.fromarray(arr.astype(np.uint8), 'RGBA').resize((args.size, args.size), Image.LANCZOS)
    s = np.array(small).astype(np.float32)
    s[..., :3] = np.clip(s[..., :3] * 255 / np.maximum(s[..., 3:4], 1), 0, 255)
    Image.fromarray(s.astype(np.uint8), 'RGBA').save(args.output, optimize=True)
    print(f'saved {args.output} ({args.size}px). key-colored pixels kept inside the art: {pockets}')


if __name__ == '__main__':
    main()
