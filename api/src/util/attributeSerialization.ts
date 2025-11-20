// util/attributeSerialization.ts
const INTEGER_STRING_REGEX = /^-?\d+$/;

export function serializeAttributes(attributes: Record<string, any>): string {
  return JSON.stringify(attributes, (_key, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  });
}

export function deserializeAttributes(serialized: string): Record<string, any> {
  const parsed = JSON.parse(serialized || "{}");

  const revive = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(revive);
    }
    if (typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        obj[key] = revive(obj[key]);
      }
      return obj;
    }
    if (typeof obj === "string" && INTEGER_STRING_REGEX.test(obj)) {
      return BigInt(obj);
    }
    return obj;
  };

  return revive(parsed);
}
