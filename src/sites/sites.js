import { Jwt } from './jwt.js';
import { Json } from './json.js';
import { Uuid } from './uuid.js';
import { DateFormat } from './date.js';
import { NumberFormat } from './number.js';
import { TimestampMilliseconds } from './timestamp-milliseconds.js';
import { TimestampSeconds } from './timestamp-seconds.js';
import { Url } from './url.js';
import { Xml } from './xml.js';
import { Yaml } from './yaml.js';
import { Base64 } from './base64.js';
import { Hex } from './hex.js';
import { OpenUrl } from './open-url.js';

export class Sites {
  static default(locale) {
    return [
      new Jwt(locale),
      new Json(locale),
      new Uuid(locale),
      new DateFormat(locale),
      new NumberFormat(locale),
      new TimestampMilliseconds(locale),
      new TimestampSeconds(locale),
      new Url(locale),
      new Xml(locale),
      new Yaml(locale),
      new Base64(locale),
      new Hex(locale),
      new OpenUrl(locale),
    ];
  }
}
