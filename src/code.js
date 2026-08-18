const CHARS = '23456789ACDEFGHJKLMNPQRSTUVWXYZ';

// Unbiased short-code generator over a confusion-free 31-char alphabet.
// 31 = 2^5-1, so mask each random byte with 0x1F and reject the one overflow
// value (31) rather than taking a biased modulo.
export function generateCode(length) {
  let code = '';
  while (code.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if ((byte & 31) < CHARS.length) {
        code += CHARS[byte & 31];
        if (code.length === length) break;
      }
    }
  }
  return code;
}
