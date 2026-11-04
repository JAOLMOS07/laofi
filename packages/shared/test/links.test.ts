import { describe, expect, it } from 'vitest';
import { normalizeTeamsLink } from '../src/links.js';

describe('normalizeTeamsLink', () => {
  it('acepta links de Teams', () => {
    expect(normalizeTeamsLink(' https://teams.microsoft.com/l/meetup-join/19%3a123 ')).toBe(
      'https://teams.microsoft.com/l/meetup-join/19%3a123',
    );
    expect(normalizeTeamsLink('https://teams.live.com/meet/9876')).toBe('https://teams.live.com/meet/9876');
  });
  it('rechaza otros sitios, http y trucos con el host', () => {
    expect(normalizeTeamsLink('http://teams.microsoft.com/x')).toBeNull();
    expect(normalizeTeamsLink('https://teams.microsoft.com.evil.com/x')).toBeNull();
    expect(normalizeTeamsLink('https://evil.com/?teams.microsoft.com')).toBeNull();
    expect(normalizeTeamsLink('https://user@teams.microsoft.com/x')).toBeNull();
    expect(normalizeTeamsLink('javascript:alert(1)')).toBeNull();
    expect(normalizeTeamsLink('')).toBeNull();
  });
});
