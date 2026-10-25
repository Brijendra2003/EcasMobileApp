// Persona resolution (§5.3).
//   roles ∩ {professor, hod} → Professor · student → Student · parent → Parent
//   only web roles → "Use the web portal" · more than one persona → picker
export type Persona = 'professor' | 'student' | 'parent';
export type PersonaRoute = Persona | 'choose' | 'web';

export function personasFor(roles: readonly string[]): Persona[] {
  const out: Persona[] = [];
  if (roles.includes('professor') || roles.includes('hod')) {
    out.push('professor');
  }
  if (roles.includes('student')) {
    out.push('student');
  }
  if (roles.includes('parent')) {
    out.push('parent');
  }
  return out;
}

export function routeFor(roles: readonly string[], remembered: string | undefined | null): PersonaRoute {
  const personas = personasFor(roles);
  if (personas.length === 0) {
    return 'web';
  }
  if (personas.length === 1) {
    return personas[0];
  }
  return personas.includes(remembered as Persona) ? (remembered as Persona) : 'choose';
}

/** Semantic version compare for the update gate (§5.4): -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) {
      return d < 0 ? -1 : 1;
    }
  }
  return 0;
}

/** Roles from the access token's custom claims (web doc §5.5). */
export function rolesFromAccessToken(token: string | undefined): string[] {
  if (!token) {
    return [];
  }
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(globalThis.atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')));
    return Array.isArray(json.app_roles) ? json.app_roles : [];
  } catch {
    return [];
  }
}
