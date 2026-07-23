"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const Database_1 = require("../db/Database");
const JWT_SECRET = process.env.JWT_SECRET || 'anaconda_park_super_secret_jwt_key_2026';
class AuthService {
    static async login(username, passwordHashOrPlain) {
        const user = Database_1.db.getUserByUsername(username);
        if (!user) {
            return { error: 'Invalid username or password' };
        }
        if (user.passwordHash) {
            const match = await bcryptjs_1.default.compare(passwordHashOrPlain, user.passwordHash);
            if (!match && passwordHashOrPlain !== user.passwordHash) {
                return { error: 'Invalid username or password' };
            }
        }
        const profile = Database_1.db.getProfile(user.id);
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username, isGuest: user.isGuest }, JWT_SECRET, { expiresIn: '24h' });
        return { token, user: { id: user.id, username: user.username, email: user.email }, profile };
    }
    static async register(username, email, passwordPlain) {
        if (Database_1.db.getUserByUsername(username)) {
            return { error: 'Username is already taken' };
        }
        const hash = await bcryptjs_1.default.hash(passwordPlain, 10);
        const { user, profile } = Database_1.db.createUser(username, email, hash, false);
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username, isGuest: user.isGuest }, JWT_SECRET, { expiresIn: '24h' });
        return { token, user: { id: user.id, username: user.username, email: user.email }, profile };
    }
    static createGuestAccount() {
        const guestName = `Explorer_${Math.floor(1000 + Math.random() * 9000)}`;
        const { user, profile } = Database_1.db.createUser(guestName, `${guestName.toLowerCase()}@guest.local`, '', true);
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username, isGuest: true }, JWT_SECRET, { expiresIn: '12h' });
        return { token, user: { id: user.id, username: user.username, email: user.email }, profile };
    }
    static verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            return { userId: decoded.userId, username: decoded.username, isGuest: decoded.isGuest };
        }
        catch (err) {
            return null;
        }
    }
}
exports.AuthService = AuthService;
