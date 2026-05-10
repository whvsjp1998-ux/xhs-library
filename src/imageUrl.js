export function imageUrl(src) {
  if (!src || typeof src !== 'string') return '';
  if (src.startsWith('data:')) return src;
  if (!/^https?:\/\//i.test(src)) return src;
  return `/image-proxy?url=${encodeURIComponent(src)}`;
}
