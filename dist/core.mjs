export const WORLD = { w: 1000, h: 680, cx: 500, cy: 340, radius: 22 };
export const RULES = {
  discovery: { catchWindow: .5, catchRadius: 42, ballSpeed: 365, fetchSpeed: 146, preparation: 1.75, lockAt: .62, lead: .55, gatherTime: .42, pourTime: .42, scoopSize: .1, emptyRate: .36 },
  challenge: { catchWindow: .34, catchRadius: 37, ballSpeed: 440, fetchSpeed: 172, preparation: 1.4, lockAt: .49, lead: .85, gatherTime: .46, pourTime: .44, scoopSize: .1, emptyRate: .3 }
};
export const length = (x, y) => Math.hypot(x, y);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const unit = (x, y) => { const n = length(x, y) || 1; return { x: x / n, y: y / n }; };

export class Likolo {
  constructor() { this.reset(); }
  reset(mode = 'discovery') {
    this.mode = mode; this.status = 'ready'; this.time = 0; this.fill = 0; this.phase = 'fill';
    this.player = { x: 500, y: 358, vx: 0, vy: 0, height: 0, jumpVelocity: 0, moving: false, prone: false };
    this.bottle = { x: 500, y: 340, upright: true, held: false, fallenAt: -10 };
    this.throwers = [{ x: 75, y: 340 }, { x: 925, y: 340 }];
    this.ball = { state: 'aiming', owner: 0, timer: 2.25, x: 75, y: 340, height: 1.75 };
    this.catchUntil = -1; this.catchReady = 0; this.chargeStart = null; this.jumpReady = 0;
    this.catches = 0; this.stats = { shots: 0, jumps: 0, jumpDodges: 0, feints: 0, gathers: 0, pours: 0, topples: 0 };
    this.action = null; this.sandInHand = 0; this.sandActive = false; this.gatherActive = false;
    this.notice = ''; this.noticeUntil = 0; this.flash = 0; this.events = [];
    this.lastMove = { x: 0, y: 0 };
  }
  start(mode = this.mode) { this.reset(mode); this.status = 'playing'; }
  tell(message, seconds = 2.3) { this.notice = message; this.noticeUntil = this.time + seconds; }
  emit(type) { this.events.push(type); }
  inCircle() { return length(this.player.x - WORLD.cx, this.player.y - WORLD.cy) <= WORLD.radius + .15; }
  onGround() { return this.player.height === 0 && this.player.jumpVelocity <= 0; }
  canUseHands() { return this.status === 'playing' && this.onGround() && !this.player.prone && this.ball.state !== 'held' && !this.action && !this.player.moving; }
  beginGather() {
    if (!this.canUseHands()) return false;
    if (this.phase !== 'fill') { this.tell('La bouteille est pleine : vide-la maintenant.'); return false; }
    if (this.sandInHand) { this.tell('Tu as déjà une poignée. Verse-la dans la bouteille.'); return false; }
    this.action = { kind: 'gather', elapsed: 0, duration: RULES[this.mode].gatherTime };
    this.emit('gatherStart'); return true;
  }
  beginPour() {
    if (!this.canUseHands()) return false;
    if (!this.inCircle()) { this.tell('Reviens dans le petit cercle, près de la bouteille.'); return false; }
    if (!this.bottle.upright) { this.tell('La bouteille est tombée : redresse-la avec F.'); return false; }
    if (this.phase === 'empty') {
      this.action = { kind: 'empty', elapsed: 0, duration: this.fill / RULES[this.mode].emptyRate }; return true;
    }
    if (!this.sandInHand) { this.tell('Ramasse une poignée de sable avec R avant de verser.'); return false; }
    this.sandInHand = 0;
    this.action = { kind: 'pour', elapsed: 0, duration: RULES[this.mode].pourTime };
    this.emit('pourStart'); return true;
  }
  beginRightBottle() {
    if (!this.canUseHands()) return false;
    if (!this.inCircle()) { this.tell('Rapproche-toi de la bouteille pour la redresser.'); return false; }
    if (this.bottle.upright) { this.tell('La bouteille est déjà debout.'); return false; }
    this.action = { kind: 'right', elapsed: 0, duration: .58 }; return true;
  }
  cancelAction() {
    if (!this.action) return;
    const interruptedPour = this.action.kind === 'pour';
    this.action = null; this.sandActive = this.gatherActive = false;
    if (interruptedPour) this.tell('Poignée perdue pendant le geste. Ramasse du sable à nouveau.');
  }
  toppleBottle(reason = 'La bouteille est tombée. Redresse-la avant de verser.') {
    if (!this.bottle.upright) return;
    this.bottle.upright = false; this.bottle.fallenAt = this.time; this.stats.topples++;
    if (this.action && this.action.kind !== 'gather') this.cancelAction();
    this.emit('topple'); this.tell(reason);
  }
  jump() {
    if (this.status !== 'playing' || !this.onGround() || this.time < this.jumpReady) return false;
    this.cancelAction(); this.player.prone=false; this.player.height = .001; this.player.jumpVelocity = 6.1;
    this.jumpReady = this.time + 1.0; this.stats.jumps++; this.emit('jump'); return true;
  }
  toggleProne() {
    if(this.status!=='playing'||!this.onGround())return false;
    this.cancelAction();this.player.prone=!this.player.prone;return true;
  }
  catchOrCharge() {
    if (this.status !== 'playing'||this.player.prone) return;
    if (this.ball.state === 'held') { if (this.chargeStart === null) this.chargeStart = this.time; return; }
    if (this.time < this.catchReady) return;
    this.cancelAction(); this.catchUntil = this.time + RULES[this.mode].catchWindow;
    this.catchReady = this.time + .86; this.emit('reach');
  }
  releaseThrow(aim = { x: 0, y: -1 }) {
    if (this.status !== 'playing' || this.ball.state !== 'held' || this.chargeStart === null) return;
    const power = clamp((this.time - this.chargeStart) / 1.1, .18, 1), d = unit(aim.x, aim.y), distance = 130 + 510 * power;
    const end = { x: clamp(this.player.x + d.x * distance, 22, 978), y: clamp(this.player.y + d.y * distance, 44, 636) };
    const distances = this.throwers.map(n => length(end.x - n.x, end.y - n.y));
    const owner = distances[0] <= distances[1] ? 0 : 1;
    this.ball = { state: 'retrieving', owner, x: this.player.x, y: this.player.y, height: this.player.height + 1.5,
      from: { ...this.player }, end, elapsed: 0, duration: .45 + power * .3, leg: 'out', wait: 0, power };
    this.chargeStart = null; this.emit('throw'); this.tell('La balle s’éloigne ! Ramasse, puis verse ta poignée.', 3);
  }
  chooseShot() {
    const p=this.player,n=this.stats.shots;
    let plan;
    if(p.height>.3||(this.stats.jumps>=2&&n%3===2))plan={style:'haut',targetHeight:1.95,speed:1,lead:.65};
    else if(length(p.vx,p.vy)>65)plan={style:'anticipé',targetHeight:.95,speed:1.04,lead:1};
    else if(this.action&&n%2)plan={style:'tendu',targetHeight:1.15,speed:1.1,lead:.45};
    else plan=n%3===1?{style:'tendu',targetHeight:1.15,speed:1.06,lead:.5}:{style:'bas',targetHeight:.38,speed:.95,lead:.55};
    const tempo=['lent','rapide','lent','normal','rapide'][n%5];
    plan.tempo=tempo;plan.speed*=tempo==='rapide'?1.42:tempo==='lent'?.64:1;
    return plan;
  }
  lockShot(b) {
    const plan = this.chooseShot(), npc = this.throwers[b.owner], p = this.player, r = RULES[this.mode];
    const travel = length(p.x - npc.x, p.y - npc.y) / r.ballSpeed;
    const anticipation = (b.timer + travel * .65) * r.lead * plan.lead;
    b.target = { x: clamp(p.x + p.vx * anticipation, 137, 863), y: clamp(p.y + p.vy * anticipation, 136, 544) };
    b.plan = plan; this.emit('prepare');
  }
  finishAction(a) {
    this.action = null; this.sandActive = this.gatherActive = false;
    if (a.kind === 'gather') { this.sandInHand = 1; this.stats.gathers++; this.emit('gather'); }
    if (a.kind === 'right') { this.bottle.upright = true; this.emit('right'); this.tell('Bouteille redressée. Tu peux verser.'); }
    if (a.kind === 'pour') {
      this.fill = Math.min(1, this.fill + RULES[this.mode].scoopSize); this.stats.pours++; this.emit('pour');
      if (this.fill >= 1 - 1e-8) { this.fill = 1; this.phase = 'empty'; this.sandInHand = 0; this.emit('full'); this.tell('Pleine ! Reste près de la bouteille et vide-la avec Espace.', 3.2); }
    }
  }
  update(dt, input = {}) {
    if (this.status !== 'playing') return;
    dt = clamp(dt, 0, .035); if (!dt) return;
    this.time += dt; this.flash = Math.max(0, this.flash - dt);
    const p = this.player, r = RULES[this.mode];
    if (!this.onGround()) { p.jumpVelocity -= 13.4 * dt; p.height += p.jumpVelocity * dt; if (p.height <= 0) { p.height = 0; p.jumpVelocity = 0; this.emit('land'); } }
    const mx = input.x || 0, my = input.y || 0, magnitude = Math.min(1, length(mx, my));
    p.moving = magnitude > .08;
    const before = { x: p.x, y: p.y };
    if (magnitude > .08) {
      this.cancelAction(); const d = unit(mx, my), speed = p.prone ? 72 : this.onGround() ? 240 : 235;
      p.x = clamp(p.x + d.x * speed * magnitude * dt, 137, 863); p.y = clamp(p.y + d.y * speed * magnitude * dt, 136, 544);
      this.lastMove = d;
      if (p.height < .18 && length(p.x - this.bottle.x, p.y - this.bottle.y) < 13)
        this.toppleBottle('Tu as bousculé la bouteille. Reviens la redresser avec F.');
    }
    const smooth = Math.min(1, dt * 12); p.vx += ((p.x - before.x) / dt - p.vx) * smooth; p.vy += ((p.y - before.y) / dt - p.vy) * smooth;
    this.sandActive = this.action?.kind === 'pour' || this.action?.kind === 'empty';
    this.gatherActive = this.action?.kind === 'gather';
    if (this.action) {
      const a = this.action; a.elapsed += dt;
      if (a.kind === 'empty') {
        this.fill = Math.max(0, this.fill - r.emptyRate * dt);
        if (this.fill <= 0) { this.action = null; this.status = 'won'; this.sandActive = false; this.emit('win'); return; }
      } else if (a.elapsed >= a.duration) this.finishAction(a);
    }
    const b = this.ball;
    if (b.state === 'aiming') {
      const npc = this.throwers[b.owner]; b.timer -= dt;
      if (!b.target) {
        const flank = (b.owner === 0 ? 1 : -1) * (this.stats.shots % 2 ? 48 : -32);
        npc.y += clamp(clamp(p.y + flank, 218, 462) - npc.y, -65 * dt, 65 * dt);
      }
      b.x = npc.x; b.y = npc.y; b.height = 1.75;
      if (this.catches >= 2 && this.stats.shots % 3 === 2 && !b.feinted && b.timer <= 1.0) {
        b.feinted = true; b.feintUntil = this.time + .38; b.timer += .38; this.stats.feints++; this.emit('feint');
      }
      if (b.timer <= r.lockAt && !b.target) this.lockShot(b);
      if (b.timer <= 0) {
        if (!b.target) this.lockShot(b);
        const direction = unit(b.target.x - npc.x, b.target.y - npc.y), speed = r.ballSpeed * b.plan.speed;
        this.ball = { state: 'flying', owner: b.owner, x: npc.x, y: npc.y, vx: direction.x * speed, vy: direction.y * speed,
          age: 0, target: { ...b.target }, style: b.plan.style, tempo:b.plan.tempo, targetHeight: b.plan.targetHeight, height: 1.75,
          flightTime: length(b.target.x - npc.x, b.target.y - npc.y) / speed };
        this.stats.shots++; this.emit('shot');
      }
    } else if (b.state === 'flying') {
      b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt;
      const t = clamp(b.age / (b.flightTime || 1), 0, 1);
      b.height = 1.75 + ((b.targetHeight ?? 1.0) - 1.75) * t;
      if (!b.bottleHit && b.height < .65 && length(b.x - this.bottle.x, b.y - this.bottle.y) < 11) {
        b.bottleHit = true; this.emit('bottleHit'); this.toppleBottle('Un tir bas a renversé la bouteille. Redresse-la avec F.');
      }
      const distance = length(b.x - p.x, b.y - p.y), catchHeight = b.height >= p.height + .08 && b.height <= p.height + 2.9;
      const bodyHit = b.height >= p.height + .12 && b.height <= p.height + (p.prone ? .48 : 2.35);
      if (this.time <= this.catchUntil && distance <= r.catchRadius && catchHeight) {
        this.cancelAction(); this.ball = { state: 'held', lastOwner: b.owner, x: p.x, y: p.y, height: p.height + 1.6 };
        this.catchUntil = -1; this.catches++; this.flash = .45; this.emit('catch'); this.tell('Attrapée ! Maintiens E, puis relâche pour lancer fort.', 3);
      } else if (distance <= 21 && bodyHit) { this.cancelAction(); this.status = 'lost'; this.emit('lose'); }
      else if (distance <= 24 && !bodyHit && p.height > .25 && !b.jumped) { b.jumped = true; this.stats.jumpDodges++; this.emit('jumpDodge'); }
      if (this.status === 'playing' && this.ball === b && (b.x < 35 || b.x > 965 || b.y < 65 || b.y > 615 || b.age > 3.2)) {
        const owner = 1 - b.owner; this.ball = { state: 'aiming', owner, timer: r.preparation, ...this.throwers[owner], height: 1.75 };
      }
    } else if (b.state === 'held') { b.x = p.x; b.y = p.y; b.height = p.height + 1.6; }
    else if (b.state === 'retrieving') {
      b.elapsed += dt; const t = clamp(b.elapsed / b.duration, 0, 1);
      b.x = b.from.x + (b.end.x - b.from.x) * t; b.y = b.from.y + (b.end.y - b.from.y) * t; b.height = .2 + Math.sin(t * Math.PI) * 3.6;
      const npc = this.throwers[b.owner], other = this.throwers[1 - b.owner];
      other.y += clamp(clamp(p.y - 45, 220, 460) - other.y, -38 * dt, 38 * dt);
      const target = b.leg === 'out' ? b.end : { x: b.owner === 0 ? 75 : 925, y: clamp(p.y + (b.owner === 0 ? -40 : 40), 220, 460) };
      const d = length(target.x - npc.x, target.y - npc.y), step = r.fetchSpeed * dt;
      if (b.wait > 0) b.wait -= dt;
      else if (d > 4) { npc.x += (target.x - npc.x) / d * Math.min(d, step); npc.y += (target.y - npc.y) / d * Math.min(d, step); }
      else if (b.leg === 'out' && t === 1) { b.leg = 'back'; b.wait = .35; this.emit('retrieve'); }
      else if (b.leg === 'back') { this.ball = { state: 'aiming', owner: b.owner, timer: r.preparation, ...npc, height: 1.75 }; }
      if (b.leg === 'back') { b.x = npc.x; b.y = npc.y; b.height = 1.25; }
    }
  }
  progress() { return this.phase === 'fill' ? this.fill / 2 : .5 + (1 - this.fill) / 2; }
  charge() { return this.chargeStart === null ? 0 : clamp((this.time - this.chargeStart) / 1.1, 0, 1); }
  actionProgress() { return this.action ? clamp(this.action.elapsed / this.action.duration, 0, 1) : 0; }
}
