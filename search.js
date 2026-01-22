// Search/filter for items with group, tag, and name fields.
//
// Data model
//   Each item has three fields:
//   - group: project/category (e.g. "My Project", "Analytics")
//   - tag: item type (e.g. "TABLE", "JOIN", "QUERY")
//   - name: the item itself (e.g. "foo_bar", SQL snippets)
//
// Query behavior
//   - Empty query returns all items (no filtering).
//   - Query is case-insensitive.
//   - Query is tokenized on non-alphanumeric characters (e.g. "foo bar" → ["foo", "bar"]).
//   - AND semantics: all query tokens must match somewhere in the item.
//   - Field order doesn't matter: group, name, and tag can match in any order.
//     e.g. a query can match tag first, then group, then name.
//
// Matching strategies (in order of quality)
//   1. Exact token match: "foo" matches token "foo"
//   2. Token prefix match: "ord" matches token "orders"
//   3. Acronym match: "otc" matches "obb_to_cob" (first letter of each token)
//   4. Token-prefix sequence: "otoc" or "obtco" matches "obb_to_cob".
//
// Ranking
//   - Higher-quality match strategies score higher.
//   - Earlier matches rank higher: "cs" prefers "consumer_subscriptions" over
//     "orders to consumer_subscriptions" because the match starts at token 0.
//   - Field priority: group > name > tag.
//
// Constraints
//   - Fast enough for real-time type-to-filter in a Chrome extension.
//   - Stable sort for deterministic ordering.

const SEP = /[^a-z0-9]+/gi;

function norm(s) {
  return (s ?? "").toLowerCase();
}

function tokenize(s) {
  return norm(s).split(SEP).filter(Boolean);
}

function acronym(tokens) {
  return tokens.map(t => t[0] || "").join("");
}

// IntelliJ-style matching: consume query across successive token prefixes.
// "otoc" matches ["orders", "to", "creators"] as "o" + "to" + "c"
// Returns { score, startIndex } if matched, null otherwise.
function tokenPrefixMatch(tokens, query) {
  if (!query || tokens.length === 0) return null;

  let best = null;

  for (let start = 0; start < tokens.length; start++) {
    let pos = 0;
    let tokensUsed = 0;
    let firstMatchIndex = -1;

    for (let i = start; i < tokens.length && pos < query.length; i++) {
      const token = tokens[i];
      if (!token) continue;

      // Match as much of this token's prefix as possible
      let matched = 0;
      while (matched < token.length && pos + matched < query.length && token[matched] === query[pos + matched]) {
        matched++;
      }

      if (matched > 0) {
        if (firstMatchIndex === -1) firstMatchIndex = i;
        pos += matched;
        tokensUsed++;
      }
    }

    if (pos === query.length) {
      // Full match! Score prefers: fewer tokens used, longer queries
      let score = 100;
      score += Math.min(30, query.length * 5);
      score -= (tokensUsed - 1) * 5;

      if (!best || score > best.score || (score === best.score && firstMatchIndex < best.startIndex)) {
        best = { score, startIndex: firstMatchIndex };
      }
    }
  }

  return best;
}

// Check if query token matches within a field
// Returns { type, score, startIndex } or null
function matchesField(queryToken, fieldNorm, fieldTokens, fieldAcronym) {
  // Exact token match - find earliest matching token
  const exactIndex = fieldTokens.indexOf(queryToken);
  if (exactIndex !== -1) {
    return { type: "exact", score: 100, startIndex: exactIndex };
  }

  // Token prefix match - find earliest matching token
  const prefixIndex = fieldTokens.findIndex(t => t.startsWith(queryToken));
  if (prefixIndex !== -1) {
    return { type: "prefix", score: 80, startIndex: prefixIndex };
  }

  // Acronym match (requires 2+ chars) - always starts at index 0
  if (queryToken.length >= 2 && fieldAcronym.startsWith(queryToken)) {
    return { type: "acronym", score: 70, startIndex: 0 };
  }

  // Token-prefix sequence match (requires 2+ chars)
  if (queryToken.length >= 2) {
    const seqResult = tokenPrefixMatch(fieldTokens, queryToken);
    if (seqResult) {
      return { type: "sequence", score: seqResult.score, startIndex: seqResult.startIndex };
    }
  }

  return null;
}

// Generate all permutations of an array
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

function scoreItem({ group, name, tag }, query) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  // Prepare fields
  const fields = [
    { name: "group", norm: norm(group), tokens: tokenize(group), weight: 1.0 },
    { name: "name", norm: norm(name), tokens: tokenize(name), weight: 0.9 },
    { name: "tag", norm: norm(tag), tokens: tokenize(tag), weight: 0.8 },
  ];

  // Pre-compute acronyms
  for (const field of fields) {
    field.acronym = acronym(field.tokens);
  }

  // All permutations of fields for spanning matches (field order shouldn't matter)
  const fieldPerms = permutations(fields);

  let totalScore = 0;
  const POSITION_PENALTY = 25; // Penalty per token index for later matches

  // Each query token must match somewhere (AND semantics)
  for (const qt of queryTokens) {
    let bestMatch = null;
    let bestWeight = 0;

    // Try each field
    for (const field of fields) {
      const match = matchesField(qt, field.norm, field.tokens, field.acronym);
      if (match) {
        const effectiveScore = match.score * field.weight - match.startIndex * POSITION_PENALTY;
        const bestEffective = bestMatch ? bestMatch.score * bestWeight - bestMatch.startIndex * POSITION_PENALTY : -Infinity;
        if (effectiveScore > bestEffective) {
          bestMatch = match;
          bestWeight = field.weight;
        }
      }
    }

    // Try combined (spanning) match as fallback - try all field orderings
    if (!bestMatch && qt.length >= 2) {
      for (const perm of fieldPerms) {
        const combinedTokens = perm.flatMap(f => f.tokens);
        const combinedAcronym = acronym(combinedTokens);

        if (combinedAcronym.startsWith(qt)) {
          bestMatch = { type: "combined-acronym", score: 50, startIndex: 0 };
          bestWeight = 0.7;
          break;
        }

        const seqResult = tokenPrefixMatch(combinedTokens, qt);
        if (seqResult) {
          const candidate = { type: "combined-sequence", score: seqResult.score * 0.7, startIndex: seqResult.startIndex };
          const candidateEffective = candidate.score * 0.7 - candidate.startIndex * POSITION_PENALTY;
          const bestEffective = bestMatch ? bestMatch.score * bestWeight - bestMatch.startIndex * POSITION_PENALTY : -Infinity;
          if (candidateEffective > bestEffective) {
            bestMatch = candidate;
            bestWeight = 0.7;
          }
        }
      }
    }

    // No match for this token = item doesn't match
    if (!bestMatch) return 0;

    totalScore += bestMatch.score * bestWeight - bestMatch.startIndex * POSITION_PENALTY;
  }

  return totalScore;
}

function filter(items, query) {
  if (tokenize(query).length === 0) return items;

  return items
    .map(item => ({ item, score: scoreItem(item, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}

window.pigquery ||= {};
window.pigquery.search = { filter };
