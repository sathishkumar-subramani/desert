"""
Prepares the Blender sky render for the web.
The raw panorama is physically scaled: the glow around the sun is ~100x
brighter than the rest of the sky. That is correct, but on screen it only
produces a white blob, so the highlights are compressed (the sun's direct
light is added back in three.js as a DirectionalLight).

    pip install numpy opencv-python
    python scripts/prep_sky.py
"""
import cv2
import numpy as np

raw = cv2.imread("_blender/sky_raw.hdr", cv2.IMREAD_ANYDEPTH | cv2.IMREAD_COLOR).astype(np.float32)
img = raw * 0.13                                           # exposure: clear sky lands around 0.2 - 0.7
lum = img @ np.array([0.0722, 0.7152, 0.2126], np.float32)  # BGR order
knee = 0.9
comp = np.where(lum > knee, knee + np.log1p(np.maximum(lum - knee, 0) / 0.8) * 0.8, lum)   # soft shoulder above the knee
img *= (comp / np.maximum(lum, 1e-6))[..., None]
img = cv2.resize(img, (2048, 1024), interpolation=cv2.INTER_AREA)
cv2.imwrite("public/assets/sky_dusk.hdr", img)
print("max", img.max(), "mean", img.mean())
