import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db/Database';

const JWT_SECRET = process.env.JWT_SECRET || 'anaconda_park_super_secret_jwt_key_2026';

export class AuthService {
  public static async login(username: string, passwordHashOrPlain: string): Promise<{ token: string; user: any; profile: any } | { error: string }> {
    const user = db.getUserByUsername(username);
    if (!user) {
      return { error: 'Invalid username or password' };
    }

    if (user.passwordHash) {
      const match = await bcrypt.compare(passwordHashOrPlain, user.passwordHash);
      if (!match && passwordHashOrPlain !== user.passwordHash) {
        return { error: 'Invalid username or password' };
      }
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
      { expiresIn: '12h' }
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
