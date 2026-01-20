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
  // or is a subsequence match against the collapsed form (fuzzy-finder style),
  // or matches the token acronym.
  for (const qt of q) {
    const inName =
      nameNorm.includes(qt) ||
      nameCollapsed.includes(qt) ||
      (qt.length >= 2 && isSubsequence(qt, nameCollapsed)) ||
      (qt.length >= 2 && nameAcr.startsWith(qt));

    const inTag =
      tagNorm.includes(qt) ||
      tagCollapsed.includes(qt) ||
      (qt.length >= 2 && isSubsequence(qt, tagCollapsed)) ||
      (qt.length >= 2 && tagAcr.startsWith(qt));

    const inCombined =
      (qt.length >= 2 && combinedCollapsed.includes(qt)) ||
      (qt.length >= 2 && isSubsequence(qt, combinedCollapsed)) ||
      (qt.length >= 2 && combinedAcr.startsWith(qt));

    if (!inName && !inTag && !inCombined) return 0;
  }

  let score = 0;

  for (const qt of q) {
    // Prefer token-level matches (exact > prefix > substring)
    const nameExact = nameToks.includes(qt);
    const tagExact = tagToks.includes(qt);

    const namePrefix = nameToks.some(t => t.startsWith(qt));
    const tagPrefix = tagToks.some(t => t.startsWith(qt));

    const nameSub = nameNorm.includes(qt);
    const tagSub = tagNorm.includes(qt);

    const nameCollapsedSub = !nameSub && nameCollapsed.includes(qt);
    const tagCollapsedSub = !tagSub && tagCollapsed.includes(qt);

    const nameAcrPrefix = qt.length >= 2 && nameAcr.startsWith(qt);
    const tagAcrPrefix = qt.length >= 2 && tagAcr.startsWith(qt);

    const nameSubseq =
      !nameSub && !nameCollapsedSub && !nameAcrPrefix && qt.length >= 2 && isSubsequence(qt, nameCollapsed);
    const tagSubseq =
      !tagSub && !tagCollapsedSub && !tagAcrPrefix && qt.length >= 2 && isSubsequence(qt, tagCollapsed);

    // Spanning matches (name+tag) get a smaller boost than name/tag matches.
    const combinedAcrPrefix = qt.length >= 2 && combinedAcr.startsWith(qt);
    const combinedCollapsedSub = qt.length >= 2 && combinedCollapsed.includes(qt);
    const combinedSubseq = qt.length >= 2 && isSubsequence(qt, combinedCollapsed);

    if (nameExact) score += 50;
    else if (namePrefix) score += 25;
    else if (nameSub) score += 10;
    else if (nameCollapsedSub) score += 8;
    else if (nameAcrPrefix) score += 16;
    else if (nameSubseq) score += 6;

    if (tagExact) score += 35;
    else if (tagPrefix) score += 18;
    else if (tagSub) score += 7;
    else if (tagCollapsedSub) score += 5;
    else if (tagAcrPrefix) score += 11;
    else if (tagSubseq) score += 4;

    if (!nameExact && !namePrefix && !nameSub && !nameCollapsedSub && !nameAcrPrefix && !nameSubseq &&
        !tagExact && !tagPrefix && !tagSub && !tagCollapsedSub && !tagAcrPrefix && !tagSubseq) {
      if (combinedAcrPrefix) score += 9;
      else if (combinedCollapsedSub) score += 6;
      else if (combinedSubseq) score += 4;
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