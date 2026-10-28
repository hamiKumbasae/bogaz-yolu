// Klavye ve oyun kumandası
export class Input {
  constructor() {
    this.keys = new Set();
    this.state = { gas: 0, brake: 0, steer: 0, hand: false, nitro: false };
    this.edges = [];          // menü olayları: up, down, left, right, ok, back, camera, reset, pause, mute
    this.pad = null;
    this.prevBtn = [];
    addEventListener('keydown', (e) => {
      if (e.repeat) { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) this.menuKey(e.code); return; }
      this.keys.add(e.code);
      this.menuKey(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  menuKey(code) {
    const map = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      Enter: 'ok', Space: 'ok', Escape: 'pause', KeyP: 'pause', KeyC: 'camera', KeyR: 'reset', KeyM: 'mute', KeyF: 'fullscreen', Backspace: 'back' };
    if (map[code]) this.edges.push(map[code]);
  }
  poll(dt) {
    const k = this.keys;
    let gas = k.has('KeyW') || k.has('ArrowUp') ? 1 : 0;
    let brake = k.has('KeyS') || k.has('ArrowDown') ? 1 : 0;
    let steerT = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let hand = k.has('Space');
    let nitro = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyN');
    // klavye direksiyonu yumuşatılır
    const s = this.state;
    const rate = steerT === 0 ? 7 : (Math.sign(steerT) !== Math.sign(s.steer) && s.steer !== 0 ? 9 : 4.2);
    let steer = s.steer + Math.max(-rate * dt, Math.min(rate * dt, steerT - s.steer));
    // kumanda
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = Array.from(pads || []).find((x) => x && x.connected);
    this.pad = p || null;
    if (p) {
      const b = (i) => (p.buttons[i] ? p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0) : 0);
      const ax = p.axes[0] || 0;
      const dz = Math.abs(ax) < 0.12 ? 0 : (ax - Math.sign(ax) * 0.12) / 0.88;
      if (Math.abs(dz) > 0.01) steer = Math.sign(dz) * Math.pow(Math.abs(dz), 1.4);
      gas = Math.max(gas, b(7));
      brake = Math.max(brake, b(6));
      hand = hand || b(2) > 0.5 || b(5) > 0.5;
      nitro = nitro || b(0) > 0.5;
      const pressed = p.buttons.map((x) => x && x.pressed);
      const edge = (i, ev) => { if (pressed[i] && !this.prevBtn[i]) this.edges.push(ev); };
      edge(12, 'up'); edge(13, 'down'); edge(14, 'left'); edge(15, 'right');
      edge(0, 'ok'); edge(1, 'back'); edge(9, 'pause'); edge(3, 'camera'); edge(8, 'reset');
      // sol çubukla menü
      const ay = p.axes[1] || 0;
      const t = performance.now();
      if (!this.stickT || t - this.stickT > 220) {
        if (ay < -0.6) { this.edges.push('up'); this.stickT = t; } else if (ay > 0.6) { this.edges.push('down'); this.stickT = t; }
        else if (ax < -0.7) { this.edges.push('left'); this.stickT = t; } else if (ax > 0.7) { this.edges.push('right'); this.stickT = t; }
      }
      this.prevBtn = pressed;
    }
    s.gas = gas; s.brake = brake; s.steer = Math.max(-1, Math.min(1, steer)); s.hand = hand; s.nitro = nitro;
    return s;
  }
  take() { const e = this.edges; this.edges = []; return e; }
  rumble(power, ms = 120) {
    const p = this.pad;
    if (p && p.vibrationActuator && p.vibrationActuator.playEffect) {
      p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, power), weakMagnitude: Math.min(1, power * 0.6) }).catch(() => {});
    }
  }
}
