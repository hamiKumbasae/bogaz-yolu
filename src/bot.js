// Boğaz Yolu — bilgisayar sürücüsü: başlık ekranındaki gösteri sürüşü ve testlerdeki süre dengesi için.
(function (root) {
  'use strict';
  const BY = root.BY;
  const { SEG, RW, MAX, PLAYER_Z } = BY;
  // choices: her yol ayrımında 0 sol, 1 sağ
  function bot(choices) {
    return (G) => {
      const pz = G.pos + PLAYER_Z;
      const s = BY.segAt(G, pz);
      const sp = G.speed / MAX;
      let target;
      const st = BY.curStage(G);
      const pi = Math.floor(pz / SEG);
      if (st.forkStart >= 0 && pi >= st.forkStart - 40 && G.lockSide === null) {
        const ch = choices[G.cur];
        target = s.cx + (ch ? 1 : -1) * Math.max(s.fork, 0.6 * RW);
      } else {
        // şerit seç: çarpışmaya en uzak kalan şerit
        const road = BY.nearestRoad(s, G.px);
        const cur = (G.px - road) / RW;
        let best = 0, bestScore = -1e9, bestGap = 99;
        for (const lx of BY.LANE_X) {
          let gap = 60, blockedPath = false;
          for (const c of G.cars) {
            const d = (c.z - pz) / SEG;
            if (d < -1.8 || d > 80) continue;
            if (Math.abs(c.x - lx) < 0.5 && d < gap) gap = Math.max(0, d);
            // yanındaki araç geçişi kapatıyor mu
            const lo = Math.min(cur, lx) - 0.35, hi = Math.max(cur, lx) + 0.35;
            if (Math.abs(lx - cur) > 0.2 && d > -1.8 && d < 4 && c.x > lo && c.x < hi && Math.abs(c.x - cur) > 0.3) blockedPath = true;
          }
          const score = Math.min(gap, 60) / 20 - Math.abs(lx - cur) * 0.3 - (blockedPath ? 10 : 0);
          if (score > bestScore) { bestScore = score; best = lx; bestGap = gap; }
        }
        const bestTtc = bestGap < 3 ? 0 : 9;
        target = road + best * RW;
        if (bestTtc < 0.35) return { steer: Math.max(-1, Math.min(1, (target - G.px) / RW * 6)), gas: 0, brake: true };
      }
      // ileri bak: viraj
      let cmax = 0;
      for (let k = 0; k < 45; k++) { const t = G.track[Math.min(G.track.length - 1, s.i + k)]; cmax = Math.max(cmax, Math.abs(t.curve)); }
      const vmax = cmax > 0 ? Math.min(1, 4.4 / cmax) : 1;
      const steer = Math.max(-1, Math.min(1, (target - G.px) / RW * 6 + s.curve * 0.24 * sp * sp));
      return { steer, gas: sp < vmax ? 1 : 0, brake: sp > vmax + 0.1 };
    };
  }
  root.BY_BOT = bot;
})(typeof window !== 'undefined' ? window : globalThis);
