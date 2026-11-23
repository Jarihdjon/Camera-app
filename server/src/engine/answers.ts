/**
 * Answer checking. Code, not the model, decides what is correct.
 */

/** Lower-case, trim, strip punctuation, and treat British/Australian/US variants alike. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/**
 * Forgiving spelling: short words must be exact, longer words allow one or two
 * slips, so "volcanoe" and "telescop" count but "cat" for "car" does not.
 */
export function checkShortAnswer(given: string, accept: readonly string[]): boolean {
  const g = normalise(given);
  if (!g) return false;
  return accept.some((a) => {
    const n = normalise(a);
    if (g === n) return true;
    const allowed = n.length <= 3 ? 0 : n.length <= 7 ? 1 : 2;
    return levenshtein(g, n) <= allowed;
  });
}

/**
 * Evaluates a plain arithmetic expression without eval(). Supports + - * / and
 * parentheses on integers, which covers everything a Year 2 maths item needs.
 */
export function evaluateArithmetic(expr: string): number {
  const tokens = expr.match(/\d+|[+\-*/()]/g);
  if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) throw new Error(`Bad expression: ${expr}`);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function factor(): number {
    const t = next();
    if (t === "(") {
      const v = sum();
      if (next() !== ")") throw new Error("Missing )");
      return v;
    }
    if (t === "-") return -factor();
    if (t !== undefined && /^\d+$/.test(t)) return Number(t);
    throw new Error(`Unexpected token ${t}`);
  }
  function product(): number {
    let v = factor();
    while (peek() === "*" || peek() === "/") v = next() === "*" ? v * factor() : v / factor();
    return v;
  }
  function sum(): number {
    let v = product();
    while (peek() === "+" || peek() === "-") v = next() === "+" ? v + product() : v - product();
    return v;
  }
  const result = sum();
  if (pos !== tokens.length) throw new Error("Trailing tokens");
  return result;
}

export function checkMaths(given: string, expression: string, tolerance = 0): boolean {
  const n = Number(given.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && Math.abs(n - evaluateArithmetic(expression)) <= tolerance;
}

export function tokens(s: string): string[] {
  return normalise(s.replace(/[’']/g, "")).match(/[a-z]+|\d+/g) ?? [];
}

/** Word-level match from the workbook: numbers and short words exact, longer words allow a slip or two. */
function tokenMatches(t: string, w: string): boolean {
  if (t === w) return true;
  if (w.length < 4 || /\d/.test(w)) return false;
  const tol = w.length >= 8 ? 2 : 1;
  return Math.abs(t.length - w.length) <= tol && levenshtein(t, w) <= tol;
}

/**
 * Keyword marking: the answer is right if any of its words matches an accepted word,
 * so "it was behind the door" counts for "door". With groups, he needs a word from every group
 * ("sunlight, water and air").
 */
export function checkKeywords(given: string, accept: readonly string[], groups?: readonly (readonly string[])[]): boolean {
  const T = tokens(given);
  const has = (w: string) => T.some((t) => tokenMatches(t, normalise(w)));
  if (groups?.length) return groups.every((g) => g.some(has));
  return accept.some(has);
}
