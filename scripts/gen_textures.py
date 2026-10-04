"""
Generates the tileable PBR texture sets (albedo / normal / roughness) used by
the site. Everything is made from noise that is filtered in the frequency
domain, which makes it wrap seamlessly on all four edges.

    pip install numpy pillow
    python scripts/gen_textures.py
"""
import numpy as np
from PIL import Image

N = 1024
OUT = "public/assets/"


def fnoise(beta, seed, lo=0.0, hi=1e9):
    """Periodic noise with a 1/f^beta spectrum, band-limited to [lo, hi] cycles per tile. Returns 0..1."""
    rng = np.random.default_rng(seed)
    fx = np.fft.fftfreq(N) * N
    f = np.hypot(*np.meshgrid(fx, fx))
    amp = np.where((f > lo) & (f < hi), 1.0 / np.maximum(f, 1) ** (beta / 2), 0.0)
    spec = amp * np.exp(2j * np.pi * rng.random((N, N)))
    n = np.fft.ifft2(spec).real
    return (n - n.min()) / (n.max() - n.min())


def normal_map(height, strength):
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    n = np.dstack([-dx, dy, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def save(name, arr, quality=88):
    a = (np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(a).save(OUT + name, quality=quality)
    print("wrote", name)


def srgb(*c):
    return np.array(c, dtype=np.float32)


# ------------------------------------------------------------------- sand ---
# One tile = 3 x 3 metres. Wind ripples are baked in: 16 crests per tile (about
# 19 cm apart), bent by low-frequency noise so they wander, fork and merge.
yy, xx = np.mgrid[0:N, 0:N] / N
warp = (fnoise(2.6, 20, hi=5) - 0.5) * 9.0 + (fnoise(2.2, 21, lo=4, hi=14) - 0.5) * 2.2
phase = 2 * np.pi * (16 * yy + 2 * xx) + warp          # integer frequencies keep it tileable
phase = phase + 0.55 * np.sin(phase)                   # asymmetric: long windward slope, short lee slope
ripple = 1 - np.abs(np.sin(phase / 2))                 # sharp crests, round troughs
ripple *= 0.75 + 0.5 * fnoise(2.4, 22, hi=6)           # ripple height varies from place to place
grain = fnoise(0.4, 1, lo=70)                          # individual grains
speck = fnoise(0.0, 3, lo=120)                         # salt-and-pepper mineral grains
h = ripple * 1.0 + grain * 0.10
tone = fnoise(2.6, 4, hi=8)[..., None]
alb = srgb(0.80, 0.50, 0.32) * (0.93 + 0.14 * tone) * (0.95 + 0.1 * grain[..., None])
alb *= (0.9 + 0.14 * ripple)[..., None]                # coarse dark grains collect in the troughs
alb = np.where((speck > 0.83)[..., None], alb * 0.78, alb)
alb = np.where((speck < 0.12)[..., None], alb * 1.14 + 0.02, alb)
save("sand_albedo.jpg", alb)
save("sand_normal.jpg", normal_map(h, 30.0), 92)
save("sand_rough.jpg", 0.84 + 0.14 * grain - 0.22 * (speck < 0.06))

# -------------------------------------------------------------- sandstone ---
broad = fnoise(2.6, 10, hi=12)
mid = fnoise(2.0, 11, lo=4, hi=90)
fine = fnoise(0.8, 12, lo=50)
v = np.linspace(0, 1, N, endpoint=False)[:, None] + (broad - 0.5) * 0.10           # warped height coordinate
strata = 0.5 + 0.5 * np.sin(v * 2 * np.pi * 9) * np.sin(v * 2 * np.pi * 4 + 1.3)   # sedimentary layers (integer freq = tileable)
pits = np.clip((fnoise(0.6, 13, lo=40, hi=130) - 0.72) * 10, 0, 1)                 # small weathering pits
# bedding planes: thin, slightly wavy, broken horizontal lines between layers
bedding = np.clip(1 - np.abs(np.sin(v * 2 * np.pi * 6 + 0.4)) * 45, 0, 1) * np.clip((fnoise(2.2, 15, hi=10) - 0.42) * 6, 0, 1)
h = broad * 0.3 + mid * 0.4 + fine * 0.14 + strata * 0.2 - pits * 0.25 - bedding * 0.5
alb = srgb(0.66, 0.53, 0.40) * (0.84 + 0.28 * broad[..., None])
alb = alb * (1 - 0.22 * strata[..., None]) + srgb(0.12, 0.05, 0.01) * strata[..., None] * 0.55  # redder bands
alb *= (0.88 + 0.24 * mid[..., None]) * (0.94 + 0.12 * fine[..., None])
alb *= 1 - 0.25 * pits[..., None] - 0.5 * bedding[..., None]
save("stone_albedo.jpg", alb)
save("stone_normal.jpg", normal_map(h, 34.0), 92)
save("stone_rough.jpg", 0.86 + 0.1 * fine - 0.12 * strata + 0.1 * pits)
