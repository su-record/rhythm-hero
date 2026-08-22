import type { AppState, Profile, ToyFamily } from "./types.ts";

export const TOY_FAMILIES: ToyFamily[] = ["spike", "bouncer"];
export const MAX_PROFILE_NAME = 12;

export const TOY_COPY: Record<ToyFamily, { label: string; blurb: string }> = {
  spike: { label: "스파이크", blurb: "둥실 떠서 기다려요. 조용하면 먼저 말을 걸어요." },
  bouncer: { label: "바운서", blurb: "다리가 있어서 잘 뛰어요. 기록이 시작되면 신나요." },
};

/** Pink waits, blue moves: the same grammar for every family. */
export function toyArt(family: ToyFamily, active: boolean): string {
  return `./assets/characters/${family}-${active ? "blue" : "pink"}.png`;
}

export function normalizeProfileName(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_PROFILE_NAME);
}

export function isToyFamily(value: unknown): value is ToyFamily {
  return TOY_FAMILIES.includes(value as ToyFamily);
}

export function createProfile(name: string, toy: ToyFamily, toyName: string): Profile | null {
  const cleanName = normalizeProfileName(name);
  if (!cleanName || !isToyFamily(toy)) return null;
  return {
    name: cleanName,
    toy,
    toyName: normalizeProfileName(toyName) || TOY_COPY[toy].label,
    createdAt: new Date().toISOString(),
  };
}

export function hasProfile(state: AppState): boolean {
  return state.profile !== null;
}
