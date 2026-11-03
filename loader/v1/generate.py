#!/usr/bin/env python3
"""Generate the Kopytsia opening loader: hay strands -> haystack (копиця) -> hat drop -> hold.

Outputs (next to this script):
  kopytsia-loader.gif        non-looping animation (plays once)
  kopytsia-loader-final.png  static final pose, 2x resolution

Run:  python3 loader/generate.py         (needs Pillow)
Everything you may want to change lives in CONFIG.
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
    # Palette — placeholder until brand identity exists.
    "background": (244, 236, 222),       # warm paper
    "ground_shadow": (228, 216, 194),
    "straw": [(214, 170, 84), (196, 148, 64), (229, 192, 112), (173, 126, 52), (240, 210, 140)],
    "straw_shade": (150, 106, 44),
    "straw_fill": (226, 186, 110),       # solid body under the strands — keeps the silhouette legible small       # strands deep in the stack / at the base
    "hat": (38, 33, 31),
    "hat_band": (92, 70, 52),
    "wordmark_color": (60, 46, 36),
    # Wordmark — placeholder. Set "wordmark" to "" to drop it.
    "wordmark": "Kopytsia",
    "font": "/System/Library/Fonts/Supplemental/Georgia.ttf",  # placeholder font, see README
    # Timeline in seconds.
    "t_build": (0.20, 1.12),
    "t_fall": (1.12, 1.44),
    "t_settle": (1.44, 1.66),
    "t_word": (1.50, 1.82),
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


# ---------------------------------------------------------------- geometry (unit = final px)
S = CONFIG["size"]
CX = S / 2
GROUND = S * 0.70
R = S * 0.25       # base half-width of the stack
HS = S * 0.40      # stack height
TOP = GROUND - HS


def half_width(h):
    """Half-width of the копиця at height h above ground: wide anchored base, rounded shoulder, soft peak."""
    u = clamp01(h / HS)
    return R * (1 - u ** 2.2) ** 0.5


def wave(x):
    """Uneven layer edge: the build front is higher in some places than others."""
    return 0.07 * math.sin((x / S) * 17 + 1.3) + 0.04 * math.sin((x / S) * 41)


# Hat rests where the stack's width matches the crown, like a hat on a head.
_CROWN_HALF = S * 0.105
HAT_REST_Y = GROUND - max(h for h in [HS * k / 400 for k in range(401)] if half_width(h) >= _CROWN_HALF * 0.95)


def make_strands(rng):
    strands = []
    # 1. Loose strands present from the first frame, at screen centre.
    for i in range(7):
        a = rng.uniform(-0.5, 0.5) + (math.pi if i % 2 else 0)
        strands.append(dict(x=CX + rng.uniform(-R * 0.45, R * 0.45), y=GROUND - rng.uniform(2, 10),
                            ang=a, ln=rng.uniform(18, 28), bend=rng.uniform(-4, 4),
                            col=rng.choice(CONFIG["straw"]), t0=-1, kind="loose"))
    # 2. The stack body. Uneven layers: a strand's appear time follows its height plus a wavy offset.
    n = 620
    for _ in range(n):
        h = HS * (1 - math.sqrt(rng.random())) * 0.98   # more strands low down (wider base)
        w = half_width(h)
        x = CX + rng.uniform(-w, w) * 0.97
        rel = (x - CX) / max(w, 1)
        # Strands follow the dome surface: flatter in the middle, steeper on the shoulders.
        slope = -math.atan2(HS * 0.9 * rel, R) if abs(rel) > 0.2 else 0
        ang = slope + rng.uniform(-0.55, 0.55) + (math.pi if rng.random() < 0.5 else 0)
        order = clamp01(h / HS + wave(x) + rng.uniform(-0.03, 0.03))
        depth = abs(rel)
        col = CONFIG["straw_shade"] if (h < HS * 0.12 and rng.random() < 0.5) or (depth < 0.5 and rng.random() < 0.18) \
            else rng.choice(CONFIG["straw"])
        strands.append(dict(x=x, y=GROUND - h, ang=ang, ln=rng.uniform(12, 26) * (1 - 0.35 * h / HS),
                            bend=rng.uniform(-5, 5), col=col, order=order, kind="body", h=h))
    # 3. Strands that settle along the edges / at the foot once the stack is nearly full.
    for i in range(12):
        side = -1 if i % 2 else 1
        h = rng.uniform(0, HS * 0.55)
        x = CX + side * (half_width(h) + rng.uniform(0, 7))
        strands.append(dict(x=x, y=GROUND - h, ang=side * rng.uniform(1.0, 1.5) + rng.uniform(-0.2, 0.2),
                            ln=rng.uniform(16, 26), bend=rng.uniform(-6, 6), col=rng.choice(CONFIG["straw"]),
                            order=0.85 + 0.15 * rng.random(), kind="edge", h=h))
    for i in range(6):  # a couple lying on the ground
        side = -1 if i % 2 else 1
        strands.append(dict(x=CX + side * (R + rng.uniform(-6, 18)), y=GROUND + rng.uniform(-1, 3),
                            ang=rng.uniform(-0.25, 0.25), ln=rng.uniform(14, 22), bend=rng.uniform(-3, 3),
                            col=rng.choice(CONFIG["straw"]), order=0.9 + 0.1 * rng.random(), kind="edge", h=0))
    # Top strands nudged by the hat's impact.
    for s in strands:
        s["kick"] = 0.0
        if s["kind"] == "body" and s["h"] > (GROUND - HAT_REST_Y) - HS * 0.18:
            s["kick"] = (1 if s["x"] >= CX else -1) * rng.uniform(2, 7)
    return strands


def strand_pts(s, dx=0.0, dy=0.0):
    c, si = math.cos(s["ang"]), math.sin(s["ang"])
    hx, hy = c * s["ln"] / 2, si * s["ln"] / 2
    x0, y0 = s["x"] - hx + dx, s["y"] - hy + dy
    x2, y2 = s["x"] + hx + dx, s["y"] + hy + dy
    mx, my = s["x"] + dx - si * s["bend"], s["y"] + dy + c * s["bend"]
    pts = []
    for k in range(7):
        t = k / 6
        pts.append(((1 - t) ** 2 * x0 + 2 * (1 - t) * t * mx + t * t * x2,
                    (1 - t) ** 2 * y0 + 2 * (1 - t) * t * my + t * t * y2))
    return pts


def hat_polys(rng):
    """Generic flat-brim hat, origin at the brim's centre underside. Swap this function to change the hat."""
    def wobble(pts, amt=0.7):
        return [(x + rng.uniform(-amt, amt), y + rng.uniform(-amt, amt)) for x, y in pts]

    bw, bt = S * 0.20, S * 0.016          # brim half-width, thickness
    brim = []
    for k in range(41):                    # thin flat ellipse with a slight upturn at the tips
        a = math.pi * k / 40
        brim.append((-bw * math.cos(a), -bt * math.sin(a) - 1.5 * (math.cos(a) ** 6)))
    for k in range(41):
        a = math.pi * k / 40
        brim.append((bw * math.cos(a), bt * 0.6 * math.sin(a) - 1.5 * (math.cos(a) ** 6)))
    cw_b, cw_t, ch = _CROWN_HALF, S * 0.088, S * 0.105   # crown base/top half-width, height
    crown = [(-cw_b, -bt * 0.6)]
    for k in range(13):                    # rounded top corners, slightly pinched flat top
        a = math.pi * k / 12
        x = -cw_t * math.cos(a)
        y = -ch - S * 0.012 * math.sin(a) + S * 0.006 * math.sin(a) ** 4
        crown.append((x, y))
    crown.append((cw_b, -bt * 0.6))
    band = [(-cw_b * 0.995, -bt * 0.6), (-cw_b * 0.975, -bt - S * 0.026),
            (cw_b * 0.975, -bt - S * 0.026), (cw_b * 0.995, -bt * 0.6)]
    return wobble(crown), wobble(band, 0.4), wobble(brim, 0.5)


def draw_frame(t, strands, hat, font, out_scale=1):
    ss = CONFIG["supersample"]
    img = Image.new("RGB", (S * ss, S * ss), CONFIG["background"])
    d = ImageDraw.Draw(img)
    P = lambda pts: [(x * ss, y * ss) for x, y in pts]

    build = phase(t, CONFIG["t_build"])
    fall = phase(t, CONFIG["t_fall"])
    settle = phase(t, CONFIG["t_settle"])
    landed = t >= CONFIG["t_fall"][1]

    # Ground shadow grows with the stack, anchoring the base.
    gw = R * (0.55 + 0.6 * ease_out(build))
    d.ellipse(P([(CX - gw, GROUND - 4), (CX + gw, GROUND + 7)]), fill=CONFIG["ground_shadow"])

    # Solid body, revealed bottom-up behind the strands along the same uneven front.
    if build > 0:
        front = (build - 0.07) / 0.86
        left, right = [], []
        for k in range(61):
            h = HS * k / 60
            w = half_width(h) * 0.93
            left.append((CX - w, GROUND - h))
            right.append((CX + w, GROUND - h))
        body = [(CX - R * 0.93, GROUND)] + left + right[::-1] + [(CX + R * 0.93, GROUND)]
        mask = Image.new("L", img.size, 0)
        md = ImageDraw.Draw(mask)
        top_edge = [(x, GROUND - HS * clamp01(front - wave(x)) * 1.02) for x in
                    [CX - R + 2 * R * k / 60 for k in range(61)]]
        md.polygon(P([(CX - R, GROUND + 2)] + top_edge + [(CX + R, GROUND + 2)]), fill=255)
        layer = Image.new("RGB", img.size, CONFIG["background"])
        ImageDraw.Draw(layer).polygon(P(body), fill=CONFIG["straw_fill"])
        img.paste(layer, (0, 0), mask)
        d = ImageDraw.Draw(img)

    # Impact shift: top strands jump out, then ease back most of the way.
    kick = 0.0
    if landed:
        k = settle
        kick = math.sin(min(k, 1) * math.pi * 0.5) * (1 - 0.6 * k)

    for s in sorted(strands, key=lambda s: -s["y"] if s["kind"] != "loose" else 1e9):
        if s["kind"] == "loose":
            dy, alpha = 0.0, 1.0
        else:
            local = clamp01((build - s["order"] * 0.86) / 0.14)   # each strand drops in over ~14% of build
            if local <= 0:
                continue
            e = ease_out(local)
            dy = -(1 - e) * (10 if s["kind"] == "body" else 18)
            alpha = e
        dx = s["kick"] * kick
        col = s["col"] if alpha >= 1 else tuple(int(lerp(b, c, alpha)) for b, c in zip(CONFIG["background"], s["col"]))
        d.line(P(strand_pts(s, dx, dy - abs(dx) * 0.4)), fill=col, width=max(1, int(1.7 * ss)), joint="curve")

    # Hat: falls with gravity + slight tilt, small squash/bounce on landing, then settles.
    rest_y = HAT_REST_Y
    if t >= CONFIG["t_fall"][0]:
        if not landed:
            y = lerp(-S * 0.12, rest_y, fall ** 2)
            tilt = lerp(-14, -6, fall)
            sq = 1.0
        else:
            k = settle
            y = rest_y - S * 0.014 * math.sin(k * math.pi) * (1 - k)
            tilt = -6 * math.cos(k * math.pi * 1.5) * (1 - k) ** 2
            sq = 1 - 0.07 * math.sin(clamp01(k * 4) * math.pi)
        ca, sa = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))
        tf = lambda pts: P([(CX + x * ca - y_ * sq * sa, y + x * sa + y_ * sq * ca) for x, y_ in pts])
        crown, band, brim = hat
        d.polygon(tf(crown), fill=CONFIG["hat"])
        d.polygon(tf(band), fill=CONFIG["hat_band"])
        d.polygon(tf(brim), fill=CONFIG["hat"])

    img = img.resize((S * out_scale, S * out_scale), Image.LANCZOS)

    w = phase(t, CONFIG["t_word"])
    if CONFIG["wordmark"] and w > 0:
        d2 = ImageDraw.Draw(img)
        text = " ".join(CONFIG["wordmark"].upper())     # letter-spaced
        col = tuple(int(lerp(b, c, ease_out(w))) for b, c in zip(CONFIG["background"], CONFIG["wordmark_color"]))
        d2.text((CX * out_scale, (GROUND + S * 0.11) * out_scale), text, font=font, fill=col, anchor="mm")
    return img


def load_font(scale):
    try:
        return ImageFont.truetype(CONFIG["font"], int(S * 0.056) * scale)
    except OSError:
        return ImageFont.load_default(int(S * 0.056) * scale)


def main():
    rng = random.Random(CONFIG["seed"])
    strands = make_strands(rng)
    hat = hat_polys(rng)
    font = load_font(1)

    fps, end = CONFIG["fps"], CONFIG["t_end"]
    times = [i / fps for i in range(int(end * fps) + 1)]
    frames = [draw_frame(t, strands, hat, font) for t in times]

    # One shared palette (from the final frame, which has every colour) keeps frames diffable and small.
    pal = frames[-1].quantize(colors=48, method=Image.Quantize.MEDIANCUT)
    # Snap the nearest palette entry to the exact background so the GIF edge is invisible on the page.
    pv = pal.getpalette()[:48 * 3]
    bg = CONFIG["background"]
    for i in range(48):
        if sum((pv[i * 3 + c] - bg[c]) ** 2 for c in range(3)) <= 27:   # near-background shades
            pv[i * 3:i * 3 + 3] = bg
    pal.putpalette(pv)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    durations = [int(1000 / fps)] * (len(q) - 1) + [2000]
    gif = os.path.join(HERE, "kopytsia-loader.gif")
    # No `loop` argument -> no NETSCAPE extension -> browsers play it once and stop on the last frame.
    q[0].save(gif, save_all=True, append_images=q[1:], duration=durations, optimize=True, disposal=1)

    # Static final pose at 2x for crisp display.
    big = draw_frame(end, strands, hat, load_font(2), out_scale=2)
    png = os.path.join(HERE, "kopytsia-loader-final.png")
    big.save(png, optimize=True)

    with open(gif, "rb") as f:
        data = f.read()
    assert b"NETSCAPE2.0" not in data, "GIF must not loop"
    assert len(q) == len(times)
    assert Image.open(gif).convert("RGB").getpixel((1, 1)) == bg, "GIF background must match the page"
    print(f"{gif}: {len(q)} frames, {len(data) / 1024:.0f} KB, {sum(durations[:-1]) / 1000:.2f}s animated")
    print(f"{png}: {big.size[0]}x{big.size[1]}")


if __name__ == "__main__":
    main()
