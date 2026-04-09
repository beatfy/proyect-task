import { cn, cuid } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra');
  });

  it('merges tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('');
  });
});

describe('cuid', () => {
  it('generates a UUID string', () => {
    const id = cuid();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('generates unique values', () => {
    const a = cuid();
    const b = cuid();
    expect(a).not.toBe(b);
  });
});
