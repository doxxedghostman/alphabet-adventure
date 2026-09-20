#!/usr/bin/env python3
"""Prepare a world's board background and drop it into public/assets.

Usage:  python3 tools/prep_board_bg.py <input image> <world-slug> [--out DIR]

Slugs: candy-garden jungle-jumble ocean-words dino-valley cloud-kingdom
       crystal-forest magic-mountain space-words ancient-valley
       wordswoop-kingdom
Writes public/assets/<slug>-board-bg.jpg (the name worlds.js already
loads - no code change needed). Converts to RGB, keeps the original
size unless wider than 1080px, saves a progressive JPEG (quality 84,
stepping down if it is over ~320KB). Warns if the picture is not close
to 9:16 portrait. The game "covers" the screen with it and crops the
far left/right, so keep important things away from those edges.
Needs: pip install pillow
"""
import argparse
import os
from PIL import Image

SLUGS = ['candy-garden', 'jungle-jumble', 'ocean-words', 'dino-valley', 'cloud-kingdom',
         'crystal-forest', 'magic-mountain', 'space-words', 'ancient-valley', 'wordswoop-kingdom']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input')
    ap.add_argument('slug', choices=SLUGS)
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'public', 'assets'))
    args = ap.parse_args()

    im = Image.open(args.input).convert('RGB')
    ratio = im.width / im.height
    if not 0.5 <= ratio <= 0.62:
        print(f'WARNING: {im.width}x{im.height} is not close to 9:16 portrait (ratio {ratio:.2f}). '
              'It will still work (cover fit) but more of it gets cropped.')
    if im.width > 1080:
        im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
    out = os.path.join(args.out, f'{args.slug}-board-bg.jpg')
    for q in (84, 80, 76, 72):
        im.save(out, 'JPEG', quality=q, optimize=True, progressive=True)
        kb = os.path.getsize(out) // 1024
        if kb <= 320:
            break
    print(f'saved {out}  {im.width}x{im.height}  q{q}  {kb}KB')


if __name__ == '__main__':
    main()
