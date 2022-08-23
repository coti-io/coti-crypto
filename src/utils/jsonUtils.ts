/* eslint-disable no-use-before-define */
/* eslint-disable callback-return */
// eslint-disable no-use-before-define
import { BigDecimal } from './utils';

export interface JsonUtilsOptions {
  bigDecimal?: boolean; // decide if you want numbers above 17 charecters as string or big decimal
}

export interface JsonUtilsOptions {
  keyList?: Map<string, boolean>; // a list of keys that their value will be replaced to big decimal
  strict?: boolean; // not being strict means do not generate syntax errors for "duplicate key"
  storeAsString?: boolean; // toggles whether the values should be stored as BigNumber (default) or a string
  alwaysParseAsBig?: boolean; // toggles whether all numbers should be Big
  protoAction?: 'error' | 'ignore' | 'preserve';
  constructorAction?: 'error' | 'ignore' | 'preserve';
}

export class JsonUtils {
  suspectProtoRx: RegExp =
    /(?:_|\\u005[Ff])(?:_|\\u005[Ff])(?:p|\\u0070)(?:r|\\u0072)(?:o|\\u006[Ff])(?:t|\\u0074)(?:o|\\u006[Ff])(?:_|\\u005[Ff])(?:_|\\u005[Ff])/;
  suspectConstructorRx: RegExp =
    /(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)/;

  options: JsonUtilsOptions = { bigDecimal: false };
  escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
  meta = {
    // table of character substitutions
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '"': '\\"',
    '\\': '\\\\',
  } as Record<string, string>;

  constructor(options?: JsonUtilsOptions) {
    this.options = { ...this.options, ...options };
  }

  parse(options: JsonUtilsOptions = this.options): any {
    // This is a function that can parse a JSON text, producing a JavaScript
    // data structure. It is a simple, recursive descent parser. It does not use
    // eval or regular expressions, so it can be used as a model for implementing
    // a JSON parser in other languages.

    // We are defining the function inside of another function to avoid creating
    // global variables.

    // Default options one can override by passing options to the parse()
    const _options: JsonUtilsOptions = {
      keyList: new Map(), // a list of keys that their value will be replaced to big decimal
      strict: false, // not being strict means do not generate syntax errors for "duplicate key"
      storeAsString: true, // toggles whether the values should be stored as BigDecimal or a string (default)
      alwaysParseAsBig: false, // toggles whether all numbers should be Big
      protoAction: 'error',
      constructorAction: 'error',
    };

    // If there are options, then use them to override the default _options
    if (options !== undefined && options !== null) {
      if (options.keyList) _options.keyList = options.keyList;
      if (options.strict === true) {
        _options.strict = true;
      }
      if (options.storeAsString === true) {
        _options.storeAsString = true;
      }
      _options.alwaysParseAsBig = options.alwaysParseAsBig === true ? options.alwaysParseAsBig : false;

      if (typeof options.constructorAction !== 'undefined') {
        if (options.constructorAction === 'error' || options.constructorAction === 'ignore' || options.constructorAction === 'preserve') {
          _options.constructorAction = options.constructorAction;
        } else {
          throw new Error(
            `Incorrect value for constructorAction option, must be "error", "ignore" or undefined but passed ${options.constructorAction}`
          );
        }
      }

      if (typeof options.protoAction !== 'undefined') {
        if (options.protoAction === 'error' || options.protoAction === 'ignore' || options.protoAction === 'preserve') {
          _options.protoAction = options.protoAction;
        } else {
          throw new Error(`Incorrect value for protoAction option, must be "error", "ignore" or undefined but passed ${options.protoAction}`);
        }
      }
    }

    let at: number; // The index of the current character
    let ch: string; // The current character
    const escapee = {
      '"': '"',
      '\\': '\\',
      '/': '/',
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
    };
    let text: string;
    const error = (m: string): Error => {
      // Call error when something is wrong.

      throw {
        name: 'SyntaxError',
        message: m,
        at,
        text,
      };
    };
    const next = (c?: string): string => {
      // If a c parameter is provided, verify that it matches the current character.

      if (c && c !== ch) {
        error(`Expected '${c}' instead of '${ch}'`);
      }

      // Get the next character. When there are no more characters,
      // return the empty string.

      ch = text.charAt(at);
      at += 1;
      return ch;
    };
    const number = (key?: string): number | string | undefined => {
      // Parse a number value.

      let number;
      let string = '';

      if (ch === '-') {
        string = '-';
        next('-');
      }
      while (ch >= '0' && ch <= '9') {
        string += ch;
        next();
      }
      if (ch === '.') {
        string += '.';
        while (next() && ch >= '0' && ch <= '9') {
          string += ch;
        }
      }
      if (ch === 'e' || ch === 'E') {
        string += ch;
        next();
        // @ts-ignore
        if (ch === '-' || ch === '+') {
          string += ch;
          next();
        }
        while (ch >= '0' && ch <= '9') {
          string += ch;
          next();
        }
      }
      number = +string;
      if (!isFinite(number)) {
        error('Bad number');
      } else {
        // replace with if key in the keyList
        if (_options.keyList && key && _options.keyList.get(key)) {
          //return _options.storeAsString ? string : new BigDecimal(string);
          //const res = _options.storeAsString ? new BigDecimal(string).toFixed() : new BigDecimal(string);
          return new BigDecimal(string).toFixed();
        }
        return !_options.alwaysParseAsBig ? number : new BigDecimal(string).toFixed();
      }
    };
    const string = (): string | undefined => {
      // Parse a string value.

      let hex;
      let i;
      let string = '';
      let uffff;

      // When parsing for string values, we must look for " and \ characters.

      if (ch === '"') {
        let startAt = at;
        while (next()) {
          if (ch === '"') {
            if (at - 1 > startAt) string += text.substring(startAt, at - 1);
            next();
            return string;
          }
          if (ch === '\\') {
            if (at - 1 > startAt) string += text.substring(startAt, at - 1);
            next();
            if (ch === 'u') {
              uffff = 0;
              for (i = 0; i < 4; i += 1) {
                hex = parseInt(next(), 16);
                if (!isFinite(hex)) {
                  break;
                }
                uffff = uffff * 16 + hex;
              }
              string += String.fromCharCode(uffff);
            } else if (typeof escapee[ch] === 'string') {
              string += escapee[ch];
            } else {
              break;
            }
            startAt = at;
          }
        }
      }
      error('Bad string');
    };
    const white = (): void => {
      // Skip whitespace.

      while (ch && ch <= ' ') {
        next();
      }
    };
    const word = (): boolean | null | undefined => {
      // true, false, or null.

      switch (ch) {
        case 't':
          next('t');
          next('r');
          next('u');
          next('e');
          return true;
        case 'f':
          next('f');
          next('a');
          next('l');
          next('s');
          next('e');
          return false;
        case 'n':
          next('n');
          next('u');
          next('l');
          next('l');
          return null;
      }
      error(`Unexpected '${ch}'`);
    };

    const value = (key?: string): any => {
      // Parse a JSON value. It could be an object, an array, a string, a number,
      // or a word.

      white();
      switch (ch) {
        case '{':
          return object();
        case '[':
          return array();
        case '"':
          return string();
        case '-':
          return number(key);
        default:
          return ch >= '0' && ch <= '9' ? number(key) : word();
      }
    };
    const array = (): any => {
      // Parse an array value.

      const array = [] as unknown[];

      if (ch === '[') {
        next('[');
        white();
        // @ts-ignore
        if (ch === ']') {
          next(']');
          return array; // empty array
        }
        while (ch) {
          array.push(value());
          white();
          // @ts-ignore
          if (ch === ']') {
            next(']');
            return array;
          }
          next(',');
          white();
        }
      }
      error('Bad array');
    };
    const object = (): any => {
      // Parse an object value.

      let key;
      const object = Object.create(null);

      if (ch === '{') {
        next('{');
        white();
        // @ts-ignore
        if (ch === '}') {
          next('}');
          return object; // empty object
        }
        while (ch) {
          key = string()!;
          white();
          next(':');
          if (_options.strict === true && Object.hasOwnProperty.call(object, key)) {
            error(`Duplicate key "${key}"`);
          }

          if (this.suspectProtoRx.test(key) === true) {
            if (_options.protoAction === 'error') {
              error('Object contains forbidden prototype property');
            } else if (_options.protoAction === 'ignore') {
              value(key);
            } else {
              object[key] = value(key);
            }
          } else if (this.suspectConstructorRx.test(key)) {
            if (_options.constructorAction === 'error') {
              error('Object contains forbidden constructor property');
            } else if (_options.constructorAction === 'ignore') {
              value(key);
            } else {
              object[key] = value(key);
            }
          } else {
            object[key] = value(key);
          }

          white();
          // @ts-ignore
          if (ch === '}') {
            next('}');
            return object;
          }
          next(',');
          white();
        }
      }
      error('Bad object');
    };

    // Return the json_parse function. It will have access to all of the above
    // functions and variables.

    return function (source: unknown, reviver?: Function): any {
      let result;

      text = `${source}`;
      at = 0;
      ch = ' ';
      result = value();
      white();
      if (ch) {
        error('Syntax error');
      }

      // If there is a reviver function, we recursively walk the new structure,
      // passing each name/value pair to the reviver function for possible
      // transformation, starting with a temporary root object that holds the result
      // in an empty key. If there is not a reviver function, we simply return the
      // result.

      return typeof reviver === 'function'
        ? (function walk(holder: any, key): string {
            let v;
            const value = holder[key];
            if (value && typeof value === 'object') {
              Object.keys(value).forEach(k => {
                v = walk(value, k);
                if (v !== undefined) {
                  value[k] = v;
                } else {
                  delete value[k];
                }
              });
            }
            return reviver.call(holder, key, value);
          })({ '': result }, '')
        : result;
    };
  }

  stringify(value: unknown, replacer?: Function | object | number, space?: string | number): string {
    // The stringify method takes a value and an optional replacer, and an optional
    // space parameter, and returns a JSON text. The replacer can be a function
    // that can replace values, or an array of strings that will select the keys.
    // A default replacer method can be provided. Use of the space parameter can
    // produce text that is more easily readable.

    const quote = (string: string): string => {
      // If the string contains no control characters, no quote characters, and no
      // backslash characters, then we can safely slap some quotes around it.
      // Otherwise we must also replace the offending characters with safe escape
      // sequences.

      this.escapable.lastIndex = 0;
      return this.escapable.test(string)
        ? `"${string.replace(this.escapable, a => {
            const c = this.meta[a];
            return typeof c === 'string' ? c : `\\u${`0000${a.charCodeAt(0).toString(16)}`.slice(-4)}`;
          })}"`
        : `"${string}"`;
    };

    const str = (key: string | number, holder: Record<string | number, any>): string => {
      // Produce a string from holder[key].

      let i; // The loop counter.
      let k; // The member key.
      let v; // The member value.
      let length;
      const mind = gap;
      let partial;
      let value = holder[key];
      const isBigDecimal = value !== null && (value instanceof BigDecimal || BigDecimal.isDecimal(value));

      // If the value has a toJSON method, call it to obtain a replacement value.

      if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
        value = value.toJSON(key);
      }

      // If we were called with a replacer function, then call the replacer to
      // obtain a replacement value.

      if (typeof replacer === 'function') {
        value = replacer.call(holder, key, value);
      }

      // What happens next depends on the value's type.

      switch (typeof value) {
        case 'string':
          if (isBigDecimal) {
            return value;
          }
          return quote(value);

        case 'number':
          // JSON numbers must be finite. Encode non-finite numbers as null.

          return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'bigint':
          // If the value is a boolean or null, convert it to a string. Note:
          // typeof null does not produce 'null'. The case is included here in
          // the remote chance that this gets fixed someday.

          return String(value);

        // If the type is 'object', we might be dealing with an object or an array or
        // null.

        case 'object':
          // Due to a specification blunder in ECMAScript, typeof null is 'object',
          // so watch out for that case.

          if (!value) {
            return 'null';
          }

          // Make an array to hold the partial results of stringifying this object value.

          gap += indent;
          partial = [];

          // Is the value an array?

          if (Object.prototype.toString.apply(value) === '[object Array]') {
            // The value is an array. Stringify every element. Use null as a placeholder
            // for non-JSON values.

            length = value.length;
            for (i = 0; i < length; i += 1) {
              partial[i] = str(i, value) || 'null';
            }

            // Join all of the elements together, separated with commas, and wrap them in
            // brackets.

            v = partial.length === 0 ? '[]' : gap ? `[\n${gap}${partial.join(`,\n${gap}`)}\n${mind}]` : `[${partial.join(',')}]`;
            gap = mind;
            return v;
          }

          // If the replacer is an array, use it to select the members to be stringified.

          if (Array.isArray(replacer)) {
            length = replacer.length;
            for (i = 0; i < length; i += 1) {
              if (typeof replacer[i] === 'string') {
                k = replacer[i];
                v = str(k, value);
                if (v) {
                  partial.push(quote(k) + (gap ? ': ' : ':') + v);
                }
              }
            }
          } else {
            // Otherwise, iterate through all of the keys in the object.

            Object.keys(value).forEach(k => {
              const v = str(k, value);
              if (v) {
                partial.push(quote(k) + (gap ? ': ' : ':') + v);
              }
            });
          }

          // Join all of the member texts together, separated with commas,
          // and wrap them in braces.

          v = partial.length === 0 ? '{}' : gap ? `{\n${gap}${partial.join(`,\n${gap}`)}\n${mind}}` : `{${partial.join(',')}}`;
          gap = mind;
          return v;
        default:
          return 'null';
      }
    };
    let i;
    let gap = '';
    let indent = '';

    // If the space parameter is a number, make an indent string containing that
    // many spaces.

    if (typeof space === 'number') {
      for (i = 0; i < space; i += 1) {
        indent += ' ';
      }

      // If the space parameter is a string, it will be used as the indent string.
    } else if (typeof space === 'string') {
      indent = space;
    }

    // If there is a replacer, it must be a function or an array.
    // Otherwise, throw an error.
    if (replacer && typeof replacer !== 'function' && !Array.isArray(replacer)) {
      throw new Error('JSON.stringify');
    }

    // Make a fake root object containing our value under the key of ''.
    // Return the result of stringifying the value.

    return str('', { '': value });
  }
}

const map = new Map<string, boolean>();
map.set('mintingAmount', true);
map.set('amount', true);
map.set('originalAmount', true);
map.set('feeAmount', true);
map.set('reducedAmount', true);
map.set('mintedAmount', true);
map.set('mintableAmount', true);
map.set('totalSupply', true);
map.set('addressBalance', true);
map.set('addressPreBalance', true);
map.set('reducedAmount', true);
// map.set('trustChainTrustScore', true);
// map.set('senderTrustScore', true);
const jsonUtilsOptions: JsonUtilsOptions = { keyList: map };
const jsonUtils = new JsonUtils(jsonUtilsOptions);
export const cotiParser = jsonUtils.parse();
