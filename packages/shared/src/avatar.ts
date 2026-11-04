import { z } from 'zod';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const HAIR_STYLES = ['short', 'long', 'bun', 'cap', 'none'] as const;
export const ACCESSORIES = ['none', 'glasses', 'headphones'] as const;
export const SKIN_TONES = ['#f1c7a5', '#eab995', '#d9a47c', '#c68a5e', '#a56b43', '#8d5a3b'] as const;

export const AvatarConfigSchema = z.object({
  skin: color,
  hair: z.enum(HAIR_STYLES),
  hairColor: color,
  shirt: color,
  pants: color,
  accessory: z.enum(ACCESSORIES),
});
export type AvatarConfig = z.infer<typeof AvatarConfigSchema>;

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: '#c68a5e',
  hair: 'short',
  hairColor: '#24170f',
  shirt: '#2f6f62',
  pants: '#3a3f55',
  accessory: 'none',
};

/** Lee un avatar guardado y cae al de por defecto si está mal formado. */
export function parseAvatar(raw: unknown): AvatarConfig {
  const r = AvatarConfigSchema.safeParse(raw);
  return r.success ? r.data : DEFAULT_AVATAR;
}
