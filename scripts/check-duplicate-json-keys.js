/* Checks JSON files for duplicate object keys (raw scan).
 * Note: JSON.parse() would silently keep the last duplicate; this catches them.
 */

const fs = require('fs');

function scanDuplicates(jsonText) {
  let i = 0;
  const len = jsonText.length;

  const stack = []; // { type: 'object'|'array', keys?: Set<string>, index?: number, keyPart: string }
  let expecting = 'value';
  let lastKey = null;

  function isWS(ch) {
    return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
  }

  function skipWS() {
    while (i < len && isWS(jsonText[i])) i++;
  }

  function readString() {
    i++; // opening quote
    let out = '';
    while (i < len) {
      const ch = jsonText[i++];
      if (ch === '"') return out;
      if (ch === '\\') {
        const esc = jsonText[i++];
        if (esc === '"' || esc === '\\' || esc === '/') out += esc;
        else if (esc === 'b') out += '\b';
        else if (esc === 'f') out += '\f';
        else if (esc === 'n') out += '\n';
        else if (esc === 'r') out += '\r';
        else if (esc === 't') out += '\t';
        else if (esc === 'u') {
          const hex = jsonText.slice(i, i + 4);
          if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error('Invalid \\u escape');
          out += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else {
          throw new Error('Invalid escape: \\' + esc);
        }
      } else {
        out += ch;
      }
    }
    throw new Error('Unterminated string');
  }

  function currentPath() {
    const parts = stack.map((s) => s.keyPart).filter(Boolean);
    return parts.length ? '$' + parts.join('') : '$';
  }

  const dups = [];

  function pushObject() {
    const parent = stack[stack.length - 1];
    const keyPart = parent?.type === 'array'
      ? `[${parent.index}]`
      : lastKey != null
        ? `.${lastKey}`
        : '';
    stack.push({ type: 'object', keys: new Set(), keyPart });
  }

  function pushArray() {
    const parent = stack[stack.length - 1];
    const keyPart = parent?.type === 'array'
      ? `[${parent.index}]`
      : lastKey != null
        ? `.${lastKey}`
        : '';
    stack.push({ type: 'array', index: 0, keyPart });
  }

  function finishValue() {
    const top = stack[stack.length - 1];
    if (top && top.type === 'array') top.index++;
    lastKey = null;
  }

  while (i < len) {
    skipWS();
    if (i >= len) break;

    const ch = jsonText[i];

    if (ch === '{') {
      i++;
      pushObject();
      expecting = 'keyOrEnd';
      continue;
    }

    if (ch === '[') {
      i++;
      pushArray();
      expecting = 'valueOrEnd';
      continue;
    }

    if (ch === '}' || ch === ']') {
      i++;
      stack.pop();
      finishValue();
      expecting = 'commaOrEnd';
      continue;
    }

    if (ch === ',') {
      i++;
      const top = stack[stack.length - 1];
      expecting = top?.type === 'object' ? 'key' : 'value';
      continue;
    }

    if (ch === ':') {
      i++;
      expecting = 'value';
      continue;
    }

    if (ch === '"') {
      const str = readString();
      const top = stack[stack.length - 1];
      if (top?.type === 'object' && (expecting === 'key' || expecting === 'keyOrEnd')) {
        if (top.keys.has(str)) {
          dups.push(`${currentPath()}.${str}`);
        }
        top.keys.add(str);
        lastKey = str;
        expecting = 'colon';
      } else {
        finishValue();
        expecting = 'commaOrEnd';
      }
      continue;
    }

    // primitives: true/false/null/number
    if (/[-0-9tfn]/.test(ch)) {
      while (i < len && !isWS(jsonText[i]) && !/[\],}:,]/.test(jsonText[i])) i++;
      finishValue();
      expecting = 'commaOrEnd';
      continue;
    }

    throw new Error(`Unexpected token '${ch}' at position ${i}`);
  }

  return dups;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/check-duplicate-json-keys.js <file1.json> <file2.json> ...');
  process.exit(2);
}

let any = false;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const dups = scanDuplicates(text);
  if (dups.length) {
    any = true;
    console.log(`\n${f}: DUPLICATE KEYS FOUND (${dups.length})`);
    console.log(dups.slice(0, 50).join('\n'));
    if (dups.length > 50) console.log(`...and ${dups.length - 50} more`);
  } else {
    console.log(`\n${f}: no duplicate keys`);
  }
}

process.exit(any ? 1 : 0);
