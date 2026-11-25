import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  createEmptyProgress,
  mergePlayerProgress,
  sanitizeProgress,
} from './src/game/achievements';
import type { PlayerProgress } from './src/game/types';

interface StoredUser {
  id: string;
  username: string;
  usernameKey: string;
  salt: string;
  passcodeHash: string;
  progress: PlayerProgress;
  createdAt: string;
  updatedAt: string;
}

interface ProfileStore {
  users: Record<string, StoredUser>;
}

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const PROFILES_PATH = path.resolve(DATA_DIR, 'profiles.json');
if (!PROFILES_PATH.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid profile store path');
}

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? Buffer.from(process.env.SESSION_SECRET, 'utf8')
    : crypto.randomBytes(32);

const USERNAME_RE = /^[A-Za-z0-9_-]{3,24}$/;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

let storeCache: ProfileStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function loadStore(): ProfileStore {
  if (storeCache) return storeCache;
  try {
    if (fs.existsSync(PROFILES_PATH)) {
      const raw = fs.readFileSync(PROFILES_PATH, 'utf8');
      const parsed = JSON.parse(raw) as ProfileStore;
      if (parsed && typeof parsed === 'object' && parsed.users && typeof parsed.users === 'object') {
        storeCache = parsed;
        return storeCache;
      }
    }
  } catch {
    // Fallback to clean store if file unreadable
  }
  storeCache = { users: {} };
  return storeCache;
}

async function saveStore(store: ProfileStore): Promise<void> {
  storeCache = store;
  writeQueue = writeQueue.then(async () => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpPath = path.resolve(DATA_DIR, `profiles.${process.pid}.${Date.now()}.tmp`);
    if (!tmpPath.startsWith(DATA_DIR + path.sep)) {
      throw new Error('Invalid temp store path');
    }
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmpPath, PROFILES_PATH);
  });
  return writeQueue;
}

function hashPasscode(passcode: string, salt: string): string {
  return crypto.scryptSync(passcode, salt, 64).toString('hex');
}

function verifyPasscode(passcode: string, salt: string, storedHex: string): boolean {
  const derived = crypto.scryptSync(passcode, salt, 64);
  const stored = Buffer.from(storedHex, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

interface TokenPayload {
  uid: string;
  username: string;
  exp: number;
}

function signToken(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest();
  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (expectedSig.length !== providedSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed || typeof parsed.uid !== 'string' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Simple sliding-window auth attempt limiter
const authFailures = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = authFailures.get(key);
  if (!entry || now > entry.resetAt) return true;
  return entry.count < 15;
}

function recordAuthFailure(key: string): void {
  const now = Date.now();
  const entry = authFailures.get(key);
  if (!entry || now > entry.resetAt) {
    authFailures.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
  } else {
    entry.count += 1;
  }
}

function clearAuthFailure(key: string): void {
  authFailures.delete(key);
}

interface AuthedRequest extends Request {
  authUser?: StoredUser;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.header('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const payload = verifyToken(match[1]);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid' });
    return;
  }
  const store = loadStore();
  const user = store.users[payload.uid];
  if (!user) {
    res.status(401).json({ error: 'Account not found' });
    return;
  }
  req.authUser = user;
  next();
}

function validateCredentials(body: unknown): { username: string; passcode: string } | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid request body' };
  }
  const b = body as Record<string, unknown>;
  const rawUsername = typeof b.username === 'string' ? b.username.trim() : '';
  const rawPasscode = typeof b.passcode === 'string' ? b.passcode : '';

  if (!USERNAME_RE.test(rawUsername)) {
    return { error: 'Username must be 3–24 characters using letters, numbers, _ or -.' };
  }
  if (rawPasscode.length < 4 || rawPasscode.length > 32) {
    return { error: 'Passcode must be between 4 and 32 characters.' };
  }
  return { username: rawUsername, passcode: rawPasscode };
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const creds = validateCredentials(req.body);
    if ('error' in creds) {
      res.status(400).json({ error: creds.error });
      return;
    }

    const rateKey = `${req.ip || 'local'}:${creds.username.toLowerCase()}`;
    if (!checkRateLimit(rateKey)) {
      res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
      return;
    }

    const store = loadStore();
    const key = creds.username.toLowerCase();
    const existing = Object.values(store.users).find((u) => u.usernameKey === key);
    if (existing) {
      res.status(409).json({ error: 'That pilot callsign is already registered. Sign in instead.' });
      return;
    }

    const now = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString('hex');
    const id = crypto.randomUUID();
    const initialBody = req.body as { progress?: unknown };
    const initialProgress = initialBody.progress ? sanitizeProgress(initialBody.progress) : createEmptyProgress();

    const user: StoredUser = {
      id,
      username: creds.username,
      usernameKey: key,
      salt,
      passcodeHash: hashPasscode(creds.passcode, salt),
      progress: initialProgress,
      createdAt: now,
      updatedAt: now,
    };

    store.users[id] = user;
    await saveStore(store);

    const token = signToken({ uid: id, username: user.username, exp: Date.now() + TOKEN_TTL_MS });
    res.status(201).json({
      token,
      user: { id: user.id, username: user.username },
      progress: user.progress,
    });
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const creds = validateCredentials(req.body);
    if ('error' in creds) {
      res.status(400).json({ error: creds.error });
      return;
    }

    const rateKey = `${req.ip || 'local'}:${creds.username.toLowerCase()}`;
    if (!checkRateLimit(rateKey)) {
      res.status(429).json({ error: 'Too many failed passcode attempts. Try again shortly.' });
      return;
    }

    const store = loadStore();
    const key = creds.username.toLowerCase();
    const user = Object.values(store.users).find((u) => u.usernameKey === key);
    if (!user || !verifyPasscode(creds.passcode, user.salt, user.passcodeHash)) {
      recordAuthFailure(rateKey);
      res.status(401).json({ error: 'Invalid username or passcode.' });
      return;
    }

    clearAuthFailure(rateKey);

    const body = req.body as { progress?: unknown };
    if (body.progress) {
      const localProgress = sanitizeProgress(body.progress);
      user.progress = mergePlayerProgress(user.progress, localProgress);
      user.updatedAt = new Date().toISOString();
      await saveStore(store);
    }

    const token = signToken({ uid: user.id, username: user.username, exp: Date.now() + TOKEN_TTL_MS });
    res.json({
      token,
      user: { id: user.id, username: user.username },
      progress: user.progress,
    });
  });

  app.get('/api/auth/session', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    res.json({
      user: { id: user.id, username: user.username },
      progress: user.progress,
    });
  });

  app.get('/api/progress', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    res.json({ progress: user.progress });
  });

  app.put('/api/progress', requireAuth, async (req: AuthedRequest, res: Response) => {
    const user = req.authUser!;
    const body = req.body as { progress?: unknown };
    if (!body || !body.progress) {
      res.status(400).json({ error: 'Missing progress payload' });
      return;
    }
    const incoming = sanitizeProgress(body.progress);
    const merged = mergePlayerProgress(user.progress, incoming);
    user.progress = merged;
    user.updatedAt = new Date().toISOString();

    const store = loadStore();
    store.users[user.id] = user;
    await saveStore(store);

    res.json({ progress: merged });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Solar Wing server listening on http://localhost:${PORT}`);
  });
}

startServer();
