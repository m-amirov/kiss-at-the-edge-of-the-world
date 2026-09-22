"""Convert the three CEOS-owned black-matted sprite exports to real RGBA.
Preserve interior dark fabric: the subject silhouette is selected once per source,
not by per-pixel alpha from clothing luminance. Requires cv2, numpy, Pillow.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
for name in ('eric', 'nick', 'damir'):
    target=ROOT/'assets'/'characters'/f'{name}-stage.png'
    source=Image.open(target)
    if source.mode=='RGBA' and source.getextrema()[-1][0]==0:
        print(name, 'already transparent; no-op')
        continue
    rgb=np.array(source.convert('RGB'))
    brightness=rgb.max(axis=2)
    fg=np.uint8(brightness>=19)*255
    fg=cv2.morphologyEx(fg,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
    contours,_=cv2.findContours(fg,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    if not contours: raise RuntimeError(f'No foreground silhouette: {target}')
    biggest=max(contours,key=cv2.contourArea)
    if cv2.contourArea(biggest)<rgb.shape[0]*rgb.shape[1]*.04:raise RuntimeError(f'Silhouette too small: {target}')
    silhouette=np.zeros_like(fg)
    cv2.drawContours(silhouette,[biggest],-1,255,thickness=cv2.FILLED)
    # Exclude hard black matting without turning black clothing transparent.
    silhouette=cv2.erode(silhouette,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)),iterations=1)
    alpha=cv2.GaussianBlur(silhouette,(3,3),.6)
    rgba=np.dstack((rgb,alpha))
    Image.fromarray(rgba,'RGBA').save(target,optimize=True)
    print(name, 'rgba', tuple(rgba.shape), 'transparent_pixels',int((alpha==0).sum()))
