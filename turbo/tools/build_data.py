#!/usr/bin/env python3
"""OpenStreetMap verisini (Overpass JSON) oyunun okuyacağı 3D veriye çevirir.

Girdi:  data/osm_sahil.json (rota boyunca ayrıntılı), data/osm_genis.json (geniş sahil, simgeler, karşı kıyı)
Çıktı:  data/istanbul.json

Koordinatlar yerel metre: x doğu, z güney (kuzey = -z), y yukarı. Başlangıç noktası 41.025 K, 28.995 D.
Harita verisi © OpenStreetMap katkıcıları, ODbL.
"""
import json, math, heapq, hashlib, sys
from collections import defaultdict
import numpy as np
import shapely
import shapely.prepared
from shapely.geometry import LineString, Polygon, MultiPolygon, Point, box, MultiLineString
from shapely.ops import unary_union, linemerge, polygonize
import mapbox_earcut as earcut

LAT0, LON0 = 41.025, 28.995
KX = math.cos(math.radians(LAT0)) * 111320.0
KY = 110540.0


def P(lat, lon):
    return ((lon - LON0) * KX, (LAT0 - lat) * KY)


def h01(s):
    """kimlikten tekrarlanabilir 0..1 sayı"""
    return int(hashlib.md5(str(s).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def num(v):
    if v is None:
        return None
    try:
        return float(str(v).replace(',', '.').replace('m', '').strip().split(';')[0])
    except ValueError:
        return None


def r1(v):
    return round(v, 1)


# ---------------------------------------------------------------- girdi
els = {}
for f in ['data/osm_sahil.json', 'data/osm_genis.json']:
    for e in json.load(open(f))['elements']:
        els[(e['type'], e['id'])] = e


def geom_of(e):
    if e['type'] == 'way':
        g = e.get('geometry')
        return [P(p['lat'], p['lon']) for p in g] if g else None
    if e['type'] == 'relation':
        outers = [m for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
        if not outers:
            return None
        lines = [LineString([P(p['lat'], p['lon']) for p in m['geometry']]) for m in outers if len(m['geometry']) > 1]
        merged = linemerge(lines)
        polys = list(polygonize(merged))
        if not polys:
            return None
        big = max(polys, key=lambda p: p.area)
        return list(big.exterior.coords)
    return None


def poly_of(coords):
    if not coords or len(coords) < 4:
        return None
    p = Polygon(coords)
    if not p.is_valid:
        p = p.buffer(0)
    if p.is_empty:
        return None
    if isinstance(p, MultiPolygon):
        p = max(p.geoms, key=lambda q: q.area)
    return p


# Bölgeler: ayrıntılı bölge (rota çevresi) ve dünya kutusu
ROUTE_LL = [(41.0030, 28.9800), (41.0062, 28.9875), (41.0110, 28.9895), (41.0160, 28.9860), (41.0155, 28.9800), (41.0170, 28.9735),
            (41.0200, 28.9733), (41.0228, 28.9742), (41.0240, 28.9785), (41.0270, 28.9830), (41.0310, 28.9890), (41.0352, 28.9935),
            (41.0388, 28.9990), (41.0420, 29.0065), (41.0445, 29.0150), (41.0470, 29.0250), (41.0468, 29.0310)]
route_hint = LineString([P(a, b) for a, b in ROUTE_LL])
DETAIL = route_hint.buffer(430)
x0, z0 = P(41.075, 28.925)
x1, z1 = P(40.985, 29.085)
WORLD = box(x0, z0, x1, z1)

# ---------------------------------------------------------------- kara ve deniz
coast = []
for e in els.values():
    if e.get('tags', {}).get('natural') == 'coastline' and e['type'] == 'way':
        g = geom_of(e)
        if g and len(g) > 1:
            coast.append(LineString(g))
coast_m = linemerge(unary_union(coast))
coast_clip = coast_m.intersection(WORLD)
faces = list(polygonize(unary_union([coast_clip, WORLD.boundary])))


def is_land(face):
    p = face.representative_point()
    best, bd = None, 1e18
    for ln in (coast_m.geoms if hasattr(coast_m, 'geoms') else [coast_m]):
        d = ln.distance(p)
        if d < bd:
            bd, best = d, ln
    s = best.project(p)
    a = best.interpolate(max(0, s - 1.0))
    b = best.interpolate(min(best.length, s + 1.0))
    q = best.interpolate(s)
    cross = (b.x - a.x) * (p.y - q.y) - (b.y - a.y) * (p.x - q.x)
    # OSM: kara sahil çizgisinin solunda. z güneye baktığı için "sol" burada çapraz çarpımın negatif tarafıdır
    return cross < 0


land_faces = [f for f in faces if is_land(f)]
LAND = unary_union(land_faces).buffer(0)
print('kara parçası', len(land_faces), 'alan km2', round(LAND.area / 1e6, 2), file=sys.stderr)

# ---------------------------------------------------------------- yollar
HW_W = {  # şerit sayısı belirtilmemişse toplam genişlik (m)
    'motorway': 22, 'trunk': 18, 'primary': 13, 'secondary': 10, 'tertiary': 8, 'unclassified': 6.5, 'residential': 6,
    'service': 4, 'living_street': 5, 'pedestrian': 5, 'motorway_link': 7, 'trunk_link': 7, 'primary_link': 7,
    'secondary_link': 6, 'tertiary_link': 6,
}
roads = []
for e in els.values():
    t = e.get('tags', {})
    hw = t.get('highway')
    if e['type'] != 'way' or hw not in HW_W or t.get('area') == 'yes':
        continue
    g = geom_of(e)
    if not g or len(g) < 2:
        continue
    oneway = t.get('oneway') in ('yes', '1', 'true') or t.get('junction') == 'roundabout' or hw in ('motorway',)
    if t.get('oneway') == '-1':
        g = g[::-1]
        oneway = True
    lanes = num(t.get('lanes'))
    w = HW_W[hw]
    if lanes:
        w = max(4.0, lanes * 3.3 + (0 if oneway else 0.6))
    elevated = t.get('bridge') == 'yes' and hw in ('motorway', 'trunk') and ('Çevre' in t.get('name', '') or float(t.get('layer', 0) or 0) >= 2)
    roads.append({'id': e['id'], 'hw': hw, 'w': w, 'oneway': oneway, 'name': t.get('name', ''), 'g': g, 'nodes': e.get('nodes'),
                  'bridge': t.get('bridge') == 'yes', 'elevated': elevated, 'lanes': int(lanes) if lanes else 0, 'tunnel': t.get('tunnel') == 'yes'})

ground_roads = [r for r in roads if not r['elevated'] and not r['tunnel']]
road_polys = []
walk_polys = []
for r in ground_roads:
    ls = LineString(r['g'])
    road_polys.append(ls.buffer(r['w'] / 2, cap_style='round', join_style='round', quad_segs=4))
    if r['hw'] not in ('motorway', 'motorway_link', 'service', 'pedestrian') and not r['bridge']:
        walk_polys.append(ls.buffer(r['w'] / 2 + 3.2, cap_style='flat', join_style='round', quad_segs=3))
ASPHALT = unary_union(road_polys).buffer(0)
WALK = unary_union(walk_polys).buffer(0).difference(ASPHALT)
# yol ve kaldırım ayrıntılı bölgede tutulur (uzaktaki yollar gereksiz)
DETAIL_ROADS = DETAIL.buffer(250)
ASPHALT = ASPHALT.intersection(DETAIL_ROADS).simplify(0.25)
WALK = WALK.intersection(DETAIL_ROADS).intersection(LAND.buffer(2)).simplify(0.25)
print('asfalt km2', round(ASPHALT.area / 1e6, 3), 'kaldırım km2', round(WALK.area / 1e6, 3), file=sys.stderr)

# ---------------------------------------------------------------- yarış rotası (Dijkstra, ana yollar)
COST = {'motorway': 1.0, 'trunk': 1.0, 'primary': 1.0, 'secondary': 1.25, 'tertiary': 2.2, 'trunk_link': 1.6, 'primary_link': 1.6,
        'secondary_link': 2, 'tertiary_link': 3}
adj = defaultdict(list)
npos = {}
nname = {}
for r in roads:
    if r['hw'] not in COST or r['elevated'] or not r['nodes']:
        continue
    nodes, g = r['nodes'], r['g']
    for i in range(len(nodes) - 1):
        a, b = nodes[i], nodes[i + 1]
        npos[a], npos[b] = g[i], g[i + 1]
        nname[a] = nname[b] = r['name']
        L = math.dist(g[i], g[i + 1]) * COST[r['hw']]
        adj[a].append((b, L, r['id']))
        if not r['oneway']:
            adj[b].append((a, L, r['id']))


def nearest_node(lat, lon):
    x, z = P(lat, lon)
    return min(npos, key=lambda n: (npos[n][0] - x) ** 2 + (npos[n][1] - z) ** 2)


def dijkstra(s, t):
    dist, prev = {s: 0}, {}
    pq = [(0, s)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == t:
            break
        if d > dist.get(u, 1e18):
            continue
        for v, L, _ in adj[u]:
            nd = d + L
            if nd < dist.get(v, 1e18):
                dist[v], prev[v] = nd, u
                heapq.heappush(pq, (nd, v))
    if t not in dist:
        return None
    path = [t]
    while path[-1] != s:
        path.append(prev[path[-1]])
    return path[::-1]


def near_nodes(lat, lon, r):
    x, z = P(lat, lon)
    return [n for n in npos if (npos[n][0] - x) ** 2 + (npos[n][1] - z) ** 2 < r * r]


def path_cost(pth):
    return sum(math.dist(npos[pth[i]], npos[pth[i + 1]]) for i in range(len(pth) - 1))


# Kennedy Caddesi (Cankurtaran) → Muallim Naci Cd. (Ortaköy). Çift yönlü yollarda doğru şeridi bulmak için
# başlangıç ve bitişe yakın düğümlerin hepsi denenir, en kısa yol seçilir.
best = None
for s0 in [n for n in near_nodes(41.0030, 28.9785, 160) if 'Kennedy' in nname.get(n, '')]:
    for e0 in sorted(near_nodes(41.04655, 29.02330, 140), key=lambda n: math.dist(npos[n], P(41.04655, 29.02330)))[:4]:
        pth = dijkstra(s0, e0)
        if pth and (best is None or path_cost(pth) < path_cost(best)):
            best = pth
path = best
assert path, 'rota bulunamadı'
route = [npos[n] for n in path]
road_by_id = {r['id']: r for r in roads}
edge_road = []
for i in range(len(path) - 1):
    rid = next((rid for v, L, rid in adj[path[i]] if v == path[i + 1]), None)
    edge_road.append(road_by_id.get(rid))
edge_road.append(edge_road[-1])
# çok yakın noktaları ayıkla
clean = [route[0]]
clean_r = [edge_road[0]]
for p, er in zip(route[1:], edge_road[1:]):
    if math.dist(p, clean[-1]) > 2.0:
        clean.append(p)
        clean_r.append(er)
route = clean
route_len = sum(math.dist(route[i], route[i + 1]) for i in range(len(route) - 1))
print('rota', len(route), 'nokta', round(route_len), 'm', file=sys.stderr)

# rotanın her noktasında yol genişliği (en yakın yol)
road_lines = [(LineString(r['g']), r) for r in ground_roads if r['hw'] in COST]
route_w = [round(er['w'], 1) for er in clean_r]
route_ow = [1 if er['oneway'] else 0 for er in clean_r]
route_names = [er['name'] for er in clean_r]
print('rota yolları', [n for i, n in enumerate(route_names) if i == 0 or n != route_names[i - 1]], file=sys.stderr)

# kontrol noktaları: yol boyunca semt adları
CP_NAMES = [('SARAYBURNU', 41.0150, 28.9877), ('SİRKECİ', 41.0152, 28.9790), ('EMİNÖNÜ', 41.0172, 28.9733), ('GALATA KÖPRÜSÜ', 41.0205, 28.9733),
            ('KARAKÖY', 41.0236, 28.9765), ('TOPHANE', 41.0272, 28.9832), ('KABATAŞ', 41.0347, 28.9930), ('DOLMABAHÇE', 41.0388, 28.9990),
            ('BEŞİKTAŞ', 41.0418, 29.0063), ('ÇIRAĞAN', 41.0441, 29.0155), ('ORTAKÖY', 41.0466, 29.0233)]
cum = [0.0]
for i in range(len(route) - 1):
    cum.append(cum[-1] + math.dist(route[i], route[i + 1]))
checkpoints = []
for nm, la, lo in CP_NAMES:
    x, z = P(la, lo)
    i = min(range(len(route)), key=lambda k: (route[k][0] - x) ** 2 + (route[k][1] - z) ** 2)
    if math.dist(route[i], (x, z)) < 220:
        checkpoints.append({'name': nm, 'i': i, 's': round(cum[i])})
checkpoints.sort(key=lambda c: c['s'])
print('kontrol noktaları', [c['name'] for c in checkpoints], file=sys.stderr)

# ---------------------------------------------------------------- binalar ve parçalar
LANDMARK_NAMES = {}
parts = []
blds = []
for e in els.values():
    t = e.get('tags', {})
    if 'building:part' in t:
        p = poly_of(geom_of(e))
        if p is None or p.area < 1:
            continue
        h = num(t.get('height'))
        mh = num(t.get('min_height')) or 0
        lv = num(t.get('building:levels'))
        if h is None and lv:
            h = lv * 3.2
        if h is None:
            continue
        parts.append({'p': p, 'h': h, 'mh': mh, 'roof': t.get('roof:shape', ''), 'rh': num(t.get('roof:height')), 'id': e['id']})
        continue
    b = t.get('building')
    if not b or b in ('construction', 'ruins', 'no'):
        continue
    p = poly_of(geom_of(e))
    if p is None or p.area < 8:
        continue
    blds.append({'p': p, 't': t, 'id': e['id'], 'type': e['type']})

# parçaları olan binaların gövdesi çizilmez (parçalar yerine geçer)
part_union = unary_union([q['p'] for q in parts]) if parts else None
part_idx = shapely.STRtree([q['p'] for q in parts]) if parts else None

# Özel modelle çizilen simgeler (kendi şekilleri olan, OSM gövdesi kaldırılır)
SPECIAL = [
    {'k': 'galata', 'name': 'Galata Kulesi', 'll': (41.02563, 28.97421)},
    {'k': 'kizkulesi', 'name': 'Kız Kulesi', 'll': (41.02108, 29.00411)},
    {'k': 'saatkulesi', 'name': 'Dolmabahçe Saat Kulesi', 'll': (41.03766, 28.99634)},
]
# Kubbe ve minare parametreleri (gerçek ölçülere yakın): minare sayısı, kubbe çapı, kubbe tepe yüksekliği, minare yüksekliği
MOSQUES = {
    'Süleymaniye Camii': (4, 27, 53, 72), 'Yeni Camii': (2, 17, 36, 63), 'Rüstem Paşa Camii': (1, 15, 26, 40),
    'Nusretiye Camii': (2, 13, 30, 50), 'Kılıç Ali Paşa Camii': (1, 12.7, 26, 40), 'Büyük Mecidiye Camii': (2, 11, 28, 40),
    'Sinan Paşa Camisi': (1, 13, 25, 38), 'Büyük Selimiye Camii': (2, 16, 32, 50), 'Mihrimah Sultan Camii': (2, 13, 28, 45),
    'Sinan Paşa Camii': (1, 12, 22, 35), 'Küçük Ayasofya Camii': (1, 13, 20, 30), 'Molla Çelebi Camii': (1, 10, 20, 32),
}
specials_out = []
special_polys = []
for s in SPECIAL:
    x, z = P(*s['ll'])
    specials_out.append({'k': s['k'], 'x': r1(x), 'z': r1(z)})
    special_polys.append(Point(x, z).buffer(14))

region_show = DETAIL.buffer(80)


def default_height(b, area):
    t = b['t']
    h = num(t.get('height'))
    if h:
        return h
    lv = num(t.get('building:levels'))
    if lv:
        return lv * 3.2 + 1.0
    typ = t.get('building')
    rnd = h01(b['id'])
    if typ in ('roof', 'kiosk', 'shed', 'garage', 'toilets', 'service', 'hut'):
        return 3.5 + rnd * 2
    if typ in ('transportation',):
        return 7 + rnd * 3
    if area < 40:
        return 6 + rnd * 5
    return 11 + rnd * 12 + (4 if area > 500 else 0)


STYLE = {'mosque': 'mosque', 'church': 'church', 'palace': 'palace', 'train_station': 'stone', 'commercial': 'modern', 'office': 'modern',
         'hotel': 'modern', 'retail': 'modern', 'school': 'stone', 'university': 'stone', 'apartments': 'apt', 'residential': 'apt', 'house': 'house',
         'transportation': 'pier'}
# ana yolların üstüne taşan bina parçalarını kes (sokak geçitleri, hatalı çizimler)
CUT_HW = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link'}
ROADCUT = unary_union([LineString(r['g']).buffer(r['w'] / 2 + 0.8, cap_style='flat') for r in ground_roads if r['hw'] in CUT_HW]
                      + [LineString(route).buffer(4.5)])
ROADCUT_P = shapely.prepared.prep(ROADCUT)
cut_blds = []
ncut = 0
for b in blds:
    p = b['p']
    if b['t'].get('building') != 'mosque' and ROADCUT_P.intersects(p):
        q = p.difference(ROADCUT)
        ncut += 1
        for piece in (q.geoms if hasattr(q, 'geoms') else [q]):
            if piece.geom_type == 'Polygon' and piece.area > 12:
                cut_blds.append({**b, 'p': piece})
    else:
        cut_blds.append(b)
blds = cut_blds
print('yola taşan bina kesildi', ncut, file=sys.stderr)
out_b = []
mosque_gen = []
for b in blds:
    p = b['p']
    c = p.centroid
    t = b['t']
    name = t.get('name', '')
    far = not region_show.contains(c)
    # uzak binalar: yalnız camiler ve adı olan büyük yapılar; karşı kıyı şeridi yüksekliksiz kutular olarak
    if any(sp.intersects(p) for sp in special_polys):
        continue
    typ = t.get('building')
    if part_idx is not None:
        hits = part_idx.query(p)
        covered = sum(parts[i]['p'].intersection(p).area for i in hits) if len(hits) else 0
        if covered > 0.35 * p.area:
            continue
    if typ == 'mosque' or name in MOSQUES:
        mp = MOSQUES.get(name)
        if mp or (p.area > 250 and not far):
            rect = p.minimum_rotated_rectangle
            xs, ys = rect.exterior.coords.xy
            e1 = math.dist((xs[0], ys[0]), (xs[1], ys[1]))
            e2 = math.dist((xs[1], ys[1]), (xs[2], ys[2]))
            ang = math.atan2(ys[1] - ys[0], xs[1] - xs[0]) if e1 >= e2 else math.atan2(ys[2] - ys[1], xs[2] - xs[1])
            L, Wd = max(e1, e2), min(e1, e2)
            if mp:
                nmin, dd, dh, mh = mp
            else:
                nmin, dd, dh, mh = (1 if p.area < 900 else 2), max(7, Wd * 0.55), 10 + Wd * 0.5, 22 + Wd * 0.9
            mosque_gen.append({'x': r1(c.x), 'z': r1(c.y), 'L': r1(L), 'W': r1(Wd), 'a': round(ang, 3), 'n': nmin, 'dd': dd, 'dh': dh, 'mh': mh,
                               'name': name, 'poly': [[r1(x), r1(y)] for x, y in list(p.exterior.coords)[:-1]]})
            continue
    if far:
        if not name and typ not in ('mosque', 'church', 'palace'):
            # karşı kıyı: kalabalık şehir dokusu olarak tutulur (alçak ayrıntı)
            pass
    area = p.area
    h = default_height(b, area)
    mh = num(t.get('min_height')) or 0
    ps = p.simplify(0.35)
    if ps.is_empty or ps.area < 6:
        continue
    ring = list(ps.exterior.coords)[:-1]
    if Polygon(ring).exterior.is_ccw:
        ring = ring[::-1]
    style = STYLE.get(typ, 'apt')
    if t.get('historic') or (name and 'Saray' in name):
        style = 'palace' if 'Saray' in name else 'stone'
    out_b.append({'h': round(h, 1), 'mh': mh, 's': style, 'r': [[r1(x), r1(y)] for x, y in ring], 'far': 1 if far else 0,
                  'v': int(h01(b['id']) * 1000), 'roof': t.get('roof:shape', '')})

out_parts = []
for q in parts:
    ps = q['p'].simplify(0.15)
    ring = list(ps.exterior.coords)[:-1]
    if len(ring) < 3:
        continue
    if Polygon(ring).exterior.is_ccw:
        ring = ring[::-1]
    c = ps.centroid
    out_parts.append({'h': q['h'], 'mh': q['mh'], 'roof': q['roof'] or '', 'rh': q['rh'], 'r': [[r1(x), r1(y)] for x, y in ring], 'c': [r1(c.x), r1(c.y)]})
print('bina', len(out_b), 'parça', len(out_parts), 'cami(üretilecek)', len(mosque_gen), file=sys.stderr)

# ---------------------------------------------------------------- alanlar, ağaçlar, tramvay, iskeleler
AREA_KIND = {'park': 'park', 'garden': 'park', 'pitch': 'pitch', 'grass': 'grass', 'recreation_ground': 'grass', 'forest': 'wood', 'wood': 'wood',
             'scrub': 'grass', 'cemetery': 'cemetery'}
areas = defaultdict(list)
trees = []
tram = []
piers = []
for e in els.values():
    t = e.get('tags', {})
    if e['type'] == 'node':
        if t.get('natural') == 'tree':
            x, z = P(e['lat'], e['lon'])
            trees.append([r1(x), r1(z)])
        continue
    if t.get('railway') == 'tram':
        g = geom_of(e)
        if g:
            tram.append([[r1(x), r1(y)] for x, y in g])
        continue
    if t.get('man_made') == 'pier':
        g = geom_of(e)
        if g and len(g) > 1:
            pg = poly_of(g) if g[0] == g[-1] else LineString(g).buffer(3, cap_style='flat')
            if pg is not None:
                piers.append(pg)
        continue
    k = t.get('leisure') or t.get('landuse') or t.get('natural')
    if k in AREA_KIND and 'building' not in t:
        p = poly_of(geom_of(e))
        if p is not None:
            areas[AREA_KIND[k]].append(p)

# ---------------------------------------------------------------- üçgenleme


def tri(geom, simplify=0.0):
    """çokgen(ler)i üçgenler: düz [x,z,...] köşe dizisi ve dizin"""
    if geom.is_empty:
        return {'v': [], 'i': []}
    if simplify:
        geom = geom.simplify(simplify)
    polys = list(geom.geoms) if hasattr(geom, 'geoms') else [geom]
    V, I = [], []
    for pg in polys:
        if not isinstance(pg, Polygon) or pg.area < 0.5:
            continue
        rings = [np.array(pg.exterior.coords)[:-1]] + [np.array(r.coords)[:-1] for r in pg.interiors]
        verts = np.concatenate(rings)
        ends = np.cumsum([len(r) for r in rings]).astype(np.uint32)
        idx = earcut.triangulate_float64(verts, ends)
        base = len(V) // 2
        V.extend(np.round(verts, 1).flatten().tolist())
        I.extend((idx + base).tolist())
    return {'v': V, 'i': I}


park_u = unary_union([p for k in ('park', 'grass', 'pitch', 'cemetery', 'wood') for p in areas[k]]).intersection(LAND) if areas else Polygon()
pier_u = unary_union(piers).difference(LAND.buffer(-1)) if piers else Polygon()
land_detail = LAND.intersection(WORLD)

# ---------------------------------------------------------------- yol çizgileri, yaya geçitleri (kavşaklarda kesilir)
nbr = defaultdict(set)
nxy = {}
node_w = defaultdict(float)
for r in ground_roads:
    ns = r['nodes']
    if not ns or r['hw'] in ('pedestrian',):
        continue
    for i in range(len(ns)):
        nxy[ns[i]] = r['g'][i]
        node_w[ns[i]] = max(node_w[ns[i]], r['w'])
        if i + 1 < len(ns):
            nbr[ns[i]].add(ns[i + 1])
            nbr[ns[i + 1]].add(ns[i])
junc_nodes = [n for n in nbr if len(nbr[n]) >= 3 and DETAIL_ROADS.contains(Point(nxy[n]))]
JUNC = unary_union([Point(nxy[n]).buffer(node_w[n] / 2 + 2.0, quad_segs=4) for n in junc_nodes])
MARK_HW = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'}
marks = []
zebra = []
for r in ground_roads:
    if r['hw'] not in MARK_HW or r['w'] < 6 or r['bridge'] and r['w'] < 8:
        continue
    ls = LineString(r['g'])
    if not DETAIL_ROADS.intersects(ls):
        continue
    w = r['w']
    n = r['lanes'] or max(1 if r['oneway'] else 2, round(w / 3.4))
    if not r['oneway'] and n % 2:
        n += 1
    lw = w / n
    offs = []
    for k in range(1, n):
        o = -w / 2 + k * lw
        if not r['oneway'] and abs(o) < 0.01:
            offs.append([0.0, 2 if n >= 4 else 0])   # orta çizgi: geniş caddede çift düz, dar yolda kesik
        else:
            offs.append([round(o, 2), 0])
    if r['hw'] in ('motorway', 'trunk', 'motorway_link', 'trunk_link'):
        offs += [[round(-w / 2 + 0.35, 2), 1], [round(w / 2 - 0.35, 2), 1]]
    if not offs:
        continue
    clipped = ls.difference(JUNC).intersection(DETAIL_ROADS)
    for piece in (clipped.geoms if hasattr(clipped, 'geoms') else [clipped]):
        if piece.is_empty or piece.geom_type != 'LineString' or piece.length < 6:
            continue
        marks.append({'g': [[r1(x), r1(y)] for x, y in piece.simplify(0.3).coords], 'o': offs})
        # yaya geçidi: kavşağa değen uçlarda
        if r['hw'] in ('primary', 'secondary', 'tertiary', 'primary_link') and piece.length > 25:
            for end, nxt in ((0, 1), (-1, -2)):
                cs = list(piece.coords)
                a, b2 = cs[end], cs[nxt]
                if JUNC.distance(Point(a)) < 0.6:
                    d = math.dist(a, b2)
                    ux, uz = (b2[0] - a[0]) / d, (b2[1] - a[1]) / d
                    zx, zz = a[0] + ux * 2.2, a[1] + uz * 2.2
                    if all(math.dist((zx, zz), (q[0], q[1])) > 9 for q in zebra):
                        zebra.append([r1(zx), r1(zz), round(math.atan2(uz, ux), 3), r1(w)])
print('çizgi', len(marks), 'yaya geçidi', len(zebra), 'kavşak', len(junc_nodes), file=sys.stderr)

# ---------------------------------------------------------------- çarpışma: sürülebilir alanın kenarı (deniz, köprü kenarı)
DRIVE = unary_union([LAND, ASPHALT, pier_u]).buffer(0)
wb = DRIVE.boundary.intersection(DETAIL.buffer(320))
walls = []
for ln in (wb.geoms if hasattr(wb, 'geoms') else [wb]):
    if ln.geom_type == 'LineString' and ln.length > 1:
        walls.append([[r1(x), r1(y)] for x, y in ln.simplify(0.5).coords])
print('duvar', len(walls), 'çizgi', file=sys.stderr)

# ---------------------------------------------------------------- yükseklik alanı (İstanbul tepeleri), 16 m ızgara
from scipy.ndimage import distance_transform_edt
SEA = -2.0
STEP = 16.0
gx0, gz0 = x0, z0
NX = int((x1 - x0) / STEP) + 2
NZ = int((z1 - z0) / STEP) + 2
GX, GZ = np.meshgrid(gx0 + np.arange(NX) * STEP, gz0 + np.arange(NZ) * STEP)
inland = shapely.contains_xy(LAND, np.clip(GX, x0 + 1, x1 - 1), np.clip(GZ, z0 + 1, z1 - 1))
d_in = distance_transform_edt(inland) * STEP
d_out = distance_transform_edt(~inland) * STEP
sd = np.where(inland, d_in - STEP / 2, -(d_out - STEP / 2))
# kıyıya yakın örneklerde kesin uzaklık
near = np.abs(sd) < 64
segs = []
for ln in (coast_clip.geoms if hasattr(coast_clip, 'geoms') else [coast_clip]):
    cs = list(ln.coords)
    segs += [LineString([cs[i], cs[i + 1]]) for i in range(len(cs) - 1)]
tree = shapely.STRtree(segs)
pts = shapely.points(GX[near], GZ[near])
_, dist = tree.query_nearest(pts, return_distance=True, all_matches=False)
sd[near] = np.where(inland[near], dist, -dist)
HILLS = [(41.0060, 28.9765, 40, 450), (41.0110, 28.9640, 62, 520), (41.0165, 28.9640, 58, 360), (41.0120, 28.9740, 46, 300),
         (41.0262, 28.9740, 42, 320), (41.0330, 28.9830, 68, 480), (41.0370, 28.9860, 80, 520), (41.0470, 28.9930, 78, 650),
         (41.0500, 29.0100, 72, 520), (41.0540, 29.0250, 70, 520), (41.0230, 29.0250, 42, 520), (41.0450, 29.0500, 105, 900),
         (41.0275, 29.0690, 230, 1300), (40.9900, 29.0350, 32, 900), (41.0150, 28.9450, 60, 1500), (41.0600, 28.9900, 80, 1500)]
base = np.full(GX.shape, 20.0)
for la, lo, hh, rad in HILLS:
    hx, hz = P(la, lo)
    base = np.maximum(base, hh * np.exp(-((GX - hx) ** 2 + (GZ - hz) ** 2) / (2 * rad * rad)))
rng = np.random.default_rng(7)
for k in range(4):
    f = (k + 1) * 2.2 / 4000
    a = 9.0 / (k + 1)
    ang = rng.uniform(0, math.pi)
    ph = rng.uniform(0, 6.28, 2)
    base += a * np.sin((GX * math.cos(ang) + GZ * math.sin(ang)) * f * 6.283 + ph[0]) * np.cos((GZ * math.cos(ang) - GX * math.sin(ang)) * f * 4.0 + ph[1])
t = np.clip((sd - 60) / 640, 0, 1)
ramp = (t * t * (3 - 2 * t)) ** 1.3
coastal = np.clip(SEA + sd * (2.0 / 3.0), SEA, 0)
H = np.where(sd >= 0, coastal * (1 - ramp) + ramp * np.maximum(base, 0), SEA + sd * 0.5)
H = np.clip(H, -30, 400)
Hq = np.round(H * 10).astype('<i2')
open('data/height.bin', 'wb').write(Hq.tobytes())
print('yükseklik ızgarası', NX, 'x', NZ, 'en yüksek', round(float(H.max()), 1), file=sys.stderr)

# ---------------------------------------------------------------- köprü kenarları (deniz üstündeki asfalt kenarı)
de = ASPHALT.boundary.difference(LAND.buffer(0.8))
deck_edges = []
for ln in (de.geoms if hasattr(de, 'geoms') else [de]):
    if ln.geom_type == 'LineString' and ln.length > 2:
        deck_edges.append([[r1(x), r1(y)] for x, y in ln.simplify(0.3).coords])

out = {
    'about': 'Harita verisi © OpenStreetMap katkıcıları (ODbL). Yerel metre: x doğu, z güney.',
    'origin': [LAT0, LON0],
    'world': [r1(x0), r1(z0), r1(x1), r1(z1)],
    'land': tri(land_detail, 1.5),
    'asphalt': tri(ASPHALT),
    'walk': tri(WALK),
    'park': tri(park_u.difference(ASPHALT).buffer(0), 0.5),
    'piers': tri(pier_u, 0.3),
    'route': {'pts': [[r1(x), r1(z)] for x, z in route], 'w': route_w, 'ow': route_ow, 'len': round(route_len), 'cps': checkpoints},
    'roads': [{'g': [[r1(x), r1(y)] for x, y in LineString(r['g']).simplify(0.4).coords], 'w': r1(r['w']), 'hw': r['hw'], 'ow': 1 if r['oneway'] else 0,
               'n': r['name'], 'b': 1 if r['bridge'] else 0, 'e': 1 if r['elevated'] else 0, 'lanes': r['lanes']}
              for r in roads if r['elevated'] or DETAIL_ROADS.intersects(LineString(r['g']))],
    'buildings': out_b,
    'parts': out_parts,
    'mosques': mosque_gen,
    'specials': specials_out,
    'trees': trees,
    'marks': marks,
    'zebra': zebra,
    'walls': walls,
    'deck': deck_edges,
    'sea': SEA,
    'hgrid': {'x0': r1(gx0), 'z0': r1(gz0), 'step': STEP, 'nx': NX, 'nz': NZ},
    'b15': {'a': [2828.0, -2872.0], 'b': [3788.0, -1657.0], 'w': 33.0},
    'junc': [[r1(nxy[n][0]), r1(nxy[n][1]), r1(node_w[n])] for n in junc_nodes],
    'tram': tram,
    'coast': [[[r1(x), r1(y)] for x, y in ln.simplify(1.0).coords] for ln in (coast_clip.geoms if hasattr(coast_clip, 'geoms') else [coast_clip]) if ln.length > 5],
}
s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open('data/istanbul.json', 'w').write(s)
print('istanbul.json', round(len(s) / 1e6, 2), 'MB', file=sys.stderr)
