(function() {

  const i18n = self.pigquery.i18n;
  const LOCALE = i18n.getBigQueryLocale();

  function tryJson(original) {
    const text = original.value;
    if (!text.startsWith('{') && !text.startsWith('[')) return null;
    try {
      const parsed = JSON.parse(text);
      const formatted = JSON.stringify(parsed, null, 2);
      original.type = 'json';

      if (formatted !== text) {
        const typeName = i18n.getMessage('typeJson', LOCALE);
        const label = i18n.getMessage('formatted', LOCALE);
        return [{ label: `${typeName} – ${label}`, value: formatted, type: 'json' }];
      }
      return [];
    } catch (_) {
      return null;
    }
  }

  function tryJwt(original) {
    const text = original.value;
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

      const typeName = i18n.getMessage('typeJwt', LOCALE);
      const items = [
        { label: `${typeName} – ${i18n.getMessage('header', LOCALE)}`, value: JSON.stringify(header, null, 2), type: 'json' },
        { label: `${typeName} – ${i18n.getMessage('payload', LOCALE)}`, value: JSON.stringify(payload, null, 2), type: 'json' },
        { label: `${typeName} – ${i18n.getMessage('signature', LOCALE)}`, value: parts[2] },
      ];

      // Add human-readable timestamps if present
      if (payload.iat) items.push({ label: `${typeName} – ${i18n.getMessage('issued', LOCALE)}`, value: formatDate(new Date(payload.iat * 1000)) });
      if (payload.exp) items.push({ label: `${typeName} – ${i18n.getMessage('expires', LOCALE)}`, value: formatDate(new Date(payload.exp * 1000)) });
      if (payload.nbf) items.push({ label: `${typeName} – ${i18n.getMessage('notBefore', LOCALE)}`, value: formatDate(new Date(payload.nbf * 1000)) });

      return items;
    } catch (_) {
      return null;
    }
  }

  function tryBase64(original) {
    const text = original.value;
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

      const decodedItem = { label: 'Decoded', value: decoded, type: 'text' };
      const decodedFormatted = tryFormatters(decodedItem, ['base64', 'hex']);

      // If a nested type was detected, don't show the Base64 decoded item, just show the formatted nested type items
      if (decodedItem.type !== 'text' && decodedFormatted.length > 0) {
        return decodedFormatted;
      }

      // Plain text decoding
      const typeName = i18n.getMessage('typeBase64', LOCALE);
      const label = i18n.getMessage('decoded', LOCALE);
      decodedItem.label = `${typeName} – ${label}`;

      const items = [decodedItem];
      items.push(...decodedFormatted);

      return items;
    } catch (_) {
      return null;
    }
  }

  function formatDate(date) {
    return date.toISOString();
  }

  function formatDateLocalized(date) {
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      timeZoneName: 'short'
    };

    return date.toLocaleString(LOCALE, options);
  }

  function tryDate(original) {
    const text = original.value;
    // Date only format: 2023-10-15
    const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

    // Datetime formats:
    // - 2023-10-15T14:30:00Z
    // - 2023-10-15T14:30:00.123Z
    // - 2023-10-15T14:30:00+00:00
    // - 2023-10-15T14:30:00.123+05:30
    // - 2023-10-15 14:30:00.123456 UTC (BigQuery format)
    // - 2023-10-15 14:30:00.123456+00 (PostgreSQL format)
    // - 2023-10-15 14:30:00.123456+00:00 (PostgreSQL format with full offset)
    const isoFullRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:\d{2})?)?$/;
    const dateTimeNoTzRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;
    const sqlDateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?( UTC|[+-]\d{2}(:\d{2})?)?$/;
    const rfcRegex = /^[A-Za-z]{3},?\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s*(GMT|UTC|[+-]\d{4})?$/;

    const isDateOnly = dateOnlyRegex.test(text);
    const isDateTime = isoFullRegex.test(text) || dateTimeNoTzRegex.test(text) || sqlDateTimeRegex.test(text) || rfcRegex.test(text);

    if (!isDateOnly && !isDateTime) return null;

    // Normalize SQL/BigQuery/PostgreSQL format to ISO format for reliable parsing
    let normalized = text;
    if (sqlDateTimeRegex.test(text)) {
      // Convert "2023-10-15 14:30:00.123456 UTC" to "2023-10-15T14:30:00.123456Z"
      // Convert "2023-10-15 14:30:00.123456+00" to "2023-10-15T14:30:00.123456+00:00"
      normalized = text.replace(' UTC', 'Z');
      // Handle short timezone offset like +00 or -05 (without :00)
      normalized = normalized.replace(/([+-]\d{2})$/, '$1:00');
      // Replace space with T for ISO format
      normalized = normalized.replace(' ', 'T');
    }

    const date = new Date(normalized);

    // Validate the date is valid
    if (isNaN(date.getTime())) return null;

    // Sanity check: date should be between 1900 and 2200
    const year = date.getFullYear();
    if (year < 1900 || year > 2200) return null;

    const typeName = i18n.getMessage('typeDate', LOCALE);
    const items = [];

    const isoDate = formatDate(date);
    if (isoDate !== text) {
      items.push({ label: `${typeName} – ${i18n.getMessage('date', LOCALE)}`, value: isoDate });
    }

    items.push({ label: `${typeName} – ${i18n.getMessage('dateLocalized', LOCALE)}`, value: formatDateLocalized(date) });
    items.push({ label: `${typeName} – ${i18n.getMessage('milliseconds', LOCALE)}`, value: String(date.getTime()) });

    return items;
  }

  function tryNumber(original) {
    const text = original.value;
    // Match integers and decimals, with optional negative sign
    if (!/^-?\d+(\.\d+)?$/.test(text)) return null;

    // Avoid treating long hex-like strings (even length, 40+ chars, only digits) as numbers
    if (text.length >= 40 && text.length % 2 === 0 && /^\d+$/.test(text)) return null;

    const num = parseFloat(text);
    if (!isFinite(num)) return null;

    const isInteger = Number.isInteger(num);

    const items = [];

    // Formatted with thousands separators
    const typeName = i18n.getMessage('typeNumber', LOCALE);
    const label = i18n.getMessage('formatted', LOCALE);

    if (isInteger) {
      const formatted = num.toLocaleString(LOCALE);
      if (formatted !== text) {
        items.push({ label: `${typeName} – ${label}`, value: formatted });
      }
    } else {
      const formatted = num.toLocaleString(LOCALE, { maximumFractionDigits: 10 });
      if (formatted !== text) {
        items.push({ label: `${typeName} – ${label}`, value: formatted });
      }
    }

    return items.length > 0 ? items : null;
  }

  function tryTimestampMilliseconds(original) {
    const text = original.value;
    // Match integers and decimals, with optional negative sign
    if (!/^-?\d+(\.\d+)?$/.test(text)) return null;

    // Avoid treating long hex-like strings (even length, 40+ chars, only digits) as numbers
    if (text.length >= 40 && text.length % 2 === 0 && /^\d+$/.test(text)) return null;

    const num = parseFloat(text);
    if (!isFinite(num)) return null;

    const isInteger = Number.isInteger(num);

    // Only process integers >= 0 within reasonable timestamp range
    if (!isInteger || num < 0) return null;

    // Max milliseconds: 10000000000000 (year ~2286)
    if (num > 10000000000000) return null;

    const typeName = i18n.getMessage('typeTimestampMilliseconds', LOCALE);
    const date = new Date(num);

    return [
      { label: `${typeName} – ${i18n.getMessage('date', LOCALE)}`, value: formatDate(date) },
      { label: `${typeName} – ${i18n.getMessage('dateLocalized', LOCALE)}`, value: formatDateLocalized(date) },
    ];
  }

  function tryTimestampSeconds(original) {
    const text = original.value;
    // Match integers and decimals, with optional negative sign
    if (!/^-?\d+(\.\d+)?$/.test(text)) return null;

    // Avoid treating long hex-like strings (even length, 40+ chars, only digits) as numbers
    if (text.length >= 40 && text.length % 2 === 0 && /^\d+$/.test(text)) return null;

    const num = parseFloat(text);
    if (!isFinite(num)) return null;

    const isInteger = Number.isInteger(num);

    // Only process integers >= 0 within reasonable timestamp range
    if (!isInteger || num < 0) return null;

    // Max seconds: 10000000000 (year ~2286)
    if (num > 10000000000) return null;

    const typeName = i18n.getMessage('typeTimestampSeconds', LOCALE);
    const date = new Date(num * 1000);

    return [
      { label: `${typeName} – ${i18n.getMessage('date', LOCALE)}`, value: formatDate(date) },
      { label: `${typeName} – ${i18n.getMessage('dateLocalized', LOCALE)}`, value: formatDateLocalized(date) },
    ];
  }

  function tryUrl(original) {
    const text = original.value;
    // Must start with http:// or https://
    if (!text.startsWith('http://') && !text.startsWith('https://')) return null;

    try {
      const url = new URL(text);

      const hasParams = url.searchParams.toString().length > 0;
      const typeName = i18n.getMessage('typeUrl', LOCALE);

      const items = [
        { label: `${typeName} – ${i18n.getMessage('protocol', LOCALE)}`, value: url.protocol.replace(':', '') },
        { label: `${typeName} – ${i18n.getMessage('host', LOCALE)}`, value: url.host },
      ];

      if (url.port) items.push({ label: `${typeName} – ${i18n.getMessage('port', LOCALE)}`, value: url.port });
      if (url.pathname !== '/') items.push({ label: `${typeName} – ${i18n.getMessage('path', LOCALE)}`, value: url.pathname });
      if (url.hash) items.push({ label: `${typeName} – ${i18n.getMessage('fragment', LOCALE)}`, value: url.hash.slice(1) });

      if (hasParams) {
        for (const [key, value] of url.searchParams) {
          // Try to decode the value if it looks encoded
          let displayValue = value;
          try {
            const decoded = decodeURIComponent(value);
            if (decoded !== value) displayValue = decoded;
          } catch (_) {
            // If decoding fails, use the original value
          }
          items.push({ label: `${typeName} – ${i18n.getMessage('param', LOCALE, key)}`, value: displayValue });
        }
      }

      return items;
    } catch (_) {
      return null;
    }
  }

  function tryXml(original) {
    const text = original.value;
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

      original.type = 'xml';
      const typeName = i18n.getMessage('typeXml', LOCALE);
      const label = i18n.getMessage('formatted', LOCALE);
      return [
        { label: `${typeName} – ${label}`, value: formatted, type: 'xml' },
      ];
    } catch (_) {
      return null;
    }
  }

  function tryYaml(original) {
    const text = original.value;
    // YAML typically starts with common patterns
    // Check for YAML indicators: keys with colons, list items with dashes, or document separators
    const yamlPatterns = [
      /^---/,                           // Document separator
      /^\w+:/m,                         // Key-value pair
      /^-\s+\w+:/m,                     // List item with object
      /^-\s+[^-]/m,                     // List item
    ];

    const hasYamlPattern = yamlPatterns.some(pattern => pattern.test(text));
    if (!hasYamlPattern) return null;

    // Avoid false positives: must not look like JSON, XML, or other formats
    if (text.startsWith('{') || text.startsWith('[') || text.startsWith('<')) return null;

    // Try to parse with js-yaml to validate it's valid YAML
    try {
      const parsed = jsyaml.load(text);

      // Must parse to an object or array (not just a string or number)
      if (typeof parsed !== 'object' || parsed === null) return null;

      original.type = 'yaml';
      return [];
    } catch (_) {
      return null;
    }
  }

  function tryHex(original) {
    const text = original.value;
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

    const items = [];

    if (printable) {
      const decoded = bytes.map(b => String.fromCharCode(b)).join('');
      const decodedItem = { label: 'Decoded', value: decoded, type: 'text' };
      const decodedFormatted = tryFormatters(decodedItem, ['base64', 'hex']);

      // If a nested type was detected, don't show the Hex decoded item, just show the formatted nested type items
      if (decodedItem.type !== 'text' && decodedFormatted.length > 0) {
        return decodedFormatted;
      }

      // Plain text decoding
      const typeName = i18n.getMessage('typeHex', LOCALE);
      const label = i18n.getMessage('decoded', LOCALE);
      decodedItem.label = `${typeName} – ${label}`;

      items.push(decodedItem);
      items.push(...decodedFormatted);
    } else {
      // Show hex dump
      let hexDump = '';
      for (let i = 0; i < bytes.length; i += 16) {
        const chunk = bytes.slice(i, i + 16);
        const hex = chunk.map(b => b.toString(16).padStart(2, '0')).join(' ');
        const ascii = chunk.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
        hexDump += `${i.toString(16).padStart(4, '0')}  ${hex.padEnd(48)}  ${ascii}\n`;
      }
      const typeName = i18n.getMessage('typeHex', LOCALE);
      items.push({ label: `${typeName} – ${i18n.getMessage('hexDump', LOCALE)}`, value: hexDump.trim() });
    }

    return items;
  }

  function tryUuid(original) {
    const text = original.value;
    // Standard UUID format: 8-4-4-4-12
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-([1-5])[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    const match = text.match(uuidRegex);
    if (!match) return null;

    const version = match[1];
    const versionNames = {
      '1': i18n.getMessage('uuidVersion1', LOCALE),
      '2': i18n.getMessage('uuidVersion2', LOCALE),
      '3': i18n.getMessage('uuidVersion3', LOCALE),
      '4': i18n.getMessage('uuidVersion4', LOCALE),
      '5': i18n.getMessage('uuidVersion5', LOCALE)
    };

    const typeName = i18n.getMessage('typeUuid', LOCALE);
    return [
      { label: `${typeName} – ${i18n.getMessage('version', LOCALE)}`, value: `${version} – ${versionNames[version] || i18n.getMessage('unknown', LOCALE)}` },
    ];
  }

  // Define formatters in priority order with their types
  const FORMATTERS = [
    { func: tryJwt, type: 'jwt' },
    { func: tryJson, type: 'json' },
    { func: tryUuid, type: 'uuid' },
    { func: tryDate, type: 'date' },
    { func: tryNumber, type: 'number' },
    { func: tryTimestampMilliseconds, type: 'timestamp_ms' },
    { func: tryTimestampSeconds, type: 'timestamp_s' },
    { func: tryUrl, type: 'url' },
    { func: tryXml, type: 'xml' },
    { func: tryYaml, type: 'yaml' },
    { func: tryBase64, type: 'base64' },
    { func: tryHex, type: 'hex' },
  ];

  function tryFormatters(original, excludeTypes = []) {
    const allResults = [];

    for (const formatter of FORMATTERS) {
      if (excludeTypes.includes(formatter.type)) continue;

      const result = formatter.func(original);
      if (result && result.length > 0) {
        allResults.push(...result);
      }
    }

    return allResults;
  }

  function detectContentType(text) {
    const original = { label: i18n.getMessage('original', LOCALE), value: text, type: 'text' };
    const formatted = tryFormatters(original);
    return [original, ...formatted];
  }

  self.pigquery ||= {};
  self.pigquery.formatters = {
    detectContentType,
  };

})();
