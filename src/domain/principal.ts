import type { HeadscaleUser } from "@/api/types";

export type Principal = string & { readonly __brand: "Principal" };

export function toPrincipal(raw: string): Principal {
  return raw.trim().toLowerCase() as Principal;
}

export class PrincipalIndex {
  private readonly known = new Set<string>();

  constructor(values: Iterable<string>) {
    for (const v of values) {
      const value = v.trim();
      if (value) this.known.add(value);
    }
  }

  static fromUsers(users: readonly HeadscaleUser[]): PrincipalIndex {
    const values: string[] = [];
    for (const user of users) {
      const email = user.email?.trim();
      if (email) values.push(email);
      const name = user.name.trim();
      if (name) values.push(name);
      const providerId = user.providerId?.trim();
      if (providerId) values.push(providerId);
    }
    return new PrincipalIndex(values);
  }

  has(value: string): boolean {
    return this.known.has(value.trim().replace(/@$/, ""));
  }
}
