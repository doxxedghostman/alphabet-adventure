// Preserve the full letter multiset required by a target, including repeats.
export function fillTargetLetterDeficits(letters, targetWord) {
  const result = [...letters];
  const required = new Map();
  const counts = new Map();
  for (const letter of targetWord) required.set(letter, (required.get(letter) ?? 0) + 1);
  for (const letter of result) counts.set(letter, (counts.get(letter) ?? 0) + 1);

  for (const [letter, requiredCount] of required) {
    while ((counts.get(letter) ?? 0) < requiredCount) {
      const donors = result.flatMap((value, index) =>
        (counts.get(value) ?? 0) > (required.get(value) ?? 0) ? [index] : []);
      if (donors.length === 0) throw new Error(`No spare tile for ${letter}`);
      const index = donors[Math.floor(Math.random() * donors.length)];
      const oldLetter = result[index];
      result[index] = letter;
      counts.set(oldLetter, counts.get(oldLetter) - 1);
      counts.set(letter, (counts.get(letter) ?? 0) + 1);
    }
  }
  return result;
}
