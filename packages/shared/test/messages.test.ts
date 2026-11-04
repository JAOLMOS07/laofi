import { describe, expect, it } from 'vitest';
import { ClientMessages, JoinOptionsSchema, parseAvatar, DEFAULT_AVATAR } from '../src/index.js';

describe('mensajes del cliente', () => {
  it('move acepta enteros y rechaza decimales o negativos', () => {
    expect(ClientMessages.move.safeParse({ x: 3, y: 4 }).success).toBe(true);
    for (const m of [{ x: 1.5, y: 2 }, { x: -1, y: 0 }, { x: '3', y: 1 }, {}])
      expect(ClientMessages.move.safeParse(m).success).toBe(false);
  });
  it('set_status solo acepta estados conocidos', () => {
    expect(ClientMessages.set_status.safeParse({ status: 'FOCUS' }).success).toBe(true);
    expect(ClientMessages.set_status.safeParse({ status: 'durmiendo' }).success).toBe(false);
  });
  it('note_create recorta y limita el texto', () => {
    expect(ClientMessages.note_create.parse({ toUserId: 'u1', text: '  hola ' }).text).toBe('hola');
    expect(ClientMessages.note_create.safeParse({ toUserId: 'u1', text: '   ' }).success).toBe(false);
    expect(ClientMessages.note_create.safeParse({ toUserId: 'u1', text: 'x'.repeat(501) }).success).toBe(
      false,
    );
  });
  it('furniture_place valida mueble, rotación y color', () => {
    const ok = { key: 'desk', x: 1, y: 1, rot: 90, color: '#aabbcc' };
    expect(ClientMessages.furniture_place.safeParse(ok).success).toBe(true);
    expect(ClientMessages.furniture_place.safeParse({ ...ok, key: 'jacuzzi' }).success).toBe(false);
    expect(ClientMessages.furniture_place.safeParse({ ...ok, rot: 45 }).success).toBe(false);
    expect(ClientMessages.furniture_place.safeParse({ ...ok, color: 'rojo' }).success).toBe(false);
  });
});

describe('JoinOptionsSchema', () => {
  it('exige token y un piso válido', () => {
    expect(JoinOptionsSchema.safeParse({ floorId: 'fenix', token: 'abcdefghijk' }).success).toBe(true);
    expect(JoinOptionsSchema.safeParse({ floorId: 'Fénix!', token: 'abcdefghijk' }).success).toBe(false);
    expect(JoinOptionsSchema.safeParse({ floorId: 'fenix' }).success).toBe(false);
  });
});

describe('parseAvatar', () => {
  it('devuelve el avatar por defecto si el guardado está mal', () => {
    expect(parseAvatar({ skin: 'x' })).toEqual(DEFAULT_AVATAR);
    expect(parseAvatar({ ...DEFAULT_AVATAR, hair: 'long' }).hair).toBe('long');
  });
});
