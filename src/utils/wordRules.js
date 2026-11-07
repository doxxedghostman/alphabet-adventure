// One rule for gameplay, hints, generators and the offline simulator.
import { MIN_WORD_LENGTH, MAX_WORD_LENGTH } from '../config.js';
import { WORD_SET } from '../data/wordlist.js';

export function scanWordLine(letters) {
  const found = [];
  for (let start = 0; start < letters.length;) {
    let matchedLength = 0;
    for (let length = Math.min(MAX_WORD_LENGTH, letters.length - start); length >= MIN_WORD_LENGTH; length--) {
      const segment = letters.slice(start, start + length);
      // Null/unknown cells break words in the symbolic simulator.
      if (!segment.every((letter) => typeof letter === 'string' && /^[A-Z]$/.test(letter))) continue;
      const word = segment.join('');
      if (WORD_SET.has(word)) {
        found.push({ start, length, word });
        matchedLength = length;
        break;
      }
    }
    start += matchedLength || 1;
  }
  return found;
}

export function lineHasWord(letters) {
  return scanWordLine(letters).length > 0;
}
