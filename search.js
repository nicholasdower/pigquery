// Note: This is 100% AI and not even reviewed by humans.
const SEP = /[^a-z0-9]+/gi;

function isSubsequence(needle, haystack) {
  // Returns true if all chars in needle appear in haystack in order (not necessarily contiguously).
  // Useful for "apn" matching "apple_backend" (applebackend).
  if (!needle) return true;
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

function acronymFromTokens(toks) {
  // "apple_backend" -> ["apple","backend"] -> "ab"
  return toks.map(t => t[0]).filter(Boolean).join("");
}

function tokenPrefixSequenceBest(toks, q) {
  // IntelliJ-like: match query by consuming it from successive token *prefixes*.
  // Example: ["orders","to","creators"], "otoc" => "o" + "to" + "c".
  // Returns the best (highest) score for any start position, or 0 if no match.
  if (!q) return 0;

  let best = 0;

  for (let start = 0; start < toks.length; start++) {
    let pos = 0;
    let used = 0;

    for (let i = start; i < toks.length && pos < q.length; i++) {
      const t = toks[i];
      if (!t) continue;

      // Find the longest prefix of t that matches q at pos.
      const maxLen = Math.min(t.length, q.length - pos);
      let k = 0;
      while (k < maxLen && t[k] === q[pos + k]) k++;

      if (k > 0) {
        pos += k;
        used++;
      }
    }

    if (pos === q.length) {
      // Scoring: prefer earlier start, fewer tokens, and longer queries.
      // Tuned to strongly prefer token-start matches over mid-token subsequence.
      let s = 90;
      s += Math.min(40, q.length * 6);
      s -= start * 10;
      s -= (used - 1) * 6;
      best = Math.max(best, s);
    }
  }

  return best;
}

function norm(s) {
  return (s ?? "").toLowerCase();
}

function tokens(s) {
  return norm(s).split(SEP).filter(Boolean);
}

function scoreItem({ name, tag }, query) {
  const q = tokens(query);
  if (q.length === 0) return 0;

  const nameNorm = norm(name);
  const tagNorm = norm(tag);

  // Collapsed variants let "foobar" match "foo_bar".
  // (Drop all non-alphanumerics, including underscores/spaces/punctuation.)
  const nameCollapsed = nameNorm.replace(SEP, "");
  const tagCollapsed = tagNorm.replace(SEP, "");

  // Combined forms allow matches that span name + tag, e.g. "appta" matching
  // "apple_backend" + tag "table" (applebackendtable).
  const combinedCollapsed = `${nameCollapsed}${tagCollapsed}`;

  const nameToks = tokens(name);
  const tagToks = tokens(tag);
  const combinedToks = [...nameToks, ...tagToks];

  // Initialism support: "ab" -> "apple_backend"; combined supports spanning name+tag.
  const nameAcr = acronymFromTokens(nameToks);
  const tagAcr = acronymFromTokens(tagToks);
  const combinedAcr = acronymFromTokens(combinedToks);

  // Require all query tokens to match somewhere (AND).
  // A token matches if it appears in either the normal or collapsed forms,
  // or matches a token acronym,
  // or matches an IntelliJ-like token-prefix sequence,
  // or (as a last resort) is a subsequence match against the collapsed form.
  for (const qt of q) {
    const nameTokSeq = qt.length >= 2 ? tokenPrefixSequenceBest(nameToks, qt) : 0;
    const tagTokSeq = qt.length >= 2 ? tokenPrefixSequenceBest(tagToks, qt) : 0;
    const combinedTokSeq = qt.length >= 2 ? tokenPrefixSequenceBest(combinedToks, qt) : 0;

    const inName =
      nameNorm.includes(qt) ||
      nameCollapsed.includes(qt) ||
      (qt.length >= 2 && nameAcr.startsWith(qt)) ||
      nameTokSeq > 0 ||
      (qt.length >= 2 && isSubsequence(qt, nameCollapsed));

    const inTag =
      tagNorm.includes(qt) ||
      tagCollapsed.includes(qt) ||
      (qt.length >= 2 && tagAcr.startsWith(qt)) ||
      tagTokSeq > 0 ||
      (qt.length >= 2 && isSubsequence(qt, tagCollapsed));

    const inCombined =
      combinedTokSeq > 0 ||
      (qt.length >= 2 && combinedAcr.startsWith(qt)) ||
      (qt.length >= 2 && combinedCollapsed.includes(qt)) ||
      (qt.length >= 2 && isSubsequence(qt, combinedCollapsed));

    if (!inName && !inTag && !inCombined) return 0;
  }

  let score = 0;

  for (const qt of q) {
    // Prefer token-level matches (exact > prefix > acronym > token-prefix-sequence > substring > subsequence)
    const nameExact = nameToks.includes(qt);
    const tagExact = tagToks.includes(qt);

    const namePrefix = nameToks.some(t => t.startsWith(qt));
    const tagPrefix = tagToks.some(t => t.startsWith(qt));

    const nameAcrPrefix = qt.length >= 2 && nameAcr.startsWith(qt);
    const tagAcrPrefix = qt.length >= 2 && tagAcr.startsWith(qt);

    // IntelliJ-like: query consumed across successive token prefixes.
    // This is the main signal that should make "otoc" prefer "orders to creators".
    const nameTokSeq = qt.length >= 2 ? tokenPrefixSequenceBest(nameToks, qt) : 0;
    const tagTokSeq = qt.length >= 2 ? tokenPrefixSequenceBest(tagToks, qt) : 0;
    const combinedTokSeq = qt.length >= 2 ? tokenPrefixSequenceBest(combinedToks, qt) : 0;

    const nameSub = nameNorm.includes(qt);
    const tagSub = tagNorm.includes(qt);

    const nameCollapsedSub = !nameSub && nameCollapsed.includes(qt);
    const tagCollapsedSub = !tagSub && tagCollapsed.includes(qt);

    const nameSubseq =
      !nameSub && !nameCollapsedSub && !nameAcrPrefix && nameTokSeq === 0 && qt.length >= 2 && isSubsequence(qt, nameCollapsed);
    const tagSubseq =
      !tagSub && !tagCollapsedSub && !tagAcrPrefix && tagTokSeq === 0 && qt.length >= 2 && isSubsequence(qt, tagCollapsed);

    // Spanning matches (name+tag) are weaker than direct name matches.
    const combinedAcrPrefix = qt.length >= 2 && combinedAcr.startsWith(qt);
    const combinedCollapsedSub = qt.length >= 2 && combinedCollapsed.includes(qt);
    const combinedSubseq = qt.length >= 2 && isSubsequence(qt, combinedCollapsed);

    // Name weighting (dominant)
    if (nameExact) score += 160;
    else if (namePrefix) score += 130;
    else if (nameAcrPrefix) score += 120;
    else if (nameTokSeq) score += nameTokSeq; // already strong
    else if (nameSub) score += 45;
    else if (nameCollapsedSub) score += 36;
    else if (nameSubseq) score += 18;

    // Tag weighting (secondary)
    if (tagExact) score += 90;
    else if (tagPrefix) score += 70;
    else if (tagAcrPrefix) score += 55;
    else if (tagTokSeq) score += Math.max(0, tagTokSeq - 30);
    else if (tagSub) score += 22;
    else if (tagCollapsedSub) score += 18;
    else if (tagSubseq) score += 10;

    // Combined (name+tag) only if neither name nor tag had a strong token-start style match.
    const hasStrong =
      nameExact || namePrefix || nameAcrPrefix || nameTokSeq ||
      tagExact || tagPrefix || tagAcrPrefix || tagTokSeq;

    if (!hasStrong) {
      if (combinedTokSeq) score += Math.max(0, combinedTokSeq - 45);
      else if (combinedAcrPrefix) score += 28;
      else if (combinedCollapsedSub) score += 18;
      else if (combinedSubseq) score += 8;
    }
  }

  // Bonus for ordered appearance across the combined (non-collapsed) string
  const combined = `${nameNorm} ${tagNorm}`.trim();
  let idx = -1;
  let ordered = true;
  for (const qt of q) {
    idx = combined.indexOf(qt, idx + 1);
    if (idx === -1) {
      ordered = false;
      break;
    }
  }
  if (ordered) score += 12;

  return score;
}

function filter(items, query) {
  return items
    .map(item => ({ item, score: scoreItem(item, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}

window.pigquery ||= {};
window.pigquery.search = {
  filter,
};