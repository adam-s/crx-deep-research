/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// NOTE: this function should not be used to escape any selectors.
export function escapeWithQuotes(text: string, char: string = "'"): string {
  const stringified = JSON.stringify(text);
  const escapedText = stringified.substring(1, stringified.length - 1).replace(/\\"/g, '"');

  if (char === "'") {
    return char + escapedText.replace(/['']/g, "\\'") + char;
  }
  if (char === '"') {
    return char + escapedText.replace(/[\"]/g, '\\"') + char;
  }
  if (char === '`') {
    return char + escapedText.replace(/[`]/g, '`') + char;
  }

  throw new Error('Invalid escape char');
}

export function escapeTemplateString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\`').replace(/\$\{/g, '\${');
}

export function isString(obj: any): obj is string {
  return typeof obj === 'string' || obj instanceof String;
}

export function toTitleCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.substring(1);
}

export function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

export function quoteCSSAttributeValue(text: string): string {
  return `"${text.replace(/[\"\\]/g, char => `\\${char}`)}"`;
}

let normalizedWhitespaceCache: Map<string, string> | undefined;

export function cacheNormalizedWhitespaces(): void {
  normalizedWhitespaceCache = new Map();
}

export function normalizeWhiteSpace(text: string): string {
  let result = normalizedWhitespaceCache?.get(text);
  if (result === undefined) {
    result = text
      .replace(/[\u200b\u00ad]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
    normalizedWhitespaceCache?.set(text, result);
  }
  return result;
}

export function normalizeEscapedRegexQuotes(source: string): string {
  // Reverses escapeRegexForSelector effects: remove unnecessary backslashes before quotes
  return source.replace(/(^|[^\\])(\\\\)*\\(['"`])/g, '$1$2$3');
}

function escapeRegexForSelector(re: RegExp): string {
  // Unicode mode does not allow "identity character escapes", so return literal
  if (re.unicode || (re as any).unicodeSets) {
    return String(re);
  }
  // Even number of backslashes followed by a quote -> insert a backslash
  return String(re)
    .replace(/(^|[^\\])(\\\\)*(["'`])/g, '$1$2\\$3')
    .replace(/>>/g, '\\>\\>');
}

export function escapeForTextSelector(text: string | RegExp, exact: boolean): string {
  if (typeof text !== 'string') {
    return escapeRegexForSelector(text);
  }
  return `${JSON.stringify(text)}${exact ? 's' : 'i'}`;
}

export function escapeForAttributeSelector(value: string | RegExp, exact: boolean): string {
  if (typeof value !== 'string') {
    return escapeRegexForSelector(value);
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/[\"]/g, '\\\"')}"${exact ? 's' : 'i'}`;
}

export function trimString(input: string, cap: number, suffix: string = ''): string {
  if (input.length <= cap) {
    return input;
  }
  const chars = [...input];
  if (chars.length > cap) {
    return chars.slice(0, cap - suffix.length).join('') + suffix;
  }
  return chars.join('');
}

export function trimStringWithEllipsis(input: string, cap: number): string {
  return trimString(input, cap, '\u2026');
}

export function escapeRegExp(s: string): string {
  // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHTMLAttribute(s: string): string {
  return s.replace(/[&<>"']/gu, char => htmlEscapes[char]);
}

export function escapeHTML(s: string): string {
  return s.replace(/[&<]/gu, char => htmlEscapes[char]);
}

export function longestCommonSubstring(s1: string, s2: string): string {
  const n = s1.length;
  const m = s2.length;
  let maxLen = 0;
  let endingIndex = 0;

  // Initialize DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  // Build the table
  for (let i = 1; i <= n; ++i) {
    for (let j = 1; j <= m; ++j) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > maxLen) {
          maxLen = dp[i][j];
          endingIndex = i;
        }
      }
    }
  }

  return s1.slice(endingIndex - maxLen, endingIndex);
}
