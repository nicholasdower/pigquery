function tryJson(text) {
  if (!text.startsWith('{') && !text.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(text);
    const formatted = JSON.stringify(parsed, null, 2);

    const items = [
      { label: 'Original', value: text },
    ];
    if (formatted !== text) {
      items.push({ label: 'Formatted', value: formatted });
    }

    return items;
  } catch (_) {
    return null;
  }
}

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

    const items = [
      { label: 'Original', value: text },
      { label: 'Header', value: JSON.stringify(header, null, 2) },
      { label: 'Payload', value: JSON.stringify(payload, null, 2) },
      { label: 'Signature', value: parts[2] },
    ];

    // Add human-readable timestamps if present
    if (payload.iat) items.push({ label: 'Issued', value: new Date(payload.iat * 1000).toUTCString() });
    if (payload.exp) items.push({ label: 'Expires', value: new Date(payload.exp * 1000).toUTCString() });
    if (payload.nbf) items.push({ label: 'Not Before', value: new Date(payload.nbf * 1000).toUTCString() });

    return items;
  } catch (_) {
    return null;
  }
}

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

    const items = [
      { label: 'Original', value: text },
    ];

    // Check if decoded content is JSON
    if (decoded.trim().startsWith('{') || decoded.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(decoded);
        items.push({ label: 'Decoded (JSON)', value: JSON.stringify(parsed, null, 2) });
        return items;
      } catch (_) {
        // Not JSON, continue with plain text
      }
    }

    items.push({ label: 'Decoded', value: decoded });
    return items;
  } catch (_) {
    return null;
  }
}

function formatInTimezone(d, timeZone) {
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
}

function formatOffset(offsetMin) {
  const sign = offsetMin >= 0 ? '+' : '-';
  const hours = Math.floor(Math.abs(offsetMin) / 60);
  const mins = Math.abs(offsetMin) % 60;
  return mins > 0 ? `UTC${sign}${hours}:${mins.toString().padStart(2, '0')}` : `UTC${sign}${hours}`;
}

function formatDateTimeItems(date, originalValue, originalTzOffset = null) {
  const items = [
    { label: 'Original', value: originalValue },
  ];

  items.push({ label: 'Date', value: date.toUTCString() });
  items.push({ label: 'Milliseconds', value: String(date.getTime()) });

  return items;
}

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

  return formatDateTimeItems(date, text, originalTzOffset);
}

function tryNumber(text) {
  // Match integers and decimals, with optional negative sign
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;

  const num = parseFloat(text);
  if (!isFinite(num)) return null;

  const isInteger = Number.isInteger(num);
  const absNum = Math.abs(num);

  const items = [
    { label: 'Original', value: text },
  ];

  // Formatted with thousands separators
  if (isInteger) {
    const formatted = num.toLocaleString('en-US');
    if (formatted !== text) {
      items.push({ label: 'Formatted', value: formatted });
    }
  } else {
    const formatted = num.toLocaleString('en-US', { maximumFractionDigits: 10 });
    if (formatted !== text) {
      items.push({ label: 'Formatted', value: formatted });
    }
  }

  if (isInteger && num >= 0) {
    items.push({ label: 'Date (Milliseconds)', value: new Date(num).toUTCString() });
    items.push({ label: 'Date (Seconds)', value: new Date(num * 1000).toUTCString() });
  }

  return items;
}

function tryUrl(text) {
  // Must start with http:// or https://
  if (!text.startsWith('http://') && !text.startsWith('https://')) return null;

  try {
    const url = new URL(text);

    const hasParams = url.searchParams.toString().length > 0;

    const items = [
      { label: 'Original', value: text },
      { label: 'Protocol', value: url.protocol.replace(':', '') },
      { label: 'Host', value: url.host },
    ];
    
    if (url.port) items.push({ label: 'Port', value: url.port });
    if (url.pathname !== '/') items.push({ label: 'Path', value: url.pathname });
    if (url.hash) items.push({ label: 'Fragment', value: url.hash.slice(1) });

    if (hasParams) {
      for (const [key, value] of url.searchParams) {
        // Try to decode the value if it looks encoded
        let displayValue = value;
        try {
          const decoded = decodeURIComponent(value);
          if (decoded !== value) displayValue = decoded;
        } catch (_) {}
        items.push({ label: `Param: ${key}`, value: displayValue });
      }
    }

    return items;
  } catch (_) {
    return null;
  }
}

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

    const items = [
      { label: 'Original', value: text },
      { label: 'Formatted', value: formatted },
    ];

    return items;
  } catch (_) {
    return null;
  }
}

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

  const items = [
    { label: 'Original', value: text },
    { label: 'Byte Count', value: String(bytes.length) },
  ];

  if (printable) {
    const decoded = bytes.map(b => String.fromCharCode(b)).join('');
    items.push({ label: 'Decoded ASCII', value: decoded });
  } else {
    // Show hex dump
    let hexDump = '';
    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const hex = chunk.map(b => b.toString(16).padStart(2, '0')).join(' ');
      const ascii = chunk.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
      hexDump += `${i.toString(16).padStart(4, '0')}  ${hex.padEnd(48)}  ${ascii}\n`;
    }
    items.push({ label: 'Hex Dump', value: hexDump.trim() });
  }

  return items;
}

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

  const items = [
    { label: 'Original', value: text },
    { label: 'Version', value: `${version} - ${versionNames[version] || 'Unknown'}` },
    { label: 'Lowercase', value: text.toLowerCase() },
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
        items.push({ label: 'Created', value: date.toUTCString() });
      }
    } catch (_) {}
  }

  return items;
}

function detectContentType(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const trimmed = text.trim();

  // Try each formatter in order of specificity
  const result =
    tryJwt(trimmed) ||
    tryJson(trimmed) ||
    tryUuid(trimmed) ||
    tryDate(trimmed) ||
    tryNumber(trimmed) ||
    tryUrl(trimmed) ||
    tryXml(trimmed) ||
    tryBase64(trimmed) ||
    tryHex(trimmed);

  if (result) return result;

  // Plain text
  return [{ label: 'Original', value: trimmed }];
}

self.pigquery ||= {};
self.pigquery.formatters = {
  detectContentType,
};
