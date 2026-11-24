import { SoundSynth } from './audio';
import {
  AfterimagePool,
  CalloutPool,
  OrbPool,
  ParticlePool,
  ProjectilePool,
  SpatialGrid,
} from './pools';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  COMBO_DECAY_SECONDS,
  MAX_COMBO,
  TARGET_VICTORY_WAVE,
  buildWavePlan,
  calculateKillScore,
  clampToArena,
  computePlayerStats,
  createInitialUpgrades,
  pickEnemyArchetype,
  pickUpgradeChoices,
  segmentCircleIntersect,
} from './rules';
import type {
  Difficulty,
  EnemyKind,
  GamePhase,
  HudSnapshot,
  PlayerStats,
  RunSummary,
  UpgradeDef,
  UpgradeId,
} from './types';

interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  scoreValue: number;
  hitFlash: number;
  state: 'chase' | 'windup' | 'attack' | 'recover' | 'ko';
  stateTimer: number;
  cooldown: number;
  hasToken: boolean;
  aimX: number;
  aimY: number;
  koDuration: number;
  phaseOffset: number;
  shieldAngle: number;
}

interface NovaRing {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

interface TitleGlider {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  phase: number;
  color: string;
}

interface BgStar {
  x: number;
  y: number;
  size: number;
  depth: number;
  alpha: number;
  warm: boolean;
}

export interface EngineCallbacks {
  onHudChange: (snapshot: HudSnapshot) => void;
  onRunEnd: (summary: RunSummary) => void;
}

const BEST_SCORE_KEY = 'solar_wing_best_score_v1';
const MAX_ATTACK_TOKENS = 3;

export class SolarWingEngine {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  readonly sound = new SoundSynth();

  private width = 1280;
  private height = 720;
  private dpr = 1;
  private resizeObserver: ResizeObserver | null = null;
  private rafId = 0;
  private lastTimestamp = 0;
  private horizonGrad: CanvasGradient | null = null;
  private vignetteGrad: CanvasGradient | null = null;
  private needsFrozenRender = true;

  // Game State Machine
  private phase: GamePhase = 'title';
  private outcome: 'victory' | 'defeat' | null = null;
  private difficulty: Difficulty = 'standard';
  private endlessMode = false;

  // Pools & Spatial Grid (Zero-GC)
  private particles = new ParticlePool(1800);
  private projectiles = new ProjectilePool(512);
  private orbs = new OrbPool(256);
  private afterimages = new AfterimagePool(40);
  private callouts = new CalloutPool(64);
  private enemyGrid = new SpatialGrid(ARENA_WIDTH, ARENA_HEIGHT, 160);
  private nearbyIndices: number[] = [];
  private novaRings: NovaRing[] = Array.from({ length: 6 }, () => ({
    active: false,
    x: 0,
    y: 0,
    radius: 0,
    maxRadius: 460,
    life: 0,
    maxLife: 0.35,
    color: '#f59e0b',
  }));

  // Background parallax stars
  private stars: BgStar[] = [];
  private titleGliders: TitleGlider[] = [];

  // Input State
  private keysHeld = new Set<string>();
  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private mouseDown = false;
  private dashBuffer = 0;
  private novaBuffer = 0;

  // Camera & Juice
  private camX = 0;
  private camY = 0;
  private trauma = 0;
  private hitstop = 0;
  private timeScale = 1;
  private defeatBeatTimer = 0;
  private titleTime = 0;

  // Player State
  private upgrades: Record<UpgradeId, number> = createInitialUpgrades();
  private stats: PlayerStats = computePlayerStats(this.upgrades, this.difficulty);
  private player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 16,
    hp: 5,
    ghostHp: 5,
    invulnTimer: 0,
    hitFlash: 0,
    fireCooldown: 0,
    dashCooldownTimer: 0,
    dashActiveTimer: 0,
    dashDirX: 1,
    dashDirY: 0,
    scaleX: 1,
    scaleY: 1,
    novaCharge: 35,
    exhaustTimer: 0,
  };

  // Wave & Run Progression
  private enemies: Enemy[] = [];
  private nextEnemyId = 1;
  private wave = 1;
  private wavePlan = buildWavePlan(1, 'standard');
  private waveSpawnRemaining = 0;
  private waveSpawnTimer = 0;
  private bossSpawnedForWave = false;
  private waveClearDelay = 0;
  private upgradeChoices: UpgradeDef[] = [];

  // Metrics
  private score = 0;
  private bestScore = 0;
  private combo = 1;
  private comboTimer = 0;
  private enemiesDefeated = 0;
  private shotsReflected = 0;
  private runElapsed = 0;
  private damageTaken = 0;

  // Throttled HUD tracking
  private lastHudEmitTime = 0;
  private lastHudKey = '';

  // Optional direct DOM refs for 60Hz bars without React reconciliation
  private dashBarEl: HTMLElement | null = null;
  private novaBarEl: HTMLElement | null = null;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.bestScore = this.loadBestScore();

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.setAttribute('data-testid', 'game-canvas');
    this.canvas.tabIndex = 0;
    this.container.appendChild(this.canvas);

    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Canvas 2D context unavailable');
    }
    this.ctx = context;

    this.initBackdrop();
    this.bindEvents();
    this.handleResize();
    this.syncBodyDataset();
    this.emitHud(true);

    this.lastTimestamp = performance.now();
    this.ensureLoopRunning();
  }

  private ensureLoopRunning(): void {
    if (this.rafId === 0) {
      this.lastTimestamp = performance.now();
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  private stopLoop(): void {
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  attachBarRefs(dashEl: HTMLElement | null, novaEl: HTMLElement | null): void {
    this.dashBarEl = dashEl;
    this.novaBarEl = novaEl;
  }

  private loadBestScore(): number {
    try {
      const raw = localStorage.getItem(BEST_SCORE_KEY);
      return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
    } catch {
      return 0;
    }
  }

  private saveBestScore(val: number): void {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(val));
    } catch {
      // ignore storage errors
    }
  }

  private initBackdrop(): void {
    this.stars = [];
    for (let i = 0; i < 190; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * (ARENA_WIDTH + 900),
        y: (Math.random() - 0.5) * (ARENA_HEIGHT + 900),
        size: 1 + Math.random() * 2.2,
        depth: 0.25 + Math.random() * 0.55,
        alpha: 0.18 + Math.random() * 0.5,
        warm: Math.random() < 0.35,
      });
    }

    const gliderColors = ['#f59e0b', '#38bdf8', '#f8fafc', '#fb7185', '#fbbf24', '#34d399'];
    this.titleGliders = [];
    for (let i = 0; i < 6; i++) {
      this.titleGliders.push({
        x: (Math.random() - 0.5) * 900,
        y: (Math.random() - 0.5) * 520,
        vx: 140 + Math.random() * 90,
        vy: (Math.random() - 0.5) * 60,
        angle: 0,
        phase: i * 1.1,
        color: gliderColors[i % gliderColors.length],
      });
    }
  }

  private bindEvents(): void {
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);

    this.sound.suspend();
    if (this.canvas.parentElement === this.container) {
      this.container.removeChild(this.canvas);
    }
  }

  private handleResize(): void {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(320, Math.floor(rect.width));
    this.height = Math.max(240, Math.floor(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);

    const hGrad = this.ctx.createRadialGradient(
      this.width * 0.52,
      this.height * 0.45,
      40,
      this.width * 0.52,
      this.height * 0.45,
      Math.max(this.width, this.height) * 0.72
    );
    hGrad.addColorStop(0, 'rgba(30, 41, 68, 0.48)');
    hGrad.addColorStop(1, 'rgba(11, 17, 30, 0)');
    this.horizonGrad = hGrad;

    const vGrad = this.ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.5,
      Math.min(this.width, this.height) * 0.32,
      this.width * 0.5,
      this.height * 0.5,
      Math.max(this.width, this.height) * 0.72
    );
    vGrad.addColorStop(0, 'rgba(244, 63, 94, 0)');
    vGrad.addColorStop(1, 'rgba(244, 63, 94, 0.22)');
    this.vignetteGrad = vGrad;

    if (this.mouseScreenX === 0 && this.mouseScreenY === 0) {
      this.mouseScreenX = this.width * 0.68;
      this.mouseScreenY = this.height * 0.5;
    }
    this.needsFrozenRender = true;
    if (this.phase === 'paused' || this.phase === 'upgrade' || this.phase === 'gameover') {
      this.render();
    }
  }

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: this.camX + (sx - this.width * 0.5),
      y: this.camY + (sy - this.height * 0.5),
    };
  }

  private clearInputs(): void {
    this.keysHeld.clear();
    this.mouseDown = false;
    this.dashBuffer = 0;
    this.novaBuffer = 0;
  }

  private onWindowBlur = (): void => {
    this.clearInputs();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.clearInputs();
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseScreenX = e.clientX - rect.left;
    this.mouseScreenY = e.clientY - rect.top;
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.sound.unlock();
    const rect = this.canvas.getBoundingClientRect();
    this.mouseScreenX = e.clientX - rect.left;
    this.mouseScreenY = e.clientY - rect.top;

    if (this.phase !== 'playing') return;

    if (e.button === 0) {
      this.mouseDown = true;
    } else if (e.button === 2) {
      this.dashBuffer = 0.13;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.mouseDown = false;
    }
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const code = e.code;

    if (code === 'Space' || code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight') {
      if (this.phase === 'playing' || this.phase === 'title') {
        e.preventDefault();
      }
    }

    if (code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (this.phase === 'title') {
      if (code === 'Enter' || code === 'Space') {
        this.startNewRun(this.difficulty);
      }
      return;
    }

    if (this.phase === 'playing') {
      if (code === 'Escape' || code === 'KeyP') {
        this.pauseGame();
        return;
      }
      if (code === 'KeyR') {
        this.startNewRun(this.difficulty);
        return;
      }
      this.keysHeld.add(code);
      if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
        this.dashBuffer = 0.13;
      }
      if (code === 'KeyQ' || code === 'KeyE') {
        this.novaBuffer = 0.13;
      }
      return;
    }

    if (this.phase === 'paused') {
      if (code === 'Escape' || code === 'KeyP') {
        this.resumeGame();
      } else if (code === 'KeyR') {
        this.startNewRun(this.difficulty);
      }
      return;
    }

    if (this.phase === 'upgrade') {
      if (code === 'Digit1' && this.upgradeChoices[0]) {
        this.selectUpgrade(this.upgradeChoices[0].id);
      } else if (code === 'Digit2' && this.upgradeChoices[1]) {
        this.selectUpgrade(this.upgradeChoices[1].id);
      } else if (code === 'Digit3' && this.upgradeChoices[2]) {
        this.selectUpgrade(this.upgradeChoices[2].id);
      }
      return;
    }

    if (this.phase === 'gameover') {
      if (code === 'Enter' || code === 'KeyR') {
        this.startNewRun(this.difficulty);
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  // Public Controls
  setDifficulty(diff: Difficulty): void {
    this.difficulty = diff;
  }

  getDifficulty(): Difficulty {
    return this.difficulty;
  }

  toggleMute(): boolean {
    const muted = this.sound.toggleMute();
    this.emitHud(true);
    return muted;
  }

  startNewRun(difficulty: Difficulty = this.difficulty): void {
    this.sound.unlock();
    this.sound.resume();
    this.difficulty = difficulty;
    this.endlessMode = false;
    this.outcome = null;
    this.defeatBeatTimer = 0;
    this.hitstop = 0;
    this.timeScale = 1;
    this.trauma = 0;

    this.upgrades = createInitialUpgrades();
    this.stats = computePlayerStats(this.upgrades, this.difficulty);

    this.player.x = 0;
    this.player.y = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.angle = 0;
    this.player.hp = this.stats.maxHp;
    this.player.ghostHp = this.stats.maxHp;
    this.player.invulnTimer = 1.8;
    this.player.hitFlash = 0;
    this.player.fireCooldown = 0;
    this.player.dashCooldownTimer = 0;
    this.player.dashActiveTimer = 0;
    this.player.scaleX = 1;
    this.player.scaleY = 1;
    this.player.novaCharge = 40;
    this.player.exhaustTimer = 0;

    this.camX = 0;
    this.camY = 0;

    this.enemies = [];
    this.nextEnemyId = 1;
    this.particles.clear();
    this.projectiles.clear();
    this.orbs.clear();
    this.afterimages.clear();
    this.callouts.clear();
    for (const r of this.novaRings) r.active = false;

    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.enemiesDefeated = 0;
    this.shotsReflected = 0;
    this.runElapsed = 0;
    this.damageTaken = 0;
    this.upgradeChoices = [];

    this.startWave(1);
    this.phase = 'playing';
    this.clearInputs();
    this.blurFocusedButton();
    this.canvas.focus({ preventScroll: true });
    this.syncBodyDataset();
    this.emitHud(true);
    this.ensureLoopRunning();
  }

  continueEndless(): void {
    if (this.phase !== 'gameover' || this.outcome !== 'victory') return;
    this.endlessMode = true;
    this.outcome = null;
    this.phase = 'playing';
    this.startWave(this.wave + 1);
    this.clearInputs();
    this.blurFocusedButton();
    this.canvas.focus({ preventScroll: true });
    this.syncBodyDataset();
    this.emitHud(true);
    this.ensureLoopRunning();
  }

  pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.needsFrozenRender = true;
    this.clearInputs();
    this.sound.suspend();
    this.syncBodyDataset();
    this.emitHud(true);
    this.render();
    this.stopLoop();
  }

  resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.clearInputs();
    this.sound.resume();
    this.blurFocusedButton();
    this.canvas.focus({ preventScroll: true });
    this.syncBodyDataset();
    this.emitHud(true);
    this.ensureLoopRunning();
  }

  returnToTitle(): void {
    this.phase = 'title';
    this.outcome = null;
    this.defeatBeatTimer = 0;
    this.clearInputs();
    this.sound.suspend();
    this.enemies = [];
    this.projectiles.clear();
    this.orbs.clear();
    this.syncBodyDataset();
    this.emitHud(true);
    this.ensureLoopRunning();
  }

  selectUpgrade(id: UpgradeId): void {
    if (this.phase !== 'upgrade') return;
    this.upgrades[id] = (this.upgrades[id] || 0) + 1;
    const prevMaxHp = this.stats.maxHp;
    this.stats = computePlayerStats(this.upgrades, this.difficulty);

    if (id === 'hull_plating') {
      const gained = this.stats.maxHp - prevMaxHp;
      this.player.hp = Math.min(this.stats.maxHp, this.player.hp + gained + 2);
      this.player.ghostHp = Math.max(this.player.ghostHp, this.player.hp);
    }

    this.sound.playPickup();
    this.upgradeChoices = [];
    this.phase = 'playing';
    this.startWave(this.wave + 1);
    this.clearInputs();
    this.blurFocusedButton();
    this.canvas.focus({ preventScroll: true });
    this.syncBodyDataset();
    this.emitHud(true);
    this.ensureLoopRunning();
  }

  private blurFocusedButton(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== this.canvas) {
      active.blur();
    }
  }

  private syncBodyDataset(): void {
    // Map 'upgrade' to 'playing' in dataset.state if needed, or expose substate cleanly:
    // Standard values: 'title', 'playing', 'paused', 'gameover'
    if (this.phase === 'upgrade') {
      document.body.dataset.state = 'playing';
      document.body.dataset.substate = 'upgrade';
    } else {
      document.body.dataset.state = this.phase;
      delete document.body.dataset.substate;
    }
    if (this.phase === 'gameover' && this.outcome) {
      document.body.dataset.outcome = this.outcome;
    } else {
      delete document.body.dataset.outcome;
    }
  }

  private startWave(waveNum: number): void {
    this.wave = waveNum;
    this.wavePlan = buildWavePlan(waveNum, this.difficulty);
    this.waveSpawnRemaining = this.wavePlan.spawnBudget;
    this.waveSpawnTimer = waveNum === 1 ? 2.0 : 0.9; // Approachable opening window
    this.bossSpawnedForWave = false;
    this.waveClearDelay = 0;

    if (waveNum > 1) {
      this.callouts.spawn(this.player.x, this.player.y - 42, `WAVE ${waveNum}`, '#fbbf24', 1.25);
    }
  }

  private loop = (timestamp: number): void => {
    this.rafId = 0;
    const rawDt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    const dt = Math.min(Math.max(rawDt, 0.0001), 0.05);

    if (this.phase === 'paused' || this.phase === 'upgrade' || this.phase === 'gameover') {
      if (this.needsFrozenRender) {
        this.needsFrozenRender = false;
        this.render();
      }
      return;
    }

    this.needsFrozenRender = true;
    this.update(dt);
    this.render();

    if (this.phase === 'title' || this.phase === 'playing') {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  private update(dt: number): void {
    // Trauma & hitstop decay in real dt
    this.trauma = Math.max(0, this.trauma - dt * 1.9);

    if (this.phase === 'title') {
      this.updateTitleScene(dt);
      return;
    }

    if (this.phase === 'paused' || this.phase === 'upgrade' || this.phase === 'gameover') {
      return;
    }

    // Defeat slow-mo beat before Game Over modal
    if (this.defeatBeatTimer > 0) {
      this.defeatBeatTimer -= dt;
      this.updateParticlesAndCosmetics(dt * 0.35);
      if (this.defeatBeatTimer <= 0) {
        this.finalizeRun('defeat');
      }
      return;
    }

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.updateParticlesAndCosmetics(dt * 0.15);
      return;
    }

    const simDt = dt * this.timeScale;
    this.runElapsed += simDt;

    this.updatePlayer(simDt);
    this.updateWaves(simDt);
    this.updateEnemies(simDt);
    this.updateProjectiles(simDt);
    this.updateOrbs(simDt);
    this.updateParticlesAndCosmetics(simDt);
    this.updateCamera(simDt);
    this.updateDirectBars();

    // Combo decay
    if (this.combo > 1) {
      this.comboTimer -= simDt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.comboTimer = 0;
      }
    }

    // Ghost HP trailing bar
    if (this.player.ghostHp > this.player.hp) {
      this.player.ghostHp = Math.max(this.player.hp, this.player.ghostHp - simDt * 1.8);
    } else {
      this.player.ghostHp = this.player.hp;
    }

    this.emitHud(false);
  }

  private updateTitleScene(dt: number): void {
    this.titleTime += dt;
    this.camX = Math.sin(this.titleTime * 0.18) * 340;
    this.camY = Math.cos(this.titleTime * 0.13) * 190;

    for (const g of this.titleGliders) {
      g.phase += dt * 1.4;
      const turn = Math.sin(g.phase) * 0.65;
      const speed = 220;
      const targetAngle = g.angle + turn * dt;
      g.angle = targetAngle;
      g.vx = Math.cos(g.angle) * speed;
      g.vy = Math.sin(g.angle) * speed;
      g.x += g.vx * dt;
      g.y += g.vy * dt;

      if (g.x > ARENA_WIDTH * 0.5) g.x = -ARENA_WIDTH * 0.5;
      if (g.x < -ARENA_WIDTH * 0.5) g.x = ARENA_WIDTH * 0.5;
      if (g.y > ARENA_HEIGHT * 0.5) g.y = -ARENA_HEIGHT * 0.5;
      if (g.y < -ARENA_HEIGHT * 0.5) g.y = ARENA_HEIGHT * 0.5;

      if (Math.random() < 0.45) {
        this.particles.spawn(
          g.x - Math.cos(g.angle) * 14,
          g.y - Math.sin(g.angle) * 14,
          -g.vx * 0.12 + (Math.random() - 0.5) * 20,
          -g.vy * 0.12 + (Math.random() - 0.5) * 20,
          0.42,
          3.2,
          0.2,
          g.color,
          0.93,
          0
        );
      }
    }

    this.updateParticlesAndCosmetics(dt);
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.dashCooldownTimer = Math.max(0, p.dashCooldownTimer - dt);
    this.dashBuffer = Math.max(0, this.dashBuffer - dt);
    this.novaBuffer = Math.max(0, this.novaBuffer - dt);

    // Relax squash & stretch smoothly
    p.scaleX += (1 - p.scaleX) * Math.min(1, dt * 14);
    p.scaleY += (1 - p.scaleY) * Math.min(1, dt * 14);

    // Directional input
    let ix = 0;
    let iy = 0;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) iy -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) iy += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) ix -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) ix += 1;

    const len = Math.hypot(ix, iy);
    if (len > 0) {
      ix /= len;
      iy /= len;
    }

    // Aim vector toward cursor in world space
    const worldAim = this.screenToWorld(
      this.mouseScreenX + this.canvas.getBoundingClientRect().left,
      this.mouseScreenY + this.canvas.getBoundingClientRect().top
    );
    const aimDx = worldAim.x - p.x;
    const aimDy = worldAim.y - p.y;
    const aimDist = Math.hypot(aimDx, aimDy);
    if (aimDist > 4) {
      p.angle = Math.atan2(aimDy, aimDx);
    }

    // Dash Execution (buffered)
    if (this.dashBuffer > 0 && p.dashCooldownTimer <= 0 && p.dashActiveTimer <= 0) {
      this.dashBuffer = 0;
      p.dashActiveTimer = 0.21;
      p.dashCooldownTimer = this.stats.dashCooldown;
      p.invulnTimer = Math.max(p.invulnTimer, 0.28);

      if (len > 0) {
        p.dashDirX = ix;
        p.dashDirY = iy;
      } else {
        p.dashDirX = Math.cos(p.angle);
        p.dashDirY = Math.sin(p.angle);
      }

      p.scaleX = 1.38;
      p.scaleY = 0.68;
      this.trauma = Math.min(1, this.trauma + 0.22);
      this.sound.playDash();

      for (let i = 0; i < 10; i++) {
        const spread = (Math.random() - 0.5) * 1.1;
        const backAngle = Math.atan2(-p.dashDirY, -p.dashDirX) + spread;
        const spd = 120 + Math.random() * 210;
        this.particles.spawn(
          p.x,
          p.y,
          Math.cos(backAngle) * spd,
          Math.sin(backAngle) * spd,
          0.32,
          4.5,
          0.2,
          '#fbbf24',
          0.9,
          1,
          backAngle
        );
      }
    }

    // Nova Burst (buffered)
    if (this.novaBuffer > 0 && p.novaCharge >= 100) {
      this.novaBuffer = 0;
      this.triggerNovaBurst();
    }

    const prevX = p.x;
    const prevY = p.y;

    if (p.dashActiveTimer > 0) {
      p.dashActiveTimer -= dt;
      const dashSpeed = 1040;
      p.vx = p.dashDirX * dashSpeed;
      p.vy = p.dashDirY * dashSpeed;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (Math.random() < 0.85) {
        this.afterimages.spawn(p.x, p.y, Math.atan2(p.dashDirY, p.dashDirX), 0.22, '#f59e0b');
      }

      this.processDashCollisions(prevX, prevY, p.x, p.y);
    } else {
      // Smooth responsive thruster physics
      const targetVx = ix * this.stats.moveSpeed;
      const targetVy = iy * this.stats.moveSpeed;
      const accel = len > 0 ? 13 : 8.5;
      p.vx += (targetVx - p.vx) * Math.min(1, dt * accel);
      p.vy += (targetVy - p.vy) * Math.min(1, dt * accel);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Thruster exhaust particles proportional to velocity
      const speed = Math.hypot(p.vx, p.vy);
      p.exhaustTimer -= dt;
      if (speed > 45 && p.exhaustTimer <= 0) {
        p.exhaustTimer = 0.028;
        const backX = p.x - Math.cos(p.angle) * 14;
        const backY = p.y - Math.sin(p.angle) * 14;
        this.particles.spawn(
          backX,
          backY,
          -p.vx * 0.22 + (Math.random() - 0.5) * 30,
          -p.vy * 0.22 + (Math.random() - 0.5) * 30,
          0.26,
          3.4,
          0.2,
          '#38bdf8',
          0.92,
          0
        );
      }
    }

    const clamped = clampToArena(p.x, p.y, p.radius + 8);
    p.x = clamped.x;
    p.y = clamped.y;

    // Primary Fire (Mouse Hold or J key)
    const firing = this.mouseDown || this.keysHeld.has('KeyJ');
    if (firing && p.fireCooldown <= 0 && p.dashActiveTimer <= 0) {
      p.fireCooldown = 1 / this.stats.fireRate;
      this.firePlayerCannon();
    }
  }

  private firePlayerCannon(): void {
    const p = this.player;
    const count = this.stats.projectileCount;
    const spreadStep = 0.095;
    const baseAngle = p.angle;
    const muzzleDist = 20;

    p.scaleX = 0.91;
    p.scaleY = 1.09;
    this.sound.playShot();

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) * 0.5) * spreadStep;
      const a = baseAngle + offset;
      const sx = p.x + Math.cos(a) * muzzleDist;
      const sy = p.y + Math.sin(a) * muzzleDist;
      const speed = 880;
      this.projectiles.spawn(
        true,
        sx,
        sy,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        5.5,
        this.stats.projectileDamage,
        1.15,
        '#f8fafc',
        0,
        false
      );
    }

    // Muzzle flash sparks (light event: 3 particles)
    const mx = p.x + Math.cos(baseAngle) * muzzleDist;
    const my = p.y + Math.sin(baseAngle) * muzzleDist;
    for (let i = 0; i < 3; i++) {
      const a = baseAngle + (Math.random() - 0.5) * 0.6;
      const spd = 140 + Math.random() * 140;
      this.particles.spawn(mx, my, Math.cos(a) * spd, Math.sin(a) * spd, 0.14, 3, 0, '#fbbf24', 0.88, 1, a);
    }
  }

  private processDashCollisions(x1: number, y1: number, x2: number, y2: number): void {
    // 1. Reflect nearby enemy projectiles along dash sweep
    const items = this.projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const pr = items[i];
      if (!pr.active || pr.fromPlayer) continue;
      if (segmentCircleIntersect(x1, y1, x2, y2, pr.x, pr.y, pr.radius + 36)) {
        pr.fromPlayer = true;
        pr.reflected = true;
        pr.color = '#fbbf24';
        pr.damage = Math.round(this.stats.projectileDamage * this.stats.reflectMultiplier);
        pr.radius = 8;
        pr.life = 1.6;
        pr.maxLife = 1.6;
        pr.pierce = 1;

        // Steer reflected projectile toward nearest enemy or reverse direction
        const target = this.findNearestEnemy(pr.x, pr.y);
        const speed = Math.max(820, Math.hypot(pr.vx, pr.vy) * 1.8);
        if (target) {
          const a = Math.atan2(target.y - pr.y, target.x - pr.x);
          pr.vx = Math.cos(a) * speed;
          pr.vy = Math.sin(a) * speed;
        } else {
          pr.vx = -pr.vx * 1.8;
          pr.vy = -pr.vy * 1.8;
        }

        this.shotsReflected += 1;
        this.player.novaCharge = Math.min(100, this.player.novaCharge + 6 * this.stats.novaChargeGain);
        this.sound.playReflect();
        this.callouts.spawn(pr.x, pr.y - 12, 'REFLECT', '#fbbf24', 0.95);
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2;
          this.particles.spawn(pr.x, pr.y, Math.cos(a) * 180, Math.sin(a) * 180, 0.25, 4, 0, '#fbbf24', 0.9, 2);
        }
      }
    }

    // 2. Slash enemies along dash path
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.state === 'ko' || e.hitFlash > 0.08) continue;
      if (segmentCircleIntersect(x1, y1, x2, y2, e.x, e.y, e.radius + 26)) {
        const killed = this.damageEnemy(e, this.stats.dashDamage, this.player.dashDirX * 360, this.player.dashDirY * 360, true);
        if (killed) {
          // Refund 55% of dash cooldown on Dash Kill
          this.player.dashCooldownTimer = Math.max(0, this.player.dashCooldownTimer - this.stats.dashCooldown * 0.55);
        }
      }
    }
  }

  private triggerNovaBurst(): void {
    const p = this.player;
    p.novaCharge = 0;
    p.invulnTimer = Math.max(p.invulnTimer, 0.45);
    this.hitstop = Math.max(this.hitstop, 0.055);
    this.trauma = Math.min(1, this.trauma + 0.55);
    this.sound.playNova();

    this.spawnNovaRing(p.x, p.y, 460, '#fbbf24');

    // Convert enemy bullets within 460px into energy orbs
    for (let i = 0; i < this.projectiles.items.length; i++) {
      const pr = this.projectiles.items[i];
      if (!pr.active || pr.fromPlayer) continue;
      const dist = Math.hypot(pr.x - p.x, pr.y - p.y);
      if (dist <= 460) {
        pr.active = false;
        this.orbs.spawn(pr.x, pr.y, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 1);
      }
    }

    // Blast nearby enemies
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.state === 'ko') continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 460) {
        const nx = dist > 1 ? dx / dist : 1;
        const ny = dist > 1 ? dy / dist : 0;
        this.damageEnemy(e, 75 + this.wave * 10, nx * 420, ny * 420, true);
      }
    }

    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const spd = 280 + Math.random() * 240;
      this.particles.spawn(p.x, p.y, Math.cos(a) * spd, Math.sin(a) * spd, 0.42, 6, 0.5, '#fbbf24', 0.92, 1, a);
    }
  }

  private spawnNovaRing(x: number, y: number, maxRadius: number, color: string): void {
    for (const r of this.novaRings) {
      if (!r.active) {
        r.active = true;
        r.x = x;
        r.y = y;
        r.radius = 20;
        r.maxRadius = maxRadius;
        r.life = 0.36;
        r.maxLife = 0.36;
        r.color = color;
        return;
      }
    }
  }

  private updateWaves(dt: number): void {
    const aliveCount = this.enemies.filter((e) => e.state !== 'ko').length;

    if (this.wavePlan.hasBoss && !this.bossSpawnedForWave && this.waveSpawnRemaining <= Math.floor(this.wavePlan.spawnBudget * 0.5)) {
      this.bossSpawnedForWave = true;
      this.spawnEnemy('titan');
    }

    if (this.waveSpawnRemaining > 0 && aliveCount < this.wavePlan.maxConcurrent) {
      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0) {
        this.waveSpawnTimer = this.wavePlan.spawnInterval;
        const kind = pickEnemyArchetype(this.wavePlan);
        this.spawnEnemy(kind);
        this.waveSpawnRemaining -= 1;
      }
    }

    // Check Wave Clear
    if (this.waveSpawnRemaining <= 0 && aliveCount === 0 && (!this.wavePlan.hasBoss || this.bossSpawnedForWave)) {
      this.waveClearDelay += dt;
      if (this.waveClearDelay >= 0.75) {
        this.waveClearDelay = 0;
        if (!this.endlessMode && this.wave >= TARGET_VICTORY_WAVE) {
          this.finalizeRun('victory');
          return;
        }
        const choices = pickUpgradeChoices(this.upgrades);
        if (choices.length > 0) {
          this.upgradeChoices = choices;
          this.phase = 'upgrade';
          this.clearInputs();
          this.sound.playFanfare();
          this.syncBodyDataset();
          this.emitHud(true);
        } else {
          this.sound.playFanfare();
          this.startWave(this.wave + 1);
        }
      }
    }
  }

  private spawnEnemy(kind: EnemyKind): void {
    // Spawn around a safe ring outside player immediate radius (560-720px away), clamped inside arena
    const angle = Math.random() * Math.PI * 2;
    const dist = 560 + Math.random() * 160;
    const rawX = this.player.x + Math.cos(angle) * dist;
    const rawY = this.player.y + Math.sin(angle) * dist;
    const clamped = clampToArena(rawX, rawY, 60);

    const sMult = this.wavePlan.speedMultiplier;
    const hpMult = 1 + (this.wave - 1) * 0.14;

    let radius = 16;
    let hp = 32 * hpMult;
    let speed = 195 * sMult;
    let scoreValue = 100;

    if (kind === 'lancer') {
      radius = 18;
      hp = 46 * hpMult;
      speed = 175 * sMult;
      scoreValue = 160;
    } else if (kind === 'bastion') {
      radius = 25;
      hp = 92 * hpMult;
      speed = 110 * sMult;
      scoreValue = 240;
    } else if (kind === 'weaver') {
      radius = 19;
      hp = 54 * hpMult;
      speed = 148 * sMult;
      scoreValue = 200;
    } else if (kind === 'titan') {
      radius = 48;
      hp = (440 + this.wave * 95) * (this.difficulty === 'ace' ? 1.2 : 1.0);
      speed = 92 * sMult;
      scoreValue = 1500;
      this.callouts.spawn(clamped.x, clamped.y - 60, 'SOLAR TITAN', '#f43f5e', 1.35);
      this.sound.playTelegraph();
    }

    this.enemies.push({
      id: this.nextEnemyId++,
      kind,
      x: clamped.x,
      y: clamped.y,
      vx: 0,
      vy: 0,
      angle: Math.atan2(this.player.y - clamped.y, this.player.x - clamped.x),
      radius,
      hp,
      maxHp: hp,
      speed,
      scoreValue,
      hitFlash: 0,
      state: 'chase',
      stateTimer: 0,
      cooldown: 0.7 + Math.random() * 1.1,
      hasToken: false,
      aimX: this.player.x,
      aimY: this.player.y,
      koDuration: kind === 'titan' ? 0.65 : 0.28,
      phaseOffset: Math.random() * Math.PI * 2,
      shieldAngle: 0,
    });
  }

  private countActiveTokens(): number {
    let count = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].hasToken) count++;
    }
    return count;
  }

  private updateEnemies(dt: number): void {
    this.enemyGrid.clear();
    const p = this.player;

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.state !== 'ko') {
        this.enemyGrid.insert(i, e.x, e.y);
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.hitFlash = Math.max(0, e.hitFlash - dt);

      if (e.state === 'ko') {
        e.stateTimer -= dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx *= 0.92;
        e.vy *= 0.92;
        e.angle += dt * 11;
        if (e.stateTimer <= 0) {
          this.enemies.splice(i, 1);
        }
        continue;
      }

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / dist;
      const ny = dy / dist;

      e.cooldown = Math.max(0, e.cooldown - dt);

      // Soft separation via spatial hash grid
      let sepX = 0;
      let sepY = 0;
      this.enemyGrid.queryRadius(e.x, e.y, e.radius * 2.6, this.nearbyIndices);
      for (let k = 0; k < this.nearbyIndices.length; k++) {
        const j = this.nearbyIndices[k];
        if (j === i) continue;
        const other = this.enemies[j];
        if (!other || other.state === 'ko') continue;
        const sdx = e.x - other.x;
        const sdy = e.y - other.y;
        const sdist = Math.hypot(sdx, sdy);
        const minD = e.radius + other.radius + 8;
        if (sdist > 0.1 && sdist < minD) {
          const push = (minD - sdist) / minD;
          sepX += (sdx / sdist) * push * 220;
          sepY += (sdy / sdist) * push * 220;
        }
      }

      if (e.kind === 'skirmisher') {
        // Policy 1: Flanking swarmer with sinusoidal curve
        const flankSign = e.id % 2 === 0 ? 1 : -1;
        const perpX = -ny * flankSign;
        const perpY = nx * flankSign;
        const weave = Math.sin(this.runElapsed * 3.2 + e.phaseOffset) * 0.55;
        const desiredVx = (nx * 0.82 + perpX * (0.45 + weave)) * e.speed + sepX;
        const desiredVy = (ny * 0.82 + perpY * (0.45 + weave)) * e.speed + sepY;
        e.vx += (desiredVx - e.vx) * Math.min(1, dt * 6);
        e.vy += (desiredVy - e.vy) * Math.min(1, dt * 6);
        e.angle = Math.atan2(e.vy, e.vx);
      } else if (e.kind === 'lancer') {
        // Policy 2: Line-of-sight charger with visible sight-line windup
        if (e.state === 'chase') {
          const desiredVx = nx * e.speed + sepX;
          const desiredVy = ny * e.speed + sepY;
          e.vx += (desiredVx - e.vx) * Math.min(1, dt * 5);
          e.vy += (desiredVy - e.vy) * Math.min(1, dt * 5);
          e.angle = Math.atan2(dy, dx);
          if (dist < 430 && e.cooldown <= 0 && this.countActiveTokens() < MAX_ATTACK_TOKENS) {
            e.state = 'windup';
            e.stateTimer = 0.58;
            e.hasToken = true;
            e.aimX = p.x;
            e.aimY = p.y;
            e.vx *= 0.2;
            e.vy *= 0.2;
            this.sound.playTelegraph();
          }
        } else if (e.state === 'windup') {
          e.stateTimer -= dt;
          e.vx *= 0.88;
          e.vy *= 0.88;
          e.angle = Math.atan2(e.aimY - e.y, e.aimX - e.x);
          if (e.stateTimer <= 0) {
            e.state = 'attack';
            e.stateTimer = 0.36;
            const dashSpd = 820 * this.wavePlan.speedMultiplier;
            e.vx = Math.cos(e.angle) * dashSpd;
            e.vy = Math.sin(e.angle) * dashSpd;
          }
        } else if (e.state === 'attack') {
          e.stateTimer -= dt;
          if (Math.random() < 0.7) {
            this.particles.spawn(e.x, e.y, -e.vx * 0.15, -e.vy * 0.15, 0.22, 4, 0.2, '#f43f5e', 0.9, 1, e.angle);
          }
          if (e.stateTimer <= 0) {
            e.hasToken = false;
            e.state = 'recover';
            e.stateTimer = 0.55;
            e.cooldown = 2.0;
          }
        } else {
          e.stateTimer -= dt;
          e.vx *= 0.9;
          e.vy *= 0.9;
          if (e.stateTimer <= 0) e.state = 'chase';
        }
      } else if (e.kind === 'bastion') {
        // Policy 3: Shielded orbiter with directional front armor & 3-way fan volley
        const idealDist = 310;
        const radialPush = dist > idealDist + 40 ? 0.7 : dist < idealDist - 40 ? -0.6 : 0;
        const orbitDir = e.id % 2 === 0 ? 1 : -1;
        const desiredVx = (nx * radialPush - ny * orbitDir * 0.75) * e.speed + sepX;
        const desiredVy = (ny * radialPush + nx * orbitDir * 0.75) * e.speed + sepY;
        e.vx += (desiredVx - e.vx) * Math.min(1, dt * 4);
        e.vy += (desiredVy - e.vy) * Math.min(1, dt * 4);

        const targetAngle = Math.atan2(dy, dx);
        let angleDiff = targetAngle - e.shieldAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        e.shieldAngle += angleDiff * Math.min(1, dt * 2.2);
        e.angle = e.shieldAngle;

        if (e.state === 'chase' && e.cooldown <= 0 && dist < 560 && this.countActiveTokens() < MAX_ATTACK_TOKENS) {
          e.state = 'windup';
          e.stateTimer = 0.48;
          e.hasToken = true;
          this.sound.playTelegraph();
        } else if (e.state === 'windup') {
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.hasToken = false;
            e.state = 'chase';
            e.cooldown = 2.4;
            const aim = Math.atan2(p.y - e.y, p.x - e.x);
            for (let s = -1; s <= 1; s++) {
              const a = aim + s * 0.22;
              this.projectiles.spawn(false, e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24, Math.cos(a) * 340, Math.sin(a) * 340, 6.5, 1, 3.0, '#fb7185');
            }
          }
        }
      } else if (e.kind === 'weaver') {
        // Policy 4: Kiter / Prism caster with expanding target ring telegraph
        const kiteDir = dist < 290 ? -1 : dist > 440 ? 0.85 : 0;
        const strafe = Math.sin(this.runElapsed * 1.8 + e.phaseOffset);
        const desiredVx = (nx * kiteDir - ny * strafe * 0.7) * e.speed + sepX;
        const desiredVy = (ny * kiteDir + nx * strafe * 0.7) * e.speed + sepY;
        e.vx += (desiredVx - e.vx) * Math.min(1, dt * 4.5);
        e.vy += (desiredVy - e.vy) * Math.min(1, dt * 4.5);
        e.angle += dt * 1.6;

        if (e.state === 'chase' && e.cooldown <= 0 && dist < 640 && this.countActiveTokens() < MAX_ATTACK_TOKENS) {
          e.state = 'windup';
          e.stateTimer = 0.56;
          e.hasToken = true;
          this.sound.playTelegraph();
        } else if (e.state === 'windup') {
          e.stateTimer -= dt;
          e.vx *= 0.85;
          e.vy *= 0.85;
          if (e.stateTimer <= 0) {
            e.hasToken = false;
            e.state = 'chase';
            e.cooldown = 2.6;
            const bolts = 6;
            for (let b = 0; b < bolts; b++) {
              const a = e.angle + (b / bolts) * Math.PI * 2;
              this.projectiles.spawn(false, e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, Math.cos(a) * 290, Math.sin(a) * 290, 6, 1, 3.2, '#f43f5e');
            }
          }
        }
      } else if (e.kind === 'titan') {
        // Boss: Solar Dreadnought
        const desiredVx = nx * e.speed + sepX * 0.3;
        const desiredVy = ny * e.speed + sepY * 0.3;
        e.vx += (desiredVx - e.vx) * Math.min(1, dt * 2.5);
        e.vy += (desiredVy - e.vy) * Math.min(1, dt * 2.5);
        e.angle = Math.atan2(dy, dx);

        if (e.state === 'chase' && e.cooldown <= 0) {
          e.state = 'windup';
          e.stateTimer = 0.65;
          this.sound.playTelegraph();
        } else if (e.state === 'windup') {
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = 'chase';
            e.cooldown = 1.85;
            const ringCount = 12;
            const base = e.angle;
            for (let b = 0; b < ringCount; b++) {
              const a = base + (b / ringCount) * Math.PI * 2;
              this.projectiles.spawn(false, e.x + Math.cos(a) * 42, e.y + Math.sin(a) * 42, Math.cos(a) * 320, Math.sin(a) * 320, 7.5, 1, 3.4, '#f43f5e');
            }
          }
        }
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      const clamped = clampToArena(e.x, e.y, e.radius + 10);
      e.x = clamped.x;
      e.y = clamped.y;

      // Contact damage with player (unless player dashing or invulnerable)
      if (p.invulnTimer <= 0 && p.dashActiveTimer <= 0 && this.defeatBeatTimer <= 0) {
        const hitDist = e.radius + p.radius - 3;
        if (dx * dx + dy * dy <= hitDist * hitDist) {
          this.hurtPlayer(e.x, e.y);
        }
      }
    }
  }

  private updateProjectiles(dt: number): void {
    const items = this.projectiles.items;
    const p = this.player;

    for (let i = 0; i < items.length; i++) {
      const pr = items[i];
      if (!pr.active) continue;

      pr.life -= dt;
      if (pr.life <= 0) {
        pr.active = false;
        continue;
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      const halfW = ARENA_WIDTH * 0.5;
      const halfH = ARENA_HEIGHT * 0.5;
      if (pr.x < -halfW || pr.x > halfW || pr.y < -halfH || pr.y > halfH) {
        pr.active = false;
        continue;
      }

      if (pr.fromPlayer) {
        this.enemyGrid.queryRadius(pr.x, pr.y, pr.radius + 54, this.nearbyIndices);
        for (let k = 0; k < this.nearbyIndices.length; k++) {
          const e = this.enemies[this.nearbyIndices[k]];
          if (!e || e.state === 'ko') continue;
          const dx = pr.x - e.x;
          const dy = pr.y - e.y;
          const hitR = pr.radius + e.radius;
          if (dx * dx + dy * dy <= hitR * hitR) {
            // Check Bastion directional front shield for non-reflected shots
            let dmg = pr.damage;
            let blocked = false;
            if (e.kind === 'bastion' && !pr.reflected) {
              const incomingAngle = Math.atan2(pr.y - e.y, pr.x - e.x);
              let diff = incomingAngle - e.shieldAngle;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              if (Math.abs(diff) < 1.05) {
                dmg = Math.max(3, Math.round(dmg * 0.25));
                blocked = true;
              }
            }

            this.damageEnemy(e, dmg, pr.vx * 0.1, pr.vy * 0.1, pr.reflected);
            if (blocked) {
              for (let s = 0; s < 4; s++) {
                const a = Math.random() * Math.PI * 2;
                this.particles.spawn(pr.x, pr.y, Math.cos(a) * 140, Math.sin(a) * 140, 0.18, 3, 0, '#38bdf8', 0.9, 1);
              }
            }

            if (pr.pierce > 0) {
              pr.pierce -= 1;
            } else {
              pr.active = false;
            }
            break;
          }
        }
      } else {
        // Enemy projectile vs player
        if (p.invulnTimer <= 0 && p.dashActiveTimer <= 0 && this.defeatBeatTimer <= 0) {
          const dx = pr.x - p.x;
          const dy = pr.y - p.y;
          const hitR = pr.radius + p.radius - 4;
          if (dx * dx + dy * dy <= hitR * hitR) {
            pr.active = false;
            this.hurtPlayer(pr.x, pr.y);
          }
        }
      }
    }
  }

  private damageEnemy(e: Enemy, amount: number, knockX: number, knockY: number, heavy: boolean): boolean {
    e.hp -= amount;
    e.hitFlash = 0.06;
    e.vx += knockX;
    e.vy += knockY;

    if (e.hp <= 0) {
      e.state = 'ko';
      e.stateTimer = e.koDuration;
      e.hasToken = false;

      const isBoss = e.kind === 'titan';
      this.enemiesDefeated += 1;
      this.combo = Math.min(MAX_COMBO, this.combo + 1);
      this.comboTimer = COMBO_DECAY_SECONDS;
      const gained = calculateKillScore(e.scoreValue, this.combo);
      this.score += gained;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        this.saveBestScore(this.bestScore);
      }

      this.player.novaCharge = Math.min(100, this.player.novaCharge + (isBoss ? 40 : 8) * this.stats.novaChargeGain);

      // Weight-scaled juice: hitstop + trauma + particle burst
      this.hitstop = Math.max(this.hitstop, isBoss ? 0.075 : heavy ? 0.045 : 0.025);
      this.trauma = Math.min(1, this.trauma + (isBoss ? 0.72 : heavy ? 0.34 : 0.16));
      this.sound.playKill(isBoss);

      const burstCount = isBoss ? 36 : 16;
      const burstColor = isBoss ? '#fbbf24' : '#f43f5e';
      for (let i = 0; i < burstCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 110 + Math.random() * (isBoss ? 380 : 240);
        this.particles.spawn(e.x, e.y, Math.cos(a) * spd, Math.sin(a) * spd, 0.38 + Math.random() * 0.22, isBoss ? 7 : 4.5, 0.2, i % 3 === 0 ? '#fbbf24' : burstColor, 0.91, i % 2 === 0 ? 1 : 2, a);
      }

      // Drop Energy Orbs
      const orbCount = isBoss ? 12 : e.kind === 'bastion' ? 3 : 2;
      for (let o = 0; o < orbCount; o++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 70 + Math.random() * 110;
        this.orbs.spawn(e.x, e.y, Math.cos(a) * spd, Math.sin(a) * spd, 1);
      }

      this.callouts.spawn(e.x, e.y - 16, `+${gained}`, this.combo >= 4 ? '#fbbf24' : '#f8fafc', isBoss ? 1.3 : 1);
      return true;
    } else {
      this.sound.playHit(heavy);
      if (heavy) {
        this.hitstop = Math.max(this.hitstop, 0.032);
        this.trauma = Math.min(1, this.trauma + 0.18);
      }
      for (let i = 0; i < (heavy ? 8 : 4); i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 90 + Math.random() * 140;
        this.particles.spawn(e.x, e.y, Math.cos(a) * spd, Math.sin(a) * spd, 0.22, 3.5, 0, '#fbbf24', 0.9, 1, a);
      }
      return false;
    }
  }

  private hurtPlayer(sourceX: number, sourceY: number): void {
    const p = this.player;
    p.hp = Math.max(0, p.hp - 1);
    this.damageTaken += 1;
    p.invulnTimer = 1.05;
    p.hitFlash = 0.18;
    p.scaleX = 1.3;
    p.scaleY = 0.72;
    this.combo = 1;
    this.comboTimer = 0;

    const dx = p.x - sourceX;
    const dy = p.y - sourceY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    p.vx += (dx / dist) * 340;
    p.vy += (dy / dist) * 340;

    this.hitstop = 0.06;
    this.trauma = Math.min(1, this.trauma + 0.65);
    this.sound.playPlayerHurt();

    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * 220;
      this.particles.spawn(p.x, p.y, Math.cos(a) * spd, Math.sin(a) * spd, 0.35, 5, 0.2, '#f43f5e', 0.9, 1, a);
    }

    if (p.hp <= 0) {
      this.defeatBeatTimer = 0.48;
      this.sound.playKill(true);
      this.emitHud(true);
    } else {
      this.emitHud(true);
    }
  }

  private finalizeRun(outcome: 'victory' | 'defeat'): void {
    this.phase = 'gameover';
    this.outcome = outcome;
    this.clearInputs();

    if (outcome === 'victory') {
      this.sound.playFanfare();
    } else {
      this.sound.playDefeat();
    }

    const boss = this.enemies.find((e) => e.kind === 'titan' && e.state !== 'ko');
    const bossHpRemainingPct = boss ? Math.max(0, Math.round((boss.hp / boss.maxHp) * 100)) : 0;

    const summary: RunSummary = {
      outcome,
      score: this.score,
      bestScore: this.bestScore,
      waveReached: this.wave,
      enemiesDefeated: this.enemiesDefeated,
      shotsReflected: this.shotsReflected,
      clearTimeSeconds: Math.round(this.runElapsed),
      damageTaken: this.damageTaken,
      bossHpRemainingPct,
      difficulty: this.difficulty,
    };

    this.syncBodyDataset();
    this.emitHud(true);
    this.callbacks.onRunEnd(summary);
  }

  private updateOrbs(dt: number): void {
    const p = this.player;
    const items = this.orbs.items;
    const magnetR = this.stats.magnetRadius;

    for (let i = 0; i < items.length; i++) {
      const o = items[i];
      if (!o.active) continue;
      o.life -= dt;
      if (o.life <= 0) {
        o.active = false;
        continue;
      }

      const dx = p.x - o.x;
      const dy = p.y - o.y;
      const dist = Math.hypot(dx, dy);
      if (dist < magnetR && dist > 0.1) {
        const pull = 580 * (1 - dist / magnetR) + 180;
        o.vx += ((dx / dist) * pull - o.vx) * Math.min(1, dt * 9);
        o.vy += ((dy / dist) * pull - o.vy) * Math.min(1, dt * 9);
      } else {
        o.vx *= 0.94;
        o.vy *= 0.94;
      }

      o.x += o.vx * dt;
      o.y += o.vy * dt;

      if (dist <= p.radius + 16) {
        o.active = false;
        this.score += 25 * this.combo;
        if (this.score > this.bestScore) {
          this.bestScore = this.score;
          this.saveBestScore(this.bestScore);
        }
        p.novaCharge = Math.min(100, p.novaCharge + 5 * this.stats.novaChargeGain);
        this.sound.playPickup();
      }
    }
  }

  private updateParticlesAndCosmetics(dt: number): void {
    const pItems = this.particles.items;
    for (let i = 0; i < pItems.length; i++) {
      const pt = pItems[i];
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        continue;
      }
      const damp = Math.pow(pt.drag, dt * 60);
      pt.vx *= damp;
      pt.vy *= damp;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }

    const aItems = this.afterimages.items;
    for (let i = 0; i < aItems.length; i++) {
      const a = aItems[i];
      if (!a.active) continue;
      a.life -= dt;
      if (a.life <= 0) a.active = false;
    }

    const cItems = this.callouts.items;
    for (let i = 0; i < cItems.length; i++) {
      const c = cItems[i];
      if (!c.active) continue;
      c.life -= dt;
      c.y += c.vy * dt;
      c.vy *= 0.94;
      if (c.life <= 0) c.active = false;
    }

    for (const r of this.novaRings) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      r.radius = 20 + (r.maxRadius - 20) * (1 - Math.pow(1 - progress, 3));
    }
  }

  private updateCamera(dt: number): void {
    // Subtle look-ahead toward mouse aim
    const lookX = (this.mouseScreenX - this.width * 0.5) * 0.14;
    const lookY = (this.mouseScreenY - this.height * 0.5) * 0.14;
    const targetX = this.player.x + lookX;
    const targetY = this.player.y + lookY;

    this.camX += (targetX - this.camX) * Math.min(1, dt * 8);
    this.camY += (targetY - this.camY) * Math.min(1, dt * 8);
  }

  private updateDirectBars(): void {
    if (this.dashBarEl) {
      const ready = 1 - Math.min(1, this.player.dashCooldownTimer / this.stats.dashCooldown);
      this.dashBarEl.style.transform = `scaleX(${ready.toFixed(3)})`;
    }
    if (this.novaBarEl) {
      const charge = Math.min(1, this.player.novaCharge / 100);
      this.novaBarEl.style.transform = `scaleX(${charge.toFixed(3)})`;
    }
  }

  private emitHud(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastHudEmitTime < 85) return;

    const boss = this.enemies.find((e) => e.kind === 'titan' && e.state !== 'ko');
    const enemiesRemaining = this.waveSpawnRemaining + this.enemies.filter((e) => e.state !== 'ko').length;
    const dashReadyRatio = 1 - Math.min(1, this.player.dashCooldownTimer / this.stats.dashCooldown);

    const key = [
      this.phase,
      this.outcome,
      this.player.hp,
      this.stats.maxHp,
      Math.round(this.player.ghostHp * 10),
      this.score,
      this.bestScore,
      this.combo,
      this.wave,
      enemiesRemaining,
      Math.round(this.player.novaCharge),
      boss ? Math.round(boss.hp) : -1,
      this.sound.isMuted(),
    ].join('|');

    if (!force && key === this.lastHudKey) return;
    this.lastHudKey = key;
    this.lastHudEmitTime = now;

    this.callbacks.onHudChange({
      phase: this.phase,
      outcome: this.outcome,
      hp: this.player.hp,
      maxHp: this.stats.maxHp,
      ghostHp: this.player.ghostHp,
      score: this.score,
      bestScore: this.bestScore,
      combo: this.combo,
      comboTimerRatio: this.combo > 1 ? Math.max(0, this.comboTimer / COMBO_DECAY_SECONDS) : 0,
      wave: this.wave,
      targetVictoryWave: TARGET_VICTORY_WAVE,
      enemiesRemaining,
      dashReadyRatio,
      novaCharge: Math.round(this.player.novaCharge),
      bossName: boss ? 'SOLAR TITAN' : null,
      bossHpRatio: boss ? Math.max(0, boss.hp / boss.maxHp) : 0,
      bossHpText: boss ? `${Math.max(0, Math.ceil(boss.hp))} / ${Math.round(boss.maxHp)}` : null,
      upgradeChoices: this.upgradeChoices,
      activeUpgrades: { ...this.upgrades },
      isMuted: this.sound.isMuted(),
    });
  }

  private findNearestEnemy(x: number, y: number): Enemy | null {
    let best: Enemy | null = null;
    let bestDistSq = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.state === 'ko') continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        best = e;
      }
    }
    return best;
  }

  // ==================== RENDERING ====================
  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Deep Atmospheric Twilight Sky Backdrop (60% calm background field)
    ctx.fillStyle = '#0b111e';
    ctx.fillRect(0, 0, this.width, this.height);

    // Cached radial solar horizon glow (zero allocation per frame)
    if (this.horizonGrad) {
      ctx.fillStyle = this.horizonGrad;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Camera Shake (trauma * trauma)
    const shakeMag = this.trauma * this.trauma * 18;
    const shakeX = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;
    const shakeY = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;

    // 2. Parallax Stars (world-space with depth factor)
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const sx = this.width * 0.5 + (s.x - this.camX * s.depth) + shakeX * 0.4;
      const sy = this.height * 0.5 + (s.y - this.camY * s.depth) + shakeY * 0.4;
      if (sx < -10 || sx > this.width + 10 || sy < -10 || sy > this.height + 10) continue;
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.warm ? '#fcd34d' : '#94a3b8';
      ctx.fillRect(sx, sy, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // Enter World Transform
    ctx.save();
    ctx.translate(this.width * 0.5 - this.camX + shakeX, this.height * 0.5 - this.camY + shakeY);

    // 3. Architectural Sky-Bastion Grid & Arena Boundary
    this.renderArenaGrid(ctx);

    // 4. Title-Screen Autonomous Gliders or Active Gameplay Entities
    if (this.phase === 'title') {
      this.renderTitleGliders(ctx);
      this.renderParticles(ctx);
    } else {
      this.renderOrbs(ctx);
      this.renderNovaRings(ctx);
      this.renderAfterimages(ctx);
      this.renderEnemies(ctx);
      this.renderPlayer(ctx);
      this.renderProjectiles(ctx);
      this.renderParticles(ctx);
      this.renderCallouts(ctx);
    }

    ctx.restore();

    // 5. Screen-space Reticle (in playing state) & Low-HP Peripheral Vignette
    if (this.phase === 'playing') {
      if (this.player.hp <= 2 && this.vignetteGrad) {
        const pulse = 0.65 + Math.sin(performance.now() * 0.008) * 0.35;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = this.vignetteGrad;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();
      }
      this.renderReticle(ctx);
    }

    ctx.restore();
  }

  private renderArenaGrid(ctx: CanvasRenderingContext2D): void {
    const halfW = ARENA_WIDTH * 0.5;
    const halfH = ARENA_HEIGHT * 0.5;
    const step = 140;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.065)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -halfW; x <= halfW; x += step) {
      ctx.moveTo(x, -halfH);
      ctx.lineTo(x, halfH);
    }
    for (let y = -halfH; y <= halfH; y += step) {
      ctx.moveTo(-halfW, y);
      ctx.lineTo(halfW, y);
    }
    ctx.stroke();

    // Crisp Gold Arena Boundary Frame
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.38)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-halfW, -halfH, ARENA_WIDTH, ARENA_HEIGHT);

    // Corner beacons
    const cLen = 36;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(-halfW, -halfH + cLen);
    ctx.lineTo(-halfW, -halfH);
    ctx.lineTo(-halfW + cLen, -halfH);
    // Top-right
    ctx.moveTo(halfW - cLen, -halfH);
    ctx.lineTo(halfW, -halfH);
    ctx.lineTo(halfW, -halfH + cLen);
    // Bottom-right
    ctx.moveTo(halfW, halfH - cLen);
    ctx.lineTo(halfW, halfH);
    ctx.lineTo(halfW - cLen, halfH);
    // Bottom-left
    ctx.moveTo(-halfW + cLen, halfH);
    ctx.lineTo(-halfW, halfH);
    ctx.lineTo(-halfW, halfH - cLen);
    ctx.stroke();
  }

  private renderTitleGliders(ctx: CanvasRenderingContext2D): void {
    for (const g of this.titleGliders) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      ctx.fillStyle = g.color;
      ctx.strokeStyle = '#0b111e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -11);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderOrbs(ctx: CanvasRenderingContext2D): void {
    const items = this.orbs.items;
    for (let i = 0; i < items.length; i++) {
      const o = items[i];
      if (!o.active) continue;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#0b111e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(5.5, 0);
      ctx.lineTo(0, 6.5);
      ctx.lineTo(-5.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderNovaRings(ctx: CanvasRenderingContext2D): void {
    for (const r of this.novaRings) {
      if (!r.active) continue;
      const alpha = r.life / r.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4 + alpha * 6;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderAfterimages(ctx: CanvasRenderingContext2D): void {
    const items = this.afterimages.items;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      if (!a.active) continue;
      const alpha = (a.life / a.maxLife) * 0.45;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.moveTo(21, 0);
      ctx.lineTo(-14, -13);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-14, 13);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    if (this.defeatBeatTimer > 0) return;
    const p = this.player;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Subtle gaze-routed diegetic Nova Ready Halo
    if (p.novaCharge >= 100) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Invulnerability blink
    if (p.invulnTimer > 0 && p.dashActiveTimer <= 0 && Math.floor(p.invulnTimer * 18) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    ctx.rotate(p.angle);
    ctx.scale(p.scaleX, p.scaleY);

    // Solar Wing Delta Craft
    const fill = p.hitFlash > 0 ? '#f43f5e' : p.dashActiveTimer > 0 ? '#fbbf24' : '#f8fafc';
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#0b111e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-13, -15);
    ctx.lineTo(-6, -4);
    ctx.lineTo(-15, 0);
    ctx.lineTo(-6, 4);
    ctx.lineTo(-13, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Canopy Accent
    ctx.fillStyle = p.dashActiveTimer > 0 ? '#f8fafc' : '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-2, -4.5);
    ctx.lineTo(-2, 4.5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private renderEnemies(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      ctx.save();

      // Telegraph overlays BEFORE entity transform
      if (e.state === 'windup') {
        if (e.kind === 'lancer') {
          const progress = 1 - e.stateTimer / 0.58;
          ctx.strokeStyle = `rgba(244, 63, 94, ${(0.35 + progress * 0.55).toFixed(2)})`;
          ctx.lineWidth = 2 + progress * 2;
          ctx.setLineDash([10, 8]);
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + Math.cos(e.angle) * 620, e.y + Math.sin(e.angle) * 620);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (e.kind === 'weaver' || e.kind === 'titan') {
          const maxT = e.kind === 'titan' ? 0.65 : 0.56;
          const progress = 1 - e.stateTimer / maxT;
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.72)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius + 8 + progress * 26, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.translate(e.x, e.y);
      if (e.state === 'ko') {
        const koRatio = Math.max(0, e.stateTimer / e.koDuration);
        ctx.globalAlpha = koRatio;
        ctx.scale(koRatio, koRatio);
      }

      ctx.rotate(e.angle);

      const isFlashing = e.hitFlash > 0 || e.state === 'ko';
      ctx.strokeStyle = '#0b111e';
      ctx.lineWidth = 2.2;

      if (e.kind === 'skirmisher') {
        ctx.fillStyle = isFlashing ? '#ffffff' : '#fb7185';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-12, -11);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-12, 11);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.kind === 'lancer') {
        ctx.fillStyle = isFlashing ? '#ffffff' : e.state === 'windup' ? '#fbbf24' : '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-14, -9);
        ctx.lineTo(-9, 0);
        ctx.lineTo(-14, 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.kind === 'bastion') {
        // Hexagonal armored hull
        ctx.fillStyle = isFlashing ? '#ffffff' : '#475569';
        ctx.beginPath();
        for (let v = 0; v < 6; v++) {
          const a = (v / 6) * Math.PI * 2;
          const px = Math.cos(a) * e.radius;
          const py = Math.sin(a) * e.radius;
          if (v === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Core
        ctx.fillStyle = e.state === 'windup' ? '#fbbf24' : '#f43f5e';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        // Directional Front Shield Arc
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 5, -1.0, 1.0);
        ctx.stroke();
      } else if (e.kind === 'weaver') {
        ctx.fillStyle = isFlashing ? '#ffffff' : '#f97316';
        ctx.beginPath();
        ctx.moveTo(19, 0);
        ctx.lineTo(0, -17);
        ctx.lineTo(-19, 0);
        ctx.lineTo(0, 17);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0b111e';
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'titan') {
        // Solar Titan Boss
        ctx.fillStyle = isFlashing ? '#ffffff' : '#334155';
        ctx.beginPath();
        for (let v = 0; v < 8; v++) {
          const a = (v / 8) * Math.PI * 2;
          const r = v % 2 === 0 ? e.radius : e.radius * 0.82;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (v === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner solar reactor
        ctx.fillStyle = e.state === 'windup' ? '#fbbf24' : '#f43f5e';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D): void {
    const items = this.projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const pr = items[i];
      if (!pr.active) continue;

      ctx.save();
      ctx.translate(pr.x, pr.y);
      const angle = Math.atan2(pr.vy, pr.vx);
      ctx.rotate(angle);

      if (pr.fromPlayer) {
        ctx.fillStyle = pr.color;
        ctx.strokeStyle = '#0b111e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, pr.radius * 1.9, pr.radius * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = pr.color;
        ctx.strokeStyle = '#0b111e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    const items = this.particles.items;
    for (let i = 0; i < items.length; i++) {
      const pt = items[i];
      if (!pt.active) continue;
      const t = pt.life / pt.maxLife;
      const size = pt.endSize + (pt.size - pt.endSize) * t;
      if (size <= 0.1) continue;

      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.2);
      ctx.fillStyle = pt.color;
      ctx.translate(pt.x, pt.y);

      if (pt.shape === 1) {
        ctx.rotate(pt.angle);
        ctx.fillRect(-size * 1.6, -size * 0.35, size * 3.2, size * 0.7);
      } else if (pt.shape === 2) {
        ctx.rotate(pt.angle);
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private renderCallouts(ctx: CanvasRenderingContext2D): void {
    const items = this.callouts.items;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < items.length; i++) {
      const c = items[i];
      if (!c.active) continue;
      const alpha = Math.min(1, (c.life / c.maxLife) * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${Math.round(16 * c.scale)}px "Barlow Condensed", sans-serif`;
      ctx.strokeStyle = '#0b111e';
      ctx.lineWidth = 4;
      ctx.strokeText(c.text, c.x, c.y);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }
  }

  private renderReticle(ctx: CanvasRenderingContext2D): void {
    const x = this.mouseScreenX;
    const y = this.mouseScreenY;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.88)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();

    const tick = 5;
    const gap = 13;
    ctx.beginPath();
    ctx.moveTo(-gap - tick, 0);
    ctx.lineTo(-gap, 0);
    ctx.moveTo(gap, 0);
    ctx.lineTo(gap + tick, 0);
    ctx.moveTo(0, -gap - tick);
    ctx.lineTo(0, -gap);
    ctx.moveTo(0, gap);
    ctx.lineTo(0, gap + tick);
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
