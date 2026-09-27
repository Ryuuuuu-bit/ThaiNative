from PIL import Image, ImageDraw
# สร้างไอคอนเกม (favicon) แบบพิกเซล: ปรางค์ทองบนพื้นรักแดง → client/assets/ui/icon-*.png
N=32
im=Image.new('RGBA',(N,N),(0,0,0,0)); px=im.load()
def P(x,y,c):
    if 0<=x<N and 0<=y<N: px[x,y]=c
BG1=(122,30,24,255); BG2=(70,14,12,255); GOLD=(232,190,80,255); GOLDL=(255,232,150,255); GOLDD=(168,112,30,255); DARK=(40,8,10,255)
# rounded square bg with vertical gradient
for y in range(N):
    t=y/(N-1); c=tuple(int(BG1[i]*(1-t)+BG2[i]*t) for i in range(3))+(255,)
    for x in range(N):
        r=5; dx=max(r-x, x-(N-1-r), 0); dy=max(r-y, y-(N-1-r), 0)
        if dx*dx+dy*dy <= r*r+1: P(x,y,c)
# border
for y in range(N):
    for x in range(N):
        if px[x,y][3]==0: continue
        edge=any(not(0<=x+a<N and 0<=y+b<N) or px[x+a,y+b][3]==0 for a,b in((1,0),(-1,0),(0,1),(0,-1)))
        if edge: P(x,y,GOLDD)
# inner border
for y in range(1,N-1):
    for x in range(1,N-1):
        if px[x,y]==GOLDD: continue
        if any(px[x+a,y+b]==GOLDD for a,b in((1,0),(-1,0),(0,1),(0,-1))): P(x,y,GOLD)
# moon glow (pale disc behind tower)
import math
for y in range(N):
    for x in range(N):
        d=math.hypot(x-15.5,y-12)
        if d<9.5 and px[x,y] not in (GOLD,GOLDD):
            k=max(0,1-d/9.5)*0.55
            c=px[x,y]; P(x,y,tuple(int(c[i]*(1-k)+(255,140,70)[i]*k) for i in range(3))+(255,))
# prang: rows (y, halfwidth) centered between cols 15/16
rows=[(3,1),(4,1),(5,1),(6,2),(7,1),(8,2),(9,2),(10,3),(11,3),(12,2),(13,4),(14,4),(15,3),(16,5),(17,5),(18,5),(19,6),(20,6),(21,8),(22,8),(23,10),(24,10),(25,11)]
sep={7,12,15,21,23}
for y,h in rows:
    for x in range(16-h,16+h):
        left = x<16
        c = GOLDL if left else GOLD
        if y in sep: c=GOLDD
        if x==16-h: c=GOLDL
        if x==16+h-1: c=GOLDD
        P(x,y,c)
# door / arch
for y in range(17,21):
    for x in (15,16): P(x,y,DARK)
P(15,16,GOLDD); P(16,16,GOLDD)
# side small prangs
for cx in (8,23):
    for y,h in [(17,0),(18,1),(19,1),(20,1),(21,2),(22,2)]:
        for x in range(cx-h, cx+h+1): P(x,y,GOLD if x<=cx else GOLDD)
# ground line
for x in range(4,28): P(x,26,GOLDD)
# spire tip sparkle
P(15,2,GOLDL); P(16,2,GOLDL)
im.save('icon32.png')
for s in (16,48,180,192,512):
    im.resize((s,s),Image.NEAREST if s%32==0 or s>32 else Image.LANCZOS).save(f'icon{s}.png')
big=im.resize((320,320),Image.NEAREST); big.save('preview.png')
