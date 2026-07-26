import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db/Database';

// Never ship the fallback secret to production — anyone knowing it can forge tokens.
const DEV_FALLBACK_SECRET = 'anaconda_park_dev_only_secret_change_me';
const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEV_FALLBACK_SECRET) {
  throw new Error('[security] JWT_SECRET must be set in production — refusing to boot with the dev fallback secret.');
}
if (JWT_SECRET === DEV_FALLBACK_SECRET) {
  console.warn('[security] Using the development JWT secret. Set JWT_SECRET before deploying.');
}

// §5 Username rules — reserved handles + a small profanity guard (extend as needed).
const RESERVED_NAMES = new Set(['admin', 'administrator', 'root', 'system', 'moderator', 'mod', 'staff', 'support', 'anacondapark', 'anaconda', 'official', 'server', 'null', 'undefined', 'guest', 'player', 'you']);
const PROFANITY = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'faggot', 'asshole', 'dick', 'porn', 'rape'];

export class AuthService {
  // §5 Validate a username against the rules (length, charset, reserved, profanity).
  public static validateUsername(name: string): { ok: boolean; reason?: string } {
    const n = (name || '').trim();
    if (n.length < 3) return { ok: false, reason: 'At least 3 characters' };
    if (n.length > 16) return { ok: false, reason: 'At most 16 characters' };
    if (!/^[A-Za-z0-9_]+$/.test(n)) return { ok: false, reason: 'Use letters, numbers and _ only' };
    const lower = n.toLowerCase();
    if (RESERVED_NAMES.has(lower)) return { ok: false, reason: 'This name is reserved' };
    if (PROFANITY.some(w => lower.includes(w))) return { ok: false, reason: 'Please choose a friendlier name' };
    return { ok: true };
  }

  // §5 Availability = valid AND not already taken. Suggests alternatives when taken.
  public static checkUsername(name: string): { available: boolean; reason?: string; suggestions?: string[] } {
    const v = this.validateUsername(name);
    if (!v.ok) return { available: false, reason: v.reason, suggestions: this.suggestUsernames(name) };
    if (db.getUserByUsername(name.trim())) return { available: false, reason: 'Username already taken', suggestions: this.suggestUsernames(name) };
    return { available: true };
  }

  public static suggestUsernames(name: string): string[] {
    const base = (name || 'Snake').replace(/[^A-Za-z0-9_]/g, '').slice(0, 12) || 'Snake';
    const cands = [`${base}_${Math.floor(10 + Math.random() * 89)}`, `${base}_Play`, `${base}_Pro`, `${base}_${Math.floor(100 + Math.random() * 899)}`, `${base}X`];
    return cands.filter(c => this.validateUsername(c).ok && !db.getUserByUsername(c)).slice(0, 3);
  }

  // §5 Create a named guest during first-time onboarding (unique username enforced).
  public static onboardGuest(name: string, country?: string, language?: string): { token: string; user: any; profile: any } | { error: string; suggestions?: string[] } {
    const check = this.checkUsername(name);
    if (!check.available) return { error: check.reason || 'Username unavailable', suggestions: check.suggestions };
    const clean = name.trim();
    const { user, profile } = db.createUser(clean, `${clean.toLowerCase()}@guest.local`, '', true);
    db.updateProfile(user.id, { country, language } as any); // country/language stored loosely
    const token = jwt.sign({ userId: user.id, username: user.username, isGuest: true }, JWT_SECRET, { expiresIn: '30d' });
    return { token, user: { id: user.id, username: user.username, email: user.email, isGuest: user.isGuest }, profile: db.getProfile(user.id) };
  }

  public static async login(username: string, password: string): Promise<{ token: string; user: any; profile: any } | { error: string }> {
    const user = db.getUserByUsername(username);
    // Guests have no password and cannot be logged into via this endpoint.
    if (!user || user.isGuest || !user.passwordHash) {
      return { error: 'Invalid username or password' };
    }

    // Compare the supplied plaintext against the stored bcrypt hash ONLY.
    // (Never accept the raw hash as a password — that would be an auth bypass.)
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return { error: 'Invalid username or password' };
    }

    const profile = db.getProfile(user.id);
    const token = jwt.sign(
      { userId: user.id, username: user.username, isGuest: user.isGuest },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return { token, user: { id: user.id, username: user.username, email: user.email }, profile };
  }

  public static async register(username: string, email: string, passwordPlain: string): Promise<{ token: string; user: any; profile: any } | { error: string }> {
    if (db.getUserByUsername(username)) {
      return { error: 'Username is already taken' };
    }

    const hash = await bcrypt.hash(passwordPlain, 10);
    const { user, profile } = db.createUser(username, email, hash, false);

    const token = jwt.sign(
      { userId: user.id, username: user.username, isGuest: user.isGuest },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return { token, user: { id: user.id, username: user.username, email: user.email }, profile };
  }

  public static createGuestAccount(): { token: string; user: any; profile: any } {
    const guestName = `Explorer_${Math.floor(1000 + Math.random() * 9000)}`;
    const { user, profile } = db.createUser(guestName, `${guestName.toLowerCase()}@guest.local`, '', true);

    const token = jwt.sign(
      { userId: user.id, username: user.username, isGuest: true },
      JWT_SECRET,
      { expiresIn: '30d' } // keep guest sessions (and their progress) alive across visits
    );

    return { token, user: { id: user.id, username: user.username, email: user.email }, profile };
  }

  public static verifyToken(token: string): { userId: string; username: string; isGuest: boolean } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return { userId: decoded.userId, username: decoded.username, isGuest: decoded.isGuest };
    } catch (err) {
      return null;
    }
  }
}
