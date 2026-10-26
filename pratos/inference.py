import io, json
import numpy as np
from PIL import Image, ImageOps

def estimate(raw, model):
    image = Image.open(io.BytesIO(raw)).convert('RGB')
    image = ImageOps.fit(image, (96, 96))
    pixels = np.asarray(image, dtype=np.float32) / 255.
    hist = np.concatenate([
        np.histogram(pixels[:, :, c], bins=16, range=(0, 1), density=False)[0]
        for c in range(3)
    ]).astype(np.float32)
    hist /= pixels.shape[0] * pixels.shape[1]
    brightness = pixels.mean(axis=2)
    extra = [*pixels.mean(axis=(0, 1)), *pixels.std(axis=(0, 1)),
             brightness.mean(), brightness.std()]
    features = np.concatenate([hist, np.asarray(extra, dtype=np.float32)])
    return float(((features - model['mean']) / model['scale']) @ model['coef'] + model['intercept'])
