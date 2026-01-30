const MIN_CONTENT_LENGTH_FOR_DISPLAY = 200;

// ============================================================================
// JSON
// ============================================================================
function tryJson(text) {
  if (!text.startsWith('{') && !text.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(text);
    const formatted = JSON.stringify(parsed, null, 2);
    const showPanel = formatted !== text || text.length >= MIN_CONTENT_LENGTH_FOR_DISPLAY;
    return { type: 'json', formatted, showPanel };
  } catch (_) {
    return null;
  }
}

// ============================================================================
// YAML
// ============================================================================
function tryYaml(text) {
  // YAML is a superset of JSON, so check for YAML-specific syntax
  const looksLikeYaml = text.includes(':') && (text.includes('\n') || /^[\w-]+:\s/.test(text));
  if (!looksLikeYaml) return null;
  try {
    const parsed = jsyaml.load(text);
    if (parsed && typeof parsed === 'object') {
      const formatted = jsyaml.dump(parsed, { indent: 2, lineWidth: -1 });
      return { type: 'yaml', formatted, showPanel: true };
    }
  } catch (_) {
    // Not valid YAML
  }
  return null;
}

// ============================================================================
// JWT Token
// ============================================================================
function tryJwt(text) {
  // JWT format: header.payload.signature (3 base64url parts separated by dots)
  const parts = text.split('.');
  if (parts.length !== 3) return null;

  // Check if first two parts look like base64url
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  if (!base64urlRegex.test(parts[0]) || !base64urlRegex.test(parts[1])) return null;

  try {
    const decodeBase64Url = (str) => {
      // Convert base64url to base64
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
      return JSON.parse(atob(padded));
    };

    const header = decodeBase64Url(parts[0]);
    const payload = decodeBase64Url(parts[1]);

    // Check for common JWT header fields
    if (!header.alg && !header.typ) return null;

    const lines = [
      '── Header ──',
      JSON.stringify(header, null, 2),
      '',
      '── Payload ──',
      JSON.stringify(payload, null, 2),
      '',
      '── Signature ──',
      parts[2]
    ];

    // Add human-readable timestamps if present
    const timestamps = [];
    if (payload.iat) timestamps.push(`Issued: ${new Date(payload.iat * 1000).toISOString()}`);
    if (payload.exp) timestamps.push(`Expires: ${new Date(payload.exp * 1000).toISOString()}`);
    if (payload.nbf) timestamps.push(`Not Before: ${new Date(payload.nbf * 1000).toISOString()}`);

    if (timestamps.length > 0) {
      lines.push('', '── Timestamps ──', ...timestamps);
    }

    return { type: 'jwt', formatted: lines.join('\n'), showPanel: true };
  } catch (_) {
    return null;
  }
}

// ============================================================================
// Base64
// ============================================================================
function tryBase64(text) {
  // Must be at least 20 chars and look like base64
  if (text.length < 20) return null;

  // Standard base64 or base64url
  const base64Regex = /^[A-Za-z0-9+/_-]+=*$/;
  if (!base64Regex.test(text)) return null;

  // Avoid false positives: must have some lowercase AND some uppercase or numbers
  if (!/[a-z]/.test(text) || !/[A-Z0-9]/.test(text)) return null;

  try {
    // Convert base64url to standard base64
    const standard = text.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(standard);

    // Check if result is printable text (allow some control chars like newline, tab)
    const printableRatio = decoded.split('').filter(c => {
      const code = c.charCodeAt(0);
      return (code >= 32 && code < 127) || code === 9 || code === 10 || code === 13;
    }).length / decoded.length;

    // Must be mostly printable
    if (printableRatio < 0.9) return null;

    // Check if decoded content is JSON
    if (decoded.trim().startsWith('{') || decoded.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(decoded);
        const formatted = `── Decoded Base64 (JSON) ──\n${JSON.stringify(parsed, null, 2)}`;
        return { type: 'base64', formatted, showPanel: true };
      } catch (_) {
        // Not JSON, continue with plain text
      }
    }

    return { type: 'base64', formatted: `── Decoded Base64 ──\n${decoded}`, showPanel: true };
  } catch (_) {
    return null;
  }
}

// ============================================================================
// Shared Date/Time Formatting
// ============================================================================
function formatDateTimeOutput(date, type, originalValue, originalTzOffset = null) {
  // Consistent format for displaying times: YYYY-MM-DD HH:MM:SS
  const formatInTimezone = (d, timeZone) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d);

    const get = (type) => parts.find(p => p.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
  };

  // Format offset minutes as "UTC+1" or "UTC-5:30"
  const formatOffset = (offsetMin) => {
    const sign = offsetMin >= 0 ? '+' : '-';
    const hours = Math.floor(Math.abs(offsetMin) / 60);
    const mins = Math.abs(offsetMin) % 60;
    return mins > 0 ? `UTC${sign}${hours}:${mins.toString().padStart(2, '0')}` : `UTC${sign}${hours}`;
  };

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localOffsetMin = -date.getTimezoneOffset();
  const localOffset = formatOffset(localOffsetMin);

  // Original value
  const lines = [
    '── Original ──',
    originalValue,
  ];

  // Times section
  lines.push('', '── Times ──');

  // Show original timezone if known and different from UTC
  if (originalTzOffset !== null && originalTzOffset !== 0) {
    // Calculate time in original timezone by adjusting from UTC
    const originalDate = new Date(date.getTime() + originalTzOffset * 60000);
    const originalFormatted = formatInTimezone(originalDate, 'UTC'); // Use UTC formatting on adjusted time
    lines.push(`Original: ${originalFormatted} (${formatOffset(originalTzOffset)})`);
  }

  lines.push(`UTC:      ${formatInTimezone(date, 'UTC')}`);
  lines.push(`Local:    ${formatInTimezone(date, localTz)} (${localOffset})`);

  // Formats section
  lines.push('', '── Formats ──');
  lines.push(`ISO 8601:   ${date.toISOString()}`);
  lines.push(`RFC 2822:   ${date.toUTCString()}`);

  // Unix timestamps
  lines.push('', '── Unix Timestamp ──');
  lines.push(`Seconds:      ${Math.floor(date.getTime() / 1000)}`);
  lines.push(`Milliseconds: ${date.getTime()}`);

  // Add relative time
  const now = Date.now();
  const diff = date.getTime() - now;
  const absDiff = Math.abs(diff);

  let relative;
  if (absDiff < 60000) {
    relative = diff >= 0 ? 'in a few seconds' : 'a few seconds ago';
  } else if (absDiff < 3600000) {
    const mins = Math.round(absDiff / 60000);
    relative = diff >= 0 ? `in ${mins} minute${mins > 1 ? 's' : ''}` : `${mins} minute${mins > 1 ? 's' : ''} ago`;
  } else if (absDiff < 86400000) {
    const hours = Math.round(absDiff / 3600000);
    relative = diff >= 0 ? `in ${hours} hour${hours > 1 ? 's' : ''}` : `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (absDiff < 2592000000) {
    const days = Math.round(absDiff / 86400000);
    relative = diff >= 0 ? `in ${days} day${days > 1 ? 's' : ''}` : `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (absDiff < 31536000000) {
    const months = Math.round(absDiff / 2592000000);
    relative = diff >= 0 ? `in ${months} month${months > 1 ? 's' : ''}` : `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.round(absDiff / 31536000000);
    relative = diff >= 0 ? `in ${years} year${years > 1 ? 's' : ''}` : `${years} year${years > 1 ? 's' : ''} ago`;
  }

  lines.push('', `(${relative})`);

  return { type, formatted: lines.join('\n'), showPanel: true };
}

// ============================================================================
// Unix Timestamp
// ============================================================================
function tryTimestamp(text) {
  // Only digits, 10-13 chars (seconds or milliseconds)
  if (!/^\d{10,13}$/.test(text)) return null;

  const num = parseInt(text, 10);

  // Determine if seconds or milliseconds based on magnitude
  // Seconds: 10 digits, roughly 1970-2100
  // Milliseconds: 13 digits
  let date;

  if (text.length === 13) {
    date = new Date(num);
  } else if (text.length >= 10) {
    date = new Date(num * 1000);
  } else {
    return null;
  }

  // Sanity check: date should be between 1990 and 2100
  const year = date.getFullYear();
  if (year < 1990 || year > 2100) return null;

  // Timestamps are inherently UTC, no original timezone offset
  return formatDateTimeOutput(date, 'timestamp', text, null);
}

// ============================================================================
// Date / DateTime String
// ============================================================================
function tryDate(text) {
  // Date only format: 2023-10-15
  const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

  // Datetime formats:
  // - 2023-10-15T14:30:00Z
  // - 2023-10-15T14:30:00.123Z
  // - 2023-10-15T14:30:00+00:00
  // - 2023-10-15T14:30:00.123+05:30
  // - 2023-10-15 14:30:00.123456 UTC (BigQuery format)
  const isoFullRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})?$/;
  const dateTimeNoTzRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;
  const sqlDateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?( UTC)?$/;
  const rfcRegex = /^[A-Za-z]{3},?\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s*(GMT|UTC|[+-]\d{4})?$/;

  const isDateOnly = dateOnlyRegex.test(text);
  const isDateTime = isoFullRegex.test(text) || dateTimeNoTzRegex.test(text) || sqlDateTimeRegex.test(text) || rfcRegex.test(text);

  if (!isDateOnly && !isDateTime) return null;

  // Normalize SQL/BigQuery format to ISO format for reliable parsing
  let normalized = text;
  if (sqlDateTimeRegex.test(text)) {
    // Convert "2023-10-15 14:30:00.123456 UTC" to "2023-10-15T14:30:00.123456Z"
    normalized = text.replace(' UTC', 'Z').replace(' ', 'T');
  }

  const date = new Date(normalized);

  // Validate the date is valid
  if (isNaN(date.getTime())) return null;

  // Sanity check: date should be between 1900 and 2200
  const year = date.getFullYear();
  if (year < 1900 || year > 2200) return null;

  // Extract original timezone offset in minutes
  let originalTzOffset = null;

  // Check for Z or UTC (offset = 0)
  if (/Z$/.test(text) || / UTC$/.test(text) || /GMT$/.test(text)) {
    originalTzOffset = 0;
  }
  // Check for explicit offset like +05:30 or -08:00
  const offsetMatch = text.match(/([+-])(\d{2}):(\d{2})$/);
  if (offsetMatch) {
    const sign = offsetMatch[1] === '+' ? 1 : -1;
    const hours = parseInt(offsetMatch[2], 10);
    const mins = parseInt(offsetMatch[3], 10);
    originalTzOffset = sign * (hours * 60 + mins);
  }
  // Check for RFC offset like +0530 or -0800
  const rfcOffsetMatch = text.match(/([+-])(\d{2})(\d{2})$/);
  if (rfcOffsetMatch) {
    const sign = rfcOffsetMatch[1] === '+' ? 1 : -1;
    const hours = parseInt(rfcOffsetMatch[2], 10);
    const mins = parseInt(rfcOffsetMatch[3], 10);
    originalTzOffset = sign * (hours * 60 + mins);
  }

  const type = isDateOnly ? 'date' : 'datetime';
  return formatDateTimeOutput(date, type, text, originalTzOffset);
}

// ============================================================================
// URL with Query Parameters
// ============================================================================
function tryUrl(text) {
  // Must start with http:// or https://
  if (!text.startsWith('http://') && !text.startsWith('https://')) return null;

  try {
    const url = new URL(text);

    // Only show panel if there's something interesting (query params, long path, or fragment)
    const hasParams = url.searchParams.toString().length > 0;
    const hasFragment = url.hash.length > 0;
    const longPath = url.pathname.length > 20;

    if (!hasParams && !hasFragment && !longPath) return null;

    const lines = ['── URL Components ──', ''];
    lines.push(`Protocol: ${url.protocol.replace(':', '')}`);
    lines.push(`Host:     ${url.host}`);

    if (url.port) lines.push(`Port:     ${url.port}`);
    if (url.pathname !== '/') lines.push(`Path:     ${url.pathname}`);

    if (hasParams) {
      lines.push('', '── Query Parameters ──');
      for (const [key, value] of url.searchParams) {
        // Try to decode the value if it looks encoded
        let displayValue = value;
        try {
          const decoded = decodeURIComponent(value);
          if (decoded !== value) displayValue = decoded;
        } catch (_) {}
        lines.push(`  ${key}: ${displayValue}`);
      }
    }

    if (hasFragment) {
      lines.push('', `Fragment: ${url.hash.slice(1)}`);
    }

    return { type: 'url', formatted: lines.join('\n'), showPanel: true };
  } catch (_) {
    return null;
  }
}

// ============================================================================
// XML / HTML
// ============================================================================
function tryXml(text) {
  // Must start with < and contain at least one tag
  if (!text.startsWith('<')) return null;
  if (!/<[a-zA-Z][\w-]*[^>]*>/.test(text)) return null;

  // Simple XML/HTML pretty printer
  try {
    let formatted = '';
    let indent = 0;
    const indentStr = '  ';

    // Tokenize: split into tags and content
    const tokens = text.match(/(<[^>]+>|[^<]+)/g);
    if (!tokens) return null;

    for (const token of tokens) {
      const trimmedToken = token.trim();
      if (!trimmedToken) continue;

      if (trimmedToken.startsWith('</')) {
        // Closing tag
        indent = Math.max(0, indent - 1);
        formatted += indentStr.repeat(indent) + trimmedToken + '\n';
      } else if (trimmedToken.startsWith('<') && trimmedToken.endsWith('/>')) {
        // Self-closing tag
        formatted += indentStr.repeat(indent) + trimmedToken + '\n';
      } else if (trimmedToken.startsWith('<?') || trimmedToken.startsWith('<!')) {
        // Declaration or DOCTYPE
        formatted += trimmedToken + '\n';
      } else if (trimmedToken.startsWith('<')) {
        // Opening tag
        formatted += indentStr.repeat(indent) + trimmedToken + '\n';
        indent++;
      } else {
        // Content
        formatted += indentStr.repeat(indent) + trimmedToken + '\n';
      }
    }

    formatted = formatted.trim();

    // Only show if formatting changed something meaningful
    const normalizedOriginal = text.replace(/\s+/g, ' ').trim();
    const normalizedFormatted = formatted.replace(/\s+/g, ' ').trim();

    if (normalizedOriginal === normalizedFormatted && text.length < MIN_CONTENT_LENGTH_FOR_DISPLAY) {
      return null;
    }

    return { type: 'xml', formatted, showPanel: true };
  } catch (_) {
    return null;
  }
}

// ============================================================================
// Hex String
// ============================================================================
function tryHex(text) {
  // Must be hex characters only, even length, at least 20 chars
  if (text.length < 20 || text.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(text)) return null;

  // Convert to bytes
  const bytes = [];
  for (let i = 0; i < text.length; i += 2) {
    bytes.push(parseInt(text.slice(i, i + 2), 16));
  }

  // Check if it's printable ASCII
  const printable = bytes.every(b => (b >= 32 && b < 127) || b === 9 || b === 10 || b === 13);

  const lines = ['── Hex String ──', ''];
  lines.push(`Bytes: ${bytes.length}`);

  if (printable) {
    const decoded = bytes.map(b => String.fromCharCode(b)).join('');
    lines.push('', '── Decoded ASCII ──', decoded);
  } else {
    // Show hex dump
    lines.push('', '── Hex Dump ──');
    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const hex = chunk.map(b => b.toString(16).padStart(2, '0')).join(' ');
      const ascii = chunk.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
      lines.push(`${i.toString(16).padStart(4, '0')}  ${hex.padEnd(48)}  ${ascii}`);
    }
  }

  return { type: 'hex', formatted: lines.join('\n'), showPanel: true };
}

// ============================================================================
// UUID
// ============================================================================
function tryUuid(text) {
  // Standard UUID format: 8-4-4-4-12
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-([1-5])[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  const match = text.match(uuidRegex);
  if (!match) return null;

  const version = match[1];
  const versionNames = {
    '1': 'Time-based (MAC address)',
    '2': 'DCE Security',
    '3': 'Name-based (MD5)',
    '4': 'Random',
    '5': 'Name-based (SHA-1)'
  };

  const lines = [
    '── UUID ──',
    '',
    `Version: ${version} - ${versionNames[version] || 'Unknown'}`,
    `Value:   ${text.toLowerCase()}`
  ];

  // For v1 UUIDs, extract timestamp
  if (version === '1') {
    try {
      const timeLow = parseInt(text.slice(0, 8), 16);
      const timeMid = parseInt(text.slice(9, 13), 16);
      const timeHigh = parseInt(text.slice(14, 18), 16) & 0x0fff;

      // UUID timestamp is 100-nanosecond intervals since Oct 15, 1582
      const timestamp = BigInt(timeHigh) << 48n | BigInt(timeMid) << 32n | BigInt(timeLow);
      const unixNs = timestamp - 122192928000000000n; // Offset to Unix epoch
      const unixMs = Number(unixNs / 10000n);
      const date = new Date(unixMs);

      if (date.getFullYear() >= 1990 && date.getFullYear() <= 2100) {
        lines.push(`Created: ${date.toISOString()}`);
      }
    } catch (_) {}
  }

  return { type: 'uuid', formatted: lines.join('\n'), showPanel: true };
}

// ============================================================================
// Main Detection Function
// ============================================================================
function detectContentType(text) {
  if (!text || typeof text !== 'string') {
    return { type: 'text', formatted: null, showPanel: false };
  }

  const trimmed = text.trim();

  // Try each formatter in order of specificity
  const result =
    tryJwt(trimmed) ||
    tryJson(trimmed) ||
    tryYaml(trimmed) ||
    tryUuid(trimmed) ||
    tryTimestamp(trimmed) ||
    tryDate(trimmed) ||
    tryUrl(trimmed) ||
    tryXml(trimmed) ||
    tryBase64(trimmed) ||
    tryHex(trimmed);

  if (result) return result;

  // Plain text - only show if very long (truncated in cell)
  const showPanel = trimmed.length >= MIN_CONTENT_LENGTH_FOR_DISPLAY;
  return { type: 'text', formatted: trimmed, showPanel };
}

self.pigquery ||= {};
self.pigquery.formatters = {
  detectContentType,
};
