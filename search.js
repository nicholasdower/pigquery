const SEP = /[^a-z0-9]+/gi;

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
  const nameToks = tokens(name);
  const tagToks = tokens(tag);

  for (const qt of q) {
    const inName = nameNorm.includes(qt);
    const inTag = tagNorm.includes(qt);
    if (!inName && !inTag) return 0;
  }

  let score = 0;

  for (const qt of q) {
    const nameExact = nameToks.includes(qt);
    const tagExact = tagToks.includes(qt);

    const namePrefix = nameToks.some(t => t.startsWith(qt));
    const tagPrefix = tagToks.some(t => t.startsWith(qt));

    const nameSub = nameNorm.includes(qt);
    const tagSub = tagNorm.includes(qt);

    if (nameExact) score += 50;
    else if (namePrefix) score += 25;
    else if (nameSub) score += 10;

    if (tagExact) score += 35;
    else if (tagPrefix) score += 18;
    else if (tagSub) score += 7;
  }

  const combined = `${nameNorm} ${tagNorm}`.trim();
  let idx = -1;
  let ordered = true;
  for (const qt of q) {
    idx = combined.indexOf(qt, idx + 1);
    if (idx === -1) { ordered = false; break; }
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