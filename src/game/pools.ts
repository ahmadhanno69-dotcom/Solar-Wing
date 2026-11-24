export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  endSize: number;
  color: string;
  drag: number;
  shape: 0 | 1 | 2; // 0 circle, 1 spark line, 2 diamond
  angle: number;
}

export class ParticlePool {
  readonly capacity: number;
  readonly items: Particle[];
  private cursor = 0;

  constructor(capacity = 1800) {
    this.capacity = capacity;
    this.items = new Array<Particle>(capacity);
    for (let i = 0; i < capacity; i++) {
      this.items[i] = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 3,
        endSize: 0,
        color: '#f59e0b',
        drag: 0.94,
        shape: 0,
        angle: 0,
      };
    }
  }

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    maxLife: number,
    size: number,
    endSize: number,
    color: string,
    drag = 0.94,
    shape: 0 | 1 | 2 = 0,
    angle = 0
  ): void {
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.size = size;
    p.endSize = endSize;
    p.color = color;
    p.drag = drag;
    p.shape = shape;
    p.angle = angle;
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.items[i].active = false;
    }
    this.cursor = 0;
  }
}

export interface Projectile {
  active: boolean;
  fromPlayer: boolean;
  reflected: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  color: string;
  pierce: number;
}

export class ProjectilePool {
  readonly capacity: number;
  readonly items: Projectile[];
  private cursor = 0;

  constructor(capacity = 512) {
    this.capacity = capacity;
    this.items = new Array<Projectile>(capacity);
    for (let i = 0; i < capacity; i++) {
      this.items[i] = {
        active: false,
        fromPlayer: true,
        reflected: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 5,
        damage: 10,
        life: 0,
        maxLife: 1,
        color: '#f8fafc',
        pierce: 0,
      };
    }
  }

  spawn(
    fromPlayer: boolean,
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    damage: number,
    maxLife: number,
    color: string,
    pierce = 0,
    reflected = false
  ): void {
    // Prefer an inactive slot before overwriting oldest
    for (let n = 0; n < this.capacity; n++) {
      const idx = (this.cursor + n) % this.capacity;
      const item = this.items[idx];
      if (!item.active) {
        this.cursor = (idx + 1) % this.capacity;
        this.assign(item, fromPlayer, x, y, vx, vy, radius, damage, maxLife, color, pierce, reflected);
        return;
      }
    }
    const fallback = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    this.assign(fallback, fromPlayer, x, y, vx, vy, radius, damage, maxLife, color, pierce, reflected);
  }

  private assign(
    item: Projectile,
    fromPlayer: boolean,
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    damage: number,
    maxLife: number,
    color: string,
    pierce: number,
    reflected: boolean
  ): void {
    item.active = true;
    item.fromPlayer = fromPlayer;
    item.reflected = reflected;
    item.x = x;
    item.y = y;
    item.vx = vx;
    item.vy = vy;
    item.radius = radius;
    item.damage = damage;
    item.life = maxLife;
    item.maxLife = maxLife;
    item.color = color;
    item.pierce = pierce;
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.items[i].active = false;
    }
    this.cursor = 0;
  }
}

export interface EnergyOrb {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  life: number;
}

export class OrbPool {
  readonly capacity: number;
  readonly items: EnergyOrb[];
  private cursor = 0;

  constructor(capacity = 256) {
    this.capacity = capacity;
    this.items = new Array<EnergyOrb>(capacity);
    for (let i = 0; i < capacity; i++) {
      this.items[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, value: 1, life: 0 };
    }
  }

  spawn(x: number, y: number, vx: number, vy: number, value: number): void {
    const o = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    o.active = true;
    o.x = x;
    o.y = y;
    o.vx = vx;
    o.vy = vy;
    o.value = value;
    o.life = 14;
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.items[i].active = false;
    }
    this.cursor = 0;
  }
}

export interface Afterimage {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  life: number;
  maxLife: number;
  color: string;
}

export class AfterimagePool {
  readonly capacity: number;
  readonly items: Afterimage[];
  private cursor = 0;

  constructor(capacity = 40) {
    this.capacity = capacity;
    this.items = new Array<Afterimage>(capacity);
    for (let i = 0; i < capacity; i++) {
      this.items[i] = { active: false, x: 0, y: 0, angle: 0, life: 0, maxLife: 0.25, color: '#f59e0b' };
    }
  }

  spawn(x: number, y: number, angle: number, maxLife: number, color: string): void {
    const a = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    a.active = true;
    a.x = x;
    a.y = y;
    a.angle = angle;
    a.life = maxLife;
    a.maxLife = maxLife;
    a.color = color;
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.items[i].active = false;
    }
    this.cursor = 0;
  }
}

export interface FloatingCallout {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export class CalloutPool {
  readonly capacity: number;
  readonly items: FloatingCallout[];
  private cursor = 0;

  constructor(capacity = 64) {
    this.capacity = capacity;
    this.items = new Array<FloatingCallout>(capacity);
    for (let i = 0; i < capacity; i++) {
      this.items[i] = {
        active: false,
        x: 0,
        y: 0,
        vy: -40,
        text: '',
        color: '#f8fafc',
        life: 0,
        maxLife: 0.6,
        scale: 1,
      };
    }
  }

  spawn(x: number, y: number, text: string, color = '#f8fafc', scale = 1): void {
    const c = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    c.active = true;
    c.x = x;
    c.y = y;
    c.vy = -52;
    c.text = text;
    c.color = color;
    c.life = 0.65;
    c.maxLife = 0.65;
    c.scale = scale;
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.items[i].active = false;
    }
    this.cursor = 0;
  }
}

/**
 * Spatial hash grid for fast O(1) broad-phase neighbor lookup without per-frame allocations.
 */
export class SpatialGrid {
  private readonly cellSize: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly halfW: number;
  private readonly halfH: number;
  private readonly buckets: number[][];

  constructor(arenaWidth: number, arenaHeight: number, cellSize = 140) {
    this.cellSize = cellSize;
    this.halfW = arenaWidth * 0.5;
    this.halfH = arenaHeight * 0.5;
    this.cols = Math.max(1, Math.ceil(arenaWidth / cellSize));
    this.rows = Math.max(1, Math.ceil(arenaHeight / cellSize));
    const total = this.cols * this.rows;
    this.buckets = new Array<number[]>(total);
    for (let i = 0; i < total; i++) {
      this.buckets[i] = [];
    }
  }

  clear(): void {
    for (let i = 0; i < this.buckets.length; i++) {
      this.buckets[i].length = 0;
    }
  }

  private cellCoord(x: number, y: number): [number, number] {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor((x + this.halfW) / this.cellSize)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor((y + this.halfH) / this.cellSize)));
    return [cx, cy];
  }

  insert(index: number, x: number, y: number): void {
    const [cx, cy] = this.cellCoord(x, y);
    this.buckets[cy * this.cols + cx].push(index);
  }

  queryRadius(x: number, y: number, radius: number, outIndices: number[]): void {
    outIndices.length = 0;
    const minCx = Math.max(0, Math.floor((x - radius + this.halfW) / this.cellSize));
    const maxCx = Math.min(this.cols - 1, Math.floor((x + radius + this.halfW) / this.cellSize));
    const minCy = Math.max(0, Math.floor((y - radius + this.halfH) / this.cellSize));
    const maxCy = Math.min(this.rows - 1, Math.floor((y + radius + this.halfH) / this.cellSize));

    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowOffset = cy * this.cols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.buckets[rowOffset + cx];
        for (let i = 0; i < bucket.length; i++) {
          outIndices.push(bucket[i]);
        }
      }
    }
  }
}
