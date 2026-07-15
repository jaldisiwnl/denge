/** Removes keys whose value is undefined so records stay clean in IndexedDB. */
export function stripUndefined<T extends object>(obj: T): T {
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] === undefined) delete obj[key];
  }
  return obj;
}
