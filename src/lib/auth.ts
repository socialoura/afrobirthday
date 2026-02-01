// Admin authentication utilities

export type AdminToken = {
  username: string;
  role: 'admin';
  exp: number;
};

export function createAdminToken(username: string): string {
  const payload: AdminToken = {
    username,
    role: 'admin',
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function verifyAdminToken(token: string): AdminToken | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8')) as AdminToken;
    if (decoded.role !== 'admin') return null;
    if (decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

export function verifyAdminRequest(request: Request): AdminToken | null {
  const authHeader = request.headers.get('Authorization');
  const token = extractBearerToken(authHeader);
  if (!token) return null;
  return verifyAdminToken(token);
}
