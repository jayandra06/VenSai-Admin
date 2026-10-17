import { randomBytes, scryptSync } from "crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, salt, 32).toString("hex");
  return { passwordHash, passwordSalt: salt, passwordAlgo: "scrypt" as const };
}

export function generateTempPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export function generateOrgCode(existing: Set<string>) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!existing.has(code)) return code;
  }
  return null;
}
