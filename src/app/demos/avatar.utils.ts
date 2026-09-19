/** Return a stable Random User portrait URL for a demo record. */
export function randomUserAvatarUrl(name: string): string {
  const hash = stableHash(name);
  const gender = hash % 2 === 0 ? 'women' : 'men';
  const portrait = (hash % 100 + 100) % 100;
  return `https://randomuser.me/api/portraits/${gender}/${portrait}.jpg`;
}

function stableHash(value: string): number {
  return [...value].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 360, 0);
}
