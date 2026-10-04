"""
Generates the unique texture for the temple front (albedo + normal).
The facade is 11 m wide and 8 m tall and is mapped 0..1 across this image.
Carvings are drawn as a mask with PIL, then turned into sunk relief:
the mask becomes a height map, the height map becomes a normal map, and the
carved areas are darkened in the albedo. All symbols are invented shapes.

    pip install numpy pillow opencv-python
    python scripts/gen_facade.py
"""
import math
import random
import cv2
import numpy as np
from PIL import Image, ImageDraw

W_M, H_M = 11.0, 8.0
PX = 280                       # pixels per metre
W, H = int(W_M * PX), int(H_M * PX)
OUT = "public/assets/"
rnd = random.Random(7)

mask = Image.new("L", (W, H), 0)          # 255 = carved away
d = ImageDraw.Draw(mask)
LW = 7                                    # stroke width in pixels


def P(x, z):
    """metres (x from the centre line, z up from the ground) -> pixels"""
    return ((x + W_M / 2) * PX, (H_M - z) * PX)


def line(pts, w=LW):
    d.line([P(*p) for p in pts], fill=255, width=w, joint="curve")


def rect(x0, z0, x1, z1, w=LW):
    line([(x0, z0), (x1, z0), (x1, z1), (x0, z1), (x0, z0)], w)


def circle(x, z, r, w=LW, fill=False):
    (a, b), (c, e) = P(x - r, z + r), P(x + r, z - r)
    d.ellipse([a, b, c, e], outline=255, width=w, fill=255 if fill else None)


def arc_pts(x, z, r, a0, a1, n=14, sx=1.0, sz=1.0):
    return [(x + math.cos(a0 + (a1 - a0) * i / n) * r * sx, z + math.sin(a0 + (a1 - a0) * i / n) * r * sz) for i in range(n + 1)]


# ---- a small alphabet of invented signs, each drawn inside a cell of size s ----
def glyph(x, z, s):
    k = rnd.randrange(14)
    r = s * 0.36
    if k == 0: circle(x, z, r * 0.8)
    elif k == 1: circle(x, z, r * 0.85); circle(x, z, r * 0.28, fill=True)
    elif k == 2:
        for i in (-1, 0, 1): line([(x - r, z + i * r * 0.5), (x + r, z + i * r * 0.5)])
    elif k == 3: line([(x - r + i * r * 0.5, z + (r * 0.4 if i % 2 else -r * 0.4)) for i in range(5)])
    elif k == 4: line([(x - r, z - r * 0.8), (x, z + r * 0.8), (x + r, z - r * 0.8), (x - r, z - r * 0.8)])
    elif k == 5: line(arc_pts(x, z - r * 0.4, r, 0, math.pi)); line([(x - r, z - r * 0.4), (x + r, z - r * 0.4)])
    elif k == 6:                                              # almond with a dot
        line(arc_pts(x, z - r * 0.6, r * 1.1, math.pi * 0.2, math.pi * 0.8)); line(arc_pts(x, z + r * 0.6, r * 1.1, -math.pi * 0.8, -math.pi * 0.2))
        circle(x, z, r * 0.2, fill=True)
    elif k == 7:                                              # reed: stem and a leaf
        line([(x, z - r), (x, z + r)]); line(arc_pts(x + r * 0.5, z + r * 0.3, r * 0.6, math.pi * 0.5, math.pi * 1.4))
    elif k == 8:                                              # square spiral
        line([(x - r, z - r), (x + r, z - r), (x + r, z + r), (x - r * 0.6, z + r), (x - r * 0.6, z - r * 0.4), (x + r * 0.4, z - r * 0.4), (x + r * 0.4, z + r * 0.4)])
    elif k == 9: line([(x + math.sin(t * 6.0) * r * 0.5, z - r + t * 2 * r) for t in [i / 12 for i in range(13)]])   # wavy stroke
    elif k == 10:                                             # long-legged bird
        line(arc_pts(x, z, r * 0.6, 0, 2 * math.pi, sx=1.2, sz=0.7)); circle(x + r * 0.75, z + r * 0.6, r * 0.22)
        line([(x + r * 0.95, z + r * 0.6), (x + r * 1.3, z + r * 0.5)]); line([(x - r * 0.1, z - r * 0.4), (x - r * 0.1, z - r)]); line([(x + r * 0.25, z - r * 0.4), (x + r * 0.25, z - r)])
    elif k == 11: rect(x - r * 0.8, z - r * 0.8, x + r * 0.8, z + r * 0.8); line([(x - r * 0.8, z), (x + r * 0.8, z)])
    elif k == 12: line([(x - r, z), (x + r, z)]); line([(x, z - r), (x, z + r)]); circle(x, z, r * 0.45)
    else: line(arc_pts(x, z + r * 0.2, r * 0.7, math.pi, 2 * math.pi)); line([(x - r * 0.7, z + r * 0.2), (x - r * 0.7, z + r)]); line([(x + r * 0.7, z + r * 0.2), (x + r * 0.7, z + r)])


def glyph_column(x, z0, z1, s):
    z = z1 - s / 2
    while z > z0 + s * 0.4:
        glyph(x, z, s); z -= s


def glyph_row(x0, x1, z, s):
    x = x0 + s / 2
    while x < x1 - s * 0.4:
        glyph(x, z, s); x += s


def sun_emblem(x, z, r, rays=11):
    circle(x, z, r, w=LW + 2); circle(x, z, r * 0.62, w=LW)
    for i in range(rays):                                     # rays fan downwards
        a = math.pi * (1.12 + 0.76 * i / (rays - 1))
        line([(x + math.cos(a) * r * 1.25, z + math.sin(a) * r * 1.25), (x + math.cos(a) * r * 3.0, z + math.sin(a) * r * 3.0)], LW - 1)
        circle(x + math.cos(a) * r * 3.12, z + math.sin(a) * r * 3.12, r * 0.1, fill=True)


def winged_disc(x, z, span, r):
    circle(x, z, r, w=LW + 2); circle(x, z, r * 0.5, fill=True)
    for side in (-1, 1):
        for row, (drop, length) in enumerate(((0.0, 1.0), (0.55, 0.9), (1.1, 0.75))):
            n = 16 - row * 3
            for i in range(n):                                # feathers
                t = (i + 1) / n
                fx = x + side * (r * 1.2 + t * span * length)
                top = z + r * 0.55 - drop * r - t * r * 0.25
                line([(fx, top), (fx + side * r * 0.25, top - r * 0.62)], LW - 1)
            line([(x + side * r * 1.1, z + r * 0.6 - drop * r), (x + side * (r * 1.2 + span * length), z + r * 0.3 - drop * r)], LW)


# ---- layout ------------------------------------------------------------------
# door jambs and lintel (the stepped frames around the doorway)
for side in (-1, 1):
    glyph_column(side * 1.55, 0.25, 5.4, 0.42)
    line([(side * 1.25, 0.2), (side * 1.25, 5.45)], LW - 1); line([(side * 1.85, 0.2), (side * 1.85, 5.45)], LW - 1)
    glyph_column(side * 2.25, 0.25, 6.0, 0.36)
glyph_row(-1.85, 1.85, 5.12, 0.4)
rect(-1.9, 4.88, 1.9, 5.36, LW - 1)
winged_disc(0, 7.05, 2.0, 0.36)
# wall panels left and right of the door
for side in (-1, 1):
    xa, xb = (2.85, 5.0) if side == 1 else (-5.0, -2.85)
    for z in (7.75, 6.55): line([(xa - 0.05, z), (xb + 0.05, z)], LW + 2)                 # frieze band
    x = xa + 0.3
    while x < xb - 0.2:                                                                    # tall ovals holding signs
        line(arc_pts(x, 7.15, 0.2, 0, 2 * math.pi, n=28, sz=2.2), LW)
        glyph(x, 7.33, 0.26); glyph(x, 6.97, 0.26)
        x += 0.62
    rect(xa, 1.25, xb, 6.3, LW + 1)                                                        # main panel
    cx = (xa + xb) / 2
    sun_emblem(cx, 5.55, 0.3)
    for i in range(4): glyph_column(xa + 0.3 + i * (xb - xa - 0.6) / 3, 1.45, 4.25, 0.44)
    for i in range(1, 4): line([(xa + 0.3 + (i - 0.5) * (xb - xa - 0.6) / 3, 1.4), (xa + 0.3 + (i - 0.5) * (xb - xa - 0.6) / 3, 4.3)], LW - 2)
    for z in (0.95, 0.75, 0.55):                                                           # dado: water lines
        line([(xa + i * 0.11, z + (0.05 if i % 2 else -0.05)) for i in range(int((xb - xa) / 0.11) + 1)], LW - 1)

m = np.asarray(mask, np.float32) / 255
m = cv2.GaussianBlur(m, (0, 0), 1.6)

# ---- weathering: some carving has been sand-blasted away --------------------
def fnoise(shape, beta, seed, hi=1e9, lo=0.0):
    rng = np.random.default_rng(seed)
    fy = np.fft.fftfreq(shape[0])[:, None] * shape[0]; fx = np.fft.fftfreq(shape[1])[None, :] * shape[1]
    f = np.hypot(fx, fy)
    amp = np.where((f > lo) & (f < hi), 1 / np.maximum(f, 1) ** (beta / 2), 0)
    n = np.fft.ifft2(amp * np.exp(2j * np.pi * rng.random(shape))).real
    return ((n - n.min()) / (n.max() - n.min())).astype(np.float32)

zz = np.linspace(H_M, 0, H, dtype=np.float32)[:, None]                 # height above ground per row
wear = np.clip((fnoise((H, W), 2.4, 1, hi=14) - 0.3) * 5, 0.5, 1)    # patches where the relief survives
wear *= np.clip(0.45 + zz / 2.2, 0.45, 1)                              # blown sand erodes the bottom most
carve = m * wear

# masonry: courses of big blocks with staggered joints
joints = np.zeros((H, W), np.float32)
course = 0.86
for i, z in enumerate(np.arange(course, H_M, course)):
    r = int((H_M - z) * PX); joints[r - 2:r + 2] = 1
    off = (i % 2) * 0.9
    for x in np.arange(off, W_M, 1.8):
        c = int(x * PX); r0 = int((H_M - z - course) * PX)
        joints[max(r0, 0):r, c - 2:c + 2] = 1
joints = cv2.GaussianBlur(joints, (0, 0), 1.2)

# ---- stone base: the tiling sandstone set, resampled to this pixel density ---
def tiled(path, channels):
    t = cv2.imread(OUT + path, cv2.IMREAD_COLOR if channels == 3 else cv2.IMREAD_GRAYSCALE)
    size = int(1.25 * PX)                                             # one tile = 1.25 m
    t = cv2.resize(t, (size, size), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    reps = (H // size + 1, W // size + 1) + ((1,) if channels == 3 else ())
    return np.tile(t, reps)[:H, :W]

alb = tiled("stone_albedo.jpg", 3)[..., ::-1]                         # BGR -> RGB
nrm = tiled("stone_normal.jpg", 3)[..., ::-1] * 2 - 1

# albedo: warm ochre stone, darker in the cuts, streaked from the top, paler where sand scours it
broad = fnoise((H, W), 2.6, 2, hi=10)[..., None]
alb = alb * np.array([1.12, 0.98, 0.78], np.float32) * (0.86 + 0.28 * broad)
streak = cv2.GaussianBlur(fnoise((H, W), 1.6, 3, hi=220, lo=6), (0, 0), sigmaX=1, sigmaY=120)
streak = np.clip((streak - streak.mean()) * 9 + 0.5, 0, 1) * np.clip((zz - 3.5) / 4.5, 0, 1)
alb *= (1 - 0.3 * streak)[..., None]
alb = alb * (1 - np.clip(1 - zz / 1.4, 0, 1) * 0.5)[..., None] + np.array([0.80, 0.56, 0.38], np.float32) * (np.clip(1 - zz / 1.4, 0, 1) * 0.5)[..., None]
# traces of old paint left inside the deepest cuts
band = (np.sin(zz * 2.1) > 0)[..., None]
pigment = np.where(band, np.array([0.30, 0.42, 0.40], np.float32), np.array([0.50, 0.20, 0.13], np.float32))
cut = carve[..., None]
alb = alb * (1 - cut) + (alb * 0.42 * 0.6 + pigment * 0.4 * 0.55) * cut
alb *= (1 - 0.3 * joints)[..., None]

# normal: stone grain + relief + joints
height = -(carve * 1.0 + joints * 0.7)
gx = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3) * 1.6
gy = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3) * 1.6
n = np.dstack([nrm[..., 0] * 0.8 - gx, nrm[..., 1] * 0.8 + gy, np.ones((H, W), np.float32)])
n /= np.linalg.norm(n, axis=2, keepdims=True)

Image.fromarray((np.clip(alb, 0, 1) * 255).astype(np.uint8)).save(OUT + "facade_albedo.jpg", quality=86)
Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(OUT + "facade_normal.jpg", quality=82)
print("wrote facade_albedo.jpg, facade_normal.jpg", (W, H))
