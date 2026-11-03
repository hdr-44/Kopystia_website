#!/usr/bin/env python3
"""Generate the Kopytsia opening loader (v2, logo line-art style).

Ground line draws out -> loose straw -> the loaf-shaped копиця from the logo builds up in gold strokes
-> a line-art hat drops onto it -> the KOPYTSIA wordmark fades in.

Outputs (next to this script):
  kopytsia-loader.gif        non-looping animation (plays once)
  kopytsia-loader-final.png  static final pose, 2x resolution

Run:  python3 loader/generate.py         (needs Pillow)
Everything you may want to change lives in CONFIG. v1 (warm paper, solid stack) is kept in v1/.
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))

CONFIG = {
    "size": 480,            # GIF is size x size px
    "supersample": 3,       # draw bigger, downscale -> smooth hand-drawn lines
    "fps": 25,
    "seed": 7,              # change for a different (but still deterministic) haystack
    # Palette sampled from the current logo (dark version).
    "background": (19, 20, 21),
    "ink": (211, 194, 154),
    "ink_dim": (150, 139, 112),          # interior layer marks, so the outline reads first
    "line": 1.5,                         # stroke width in final px
    # Wordmark: PLACEHOLDER low-res crop of the logo. Replace with an export from the vector logo
    # (white-on-black or alpha PNG, any size). Set to "" to fall back to wordmark_text.
    "wordmark_image": os.path.join(HERE, "brand", "kopytsia-wordmark.png"),
    "wordmark_width": 0.36,              # fraction of the canvas width
    "wordmark_text": "KOPYTSIA",
    "font": "/System/Library/Fonts/Supplemental/Georgia.ttf",
    # Timeline in seconds.
    "t_ground": (0.00, 0.45),
    "t_build": (0.15, 1.10),
    "t_fall": (1.10, 1.42),
    "t_settle": (1.42, 1.64),
    "t_word": (1.48, 1.80),
    "t_end": 1.90,
}


def lerp(a, b, t):
    return a + (b - a) * t


def clamp01(t):
    return max(0.0, min(1.0, t))


def ease_out(t):
    return 1 - (1 - t) ** 3


def phase(t, span):
    return clamp01((t - span[0]) / (span[1] - span[0]))


def mix(a, b, t):
    return tuple(int(lerp(x, y, t)) for x, y in zip(a, b))


# ---------------------------------------------------------------- geometry (unit = final px)
S = CONFIG["size"]
CX = S / 2
GROUND = S * 0.64
R = S * 0.25       # half-width of the stack
HS = S * 0.25      # stack height
P_SHAPE = 5.0      # superellipse exponent: 2 = dome, higher = the logo's flat-topped loaf


def half_width(h):
    u = clamp01(h / HS)
    return R * (1 - u ** P_SHAPE) ** (1 / P_SHAPE)


def wave(x):
    """Uneven layer edge: the build front is higher in some places than others."""
    return 0.07 * math.sin((x / S) * 17 + 1.3) + 0.04 * math.sin((x / S) * 41)


def contour(n):
    """n points evenly spaced along the stack outline (left foot -> top -> right foot), with tangent angles."""
    raw = []
    for k in range(2001):
        a = math.pi * k / 2000
        c, s = math.cos(a), math.sin(a)
        x = CX - R * math.copysign(abs(c) ** (2 / P_SHAPE), c)
        h = HS * abs(s) ** (2 / P_SHAPE)
        h *= 1 + 0.035 * math.sin(a * 2.3 + 0.4)       # slightly uneven top like the drawing
        raw.append((x, GROUND - h))
    cum = [0.0]
    for p, q in zip(raw, raw[1:]):
        cum.append(cum[-1] + math.dist(p, q))
    out, j = [], 0
    for i in range(n):
        target = cum[-1] * i / (n - 1)
        while j < len(cum) - 2 and cum[j + 1] < target:
            j += 1
        p, q = raw[j], raw[j + 1]
        out.append((p[0], p[1], math.atan2(q[1] - p[1], q[0] - p[0])))
    return out


def strand(x, y, ang, ln, bend, col, order, kind="body"):
    return dict(x=x, y=y, ang=ang, ln=ln, bend=bend, col=col, order=clamp01(order), kind=kind,
                h=GROUND - y, kick=0.0)


def make_strands(rng):
    ink, dim = CONFIG["ink"], CONFIG["ink_dim"]
    out = []
    order = lambda x, y, j=0.03: (GROUND - y) / HS + 0.8 * wave(x) + rng.uniform(-j, j)
    # 1. A few loose strands at the centre from the first frame.
    for i in range(6):
        out.append(strand(CX + rng.uniform(-R * 0.4, R * 0.4), GROUND - rng.uniform(1, 6),
                          rng.uniform(-0.5, 0.5) + (math.pi if i % 2 else 0), rng.uniform(12, 20),
                          rng.uniform(-3, 3), ink, -1, "loose"))
    # 2. Outline: strokes along the contour, two passes so it reads hand-drawn, plus fuzz spikes.
    for pas in range(2):
        for x, y, a in contour(150):
            nx, ny = math.sin(a), -math.cos(a)                    # outward normal
            off = rng.uniform(-1.5, 2.0)
            out.append(strand(x + nx * off, y + ny * off, a + rng.uniform(-0.3, 0.3), rng.uniform(6, 12),
                              rng.uniform(-2, 2), ink, order(x, y)))
    for x, y, a in contour(110):
        nx, ny = math.sin(a), -math.cos(a)
        ln = rng.uniform(3, 8)
        out.append(strand(x + nx * ln * 0.5, y + ny * ln * 0.5, a + math.pi / 2 + rng.uniform(-0.6, 0.6), ln,
                          rng.uniform(-1, 1), ink, order(x, y)))
    # 3. Grassy base band, like the logo's zigzag foot.
    for _ in range(150):
        x = CX + rng.uniform(-R, R) * 0.97
        y = GROUND - rng.uniform(1, HS * 0.13)
        out.append(strand(x, y, -math.pi / 2 + rng.uniform(-0.7, 0.7), rng.uniform(4, 9), rng.uniform(-2, 2),
                          ink, order(x, y)))
    # 4. Interior layer marks: horizontal-ish, denser upper right as in the logo.
    for _ in range(190):
        h = HS * rng.uniform(0.16, 0.9)
        w = half_width(h) * 0.84
        x = CX + w * (rng.uniform(-1, 1) if rng.random() < 0.45 else rng.uniform(0.1, 1))
        y = GROUND - h
        out.append(strand(x, y, rng.uniform(-0.3, 0.3) + (math.pi if rng.random() < 0.5 else 0),
                          rng.uniform(5, 13), rng.uniform(-3, 3), dim, order(x, y)))
    # 5. Strands that settle along the edges and on the ground once the stack is nearly full.
    for i in range(10):
        side = -1 if i % 2 else 1
        if i < 6:
            x, y, a = CX + side * (R + rng.uniform(2, 22)), GROUND - rng.uniform(0, 2), rng.uniform(-0.3, 0.3)
        else:
            h = rng.uniform(HS * 0.2, HS * 0.7)
            x, y, a = CX + side * (half_width(h) + rng.uniform(1, 4)), GROUND - h, side * rng.uniform(1.1, 1.5)
        out.append(strand(x, y, a, rng.uniform(8, 16), rng.uniform(-3, 3), ink, 0.86 + 0.12 * rng.random(), "edge"))
    # Strands under the brim jump on impact.
    for s in out:
        if s["kind"] != "loose" and s["h"] > HS * 0.82 and abs(s["x"] - CX) < S * 0.17:
            s["kick"] = (1 if s["x"] >= CX else -1) * rng.uniform(1.5, 5)
    return out


def strand_pts(s, dx=0.0, dy=0.0):
    c, si = math.cos(s["ang"]), math.sin(s["ang"])
    hx, hy = c * s["ln"] / 2, si * s["ln"] / 2
    x0, y0 = s["x"] - hx + dx, s["y"] - hy + dy
    x2, y2 = s["x"] + hx + dx, s["y"] + hy + dy
    mx, my = s["x"] + dx - si * s["bend"], s["y"] + dy + c * s["bend"]
    return [((1 - t) ** 2 * x0 + 2 * (1 - t) * t * mx + t * t * x2,
             (1 - t) ** 2 * y0 + 2 * (1 - t) * t * my + t * t * y2) for t in (k / 6 for k in range(7))]


# Hat dimensions; the hat rests on the stack's flat top.
BRIM_HALF, CROWN_HALF, CROWN_H = S * 0.165, S * 0.082, S * 0.088
HAT_REST_Y = GROUND - HS * 1.075   # brim sits on the top fuzz, clear of the outline


def hat_polys(rng):
    """Generic flat-brim hat, origin at the brim's centre underside. Swap this function to change the hat."""
    def wobble(pts, amt=0.5):
        return [(x + rng.uniform(-amt, amt), y + rng.uniform(-amt, amt)) for x, y in pts]

    bw, bt = BRIM_HALF, S * 0.019
    brim = [(-bw * math.cos(math.pi * k / 40), -bt * math.sin(math.pi * k / 40) - 1.2 * math.cos(math.pi * k / 40) ** 6)
            for k in range(41)]
    brim += [(bw * math.cos(math.pi * k / 40), bt * 0.5 * math.sin(math.pi * k / 40) - 1.2 * math.cos(math.pi * k / 40) ** 6)
             for k in range(41)]
    crown = [(-CROWN_HALF, -bt * 0.6)]
    for k in range(13):                    # rounded top corners, slight pinch in the flat top
        a = math.pi * k / 12
        crown.append((-CROWN_HALF * 0.84 * math.cos(a),
                      -CROWN_H - S * 0.01 * math.sin(a) + S * 0.006 * math.sin(a) ** 4))
    crown.append((CROWN_HALF, -bt * 0.6))
    band = [(-CROWN_HALF * 0.995, -bt * 0.6), (-CROWN_HALF * 0.975, -bt - S * 0.022),
            (CROWN_HALF * 0.975, -bt - S * 0.022), (CROWN_HALF * 0.995, -bt * 0.6)]
    return wobble(crown), wobble(band, 0.3), wobble(brim, 0.4)


def load_wordmark():
    path = CONFIG["wordmark_image"]
    if path and os.path.exists(path):
        im = Image.open(path)
        return im.getchannel("A") if im.mode in ("RGBA", "LA") else im.convert("L")
    return None


def draw_frame(t, strands, hat, wordmark, out_scale=1):
    ss = CONFIG["supersample"]
    ink, bg = CONFIG["ink"], CONFIG["background"]
    img = Image.new("RGB", (S * ss, S * ss), bg)
    d = ImageDraw.Draw(img)
    P = lambda pts: [(x * ss, y * ss) for x, y in pts]
    lw = max(1, round(CONFIG["line"] * ss))

    build = phase(t, CONFIG["t_build"])
    fall = phase(t, CONFIG["t_fall"])
    settle = phase(t, CONFIG["t_settle"])
    landed = t >= CONFIG["t_fall"][1]

    # Ground line draws outward from the centre.
    gl = lerp(R * 0.35, S * 0.43, ease_out(phase(t, CONFIG["t_ground"])))
    d.line(P([(CX - gl, GROUND), (CX + gl, GROUND)]), fill=ink, width=lw)

    kick = math.sin(settle * math.pi * 0.5) * (1 - 0.6 * settle) if landed else 0.0
    for s in strands:
        if s["kind"] == "loose":
            dy, a = 0.0, 1.0
        else:
            local = clamp01((build - s["order"] * 0.86) / 0.14)   # each strand drops in over ~14% of build
            if local <= 0:
                continue
            a = ease_out(local)
            dy = -(1 - a) * (8 if s["kind"] != "edge" else 16)
        dx = s["kick"] * kick
        d.line(P(strand_pts(s, dx, dy - abs(dx) * 0.4)), fill=mix(bg, s["col"], a), width=lw, joint="curve")

    # Hat: falls with gravity + slight tilt, small squash/bounce on landing, then settles.
    if t >= CONFIG["t_fall"][0]:
        if not landed:
            y = lerp(-S * 0.12, HAT_REST_Y, fall ** 2)
            tilt, sq = lerp(-14, -6, fall), 1.0
        else:
            y = HAT_REST_Y - S * 0.014 * math.sin(settle * math.pi) * (1 - settle)
            tilt = -6 * math.cos(settle * math.pi * 1.5) * (1 - settle) ** 2
            sq = 1 - 0.07 * math.sin(clamp01(settle * 4) * math.pi)
        ca, sa = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))
        tf = lambda pts: P([(CX + x * ca - yy * sq * sa, y + x * sa + yy * sq * ca) for x, yy in pts])
        crown, band, brim = hat
        hw = max(1, round(CONFIG["line"] * 1.2 * ss))
        d.polygon(tf(crown), fill=bg, outline=ink, width=hw)
        d.polygon(tf(band), fill=ink)
        d.polygon(tf(brim), fill=bg, outline=ink, width=hw)

    img = img.resize((S * out_scale, S * out_scale), Image.LANCZOS)

    w = ease_out(phase(t, CONFIG["t_word"]))
    if w > 0:
        cy = (GROUND + S * 0.13) * out_scale
        if wordmark is not None:
            tw = int(S * CONFIG["wordmark_width"] * out_scale)
            m = wordmark.resize((tw, round(wordmark.height * tw / wordmark.width)), Image.LANCZOS)
            m = m.point(lambda v: int(v * w))
            img.paste(Image.new("RGB", m.size, ink), (int(CX * out_scale - m.width / 2), int(cy - m.height / 2)), m)
        else:
            try:
                font = ImageFont.truetype(CONFIG["font"], int(S * 0.056) * out_scale)
            except OSError:
                font = ImageFont.load_default(int(S * 0.056) * out_scale)
            ImageDraw.Draw(img).text((CX * out_scale, cy), " ".join(CONFIG["wordmark_text"]), font=font,
                                     fill=mix(bg, ink, w), anchor="mm")
    return img


def main():
    rng = random.Random(CONFIG["seed"])
    strands = make_strands(rng)
    hat = hat_polys(rng)
    wordmark = load_wordmark()

    fps, end = CONFIG["fps"], CONFIG["t_end"]
    times = [i / fps for i in range(int(end * fps) + 1)]
    frames = [draw_frame(t, strands, hat, wordmark) for t in times]

    # One shared palette (from the final frame, which has every colour) keeps frames diffable and small.
    n_col = 32
    pal = frames[-1].quantize(colors=n_col, method=Image.Quantize.MEDIANCUT)
    # Snap near-background entries to the exact background so the GIF edge is invisible on the page.
    pv = pal.getpalette()[:n_col * 3]
    bg = CONFIG["background"]
    for i in range(n_col):
        if sum((pv[i * 3 + c] - bg[c]) ** 2 for c in range(3)) <= 27:
            pv[i * 3:i * 3 + 3] = bg
    pal.putpalette(pv)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    durations = [int(1000 / fps)] * (len(q) - 1) + [2000]
    gif = os.path.join(HERE, "kopytsia-loader.gif")
    # No `loop` argument -> no NETSCAPE extension -> browsers play it once and stop on the last frame.
    q[0].save(gif, save_all=True, append_images=q[1:], duration=durations, optimize=True, disposal=1)

    big = draw_frame(end, strands, hat, wordmark, out_scale=2)   # static final pose at 2x
    png = os.path.join(HERE, "kopytsia-loader-final.png")
    big.save(png, optimize=True)

    with open(gif, "rb") as f:
        data = f.read()
    assert b"NETSCAPE2.0" not in data, "GIF must not loop"
    assert Image.open(gif).convert("RGB").getpixel((1, 1)) == bg, "GIF background must match the page"
    print(f"{gif}: {len(q)} frames, {len(data) / 1024:.0f} KB, {sum(durations[:-1]) / 1000:.2f}s animated")
    print(f"{png}: {big.size[0]}x{big.size[1]}")


if __name__ == "__main__":
    main()
