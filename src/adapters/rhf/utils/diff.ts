import type { Patch } from "./types";

/* ================================ Utilities ================================== */

function isObject(x: any): boolean {
  return x !== null && typeof x === "object";
}

export function deepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;

    const aHasIds =
      a.length > 0 && a[0] && typeof a[0] === "object" && "id" in a[0];
    const bHasIds =
      b.length > 0 && b[0] && typeof b[0] === "object" && "id" in b[0];

    if (aHasIds && bHasIds) {
      const aIds = a.map((item: any) => item.id).sort();
      const bIds = b.map((item: any) => item.id).sort();
      return JSON.stringify(aIds) === JSON.stringify(bIds);
    }

    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (isObject(a) && isObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!deepEqual(a[k], (b as any)[k])) return false;
    }
    return true;
  }

  return false;
}

export function diffToPatches(prev: any, next: any, basePath = ""): Patch[] {
  if (deepEqual(prev, next)) return [];

  if (Array.isArray(prev) && Array.isArray(next)) {
    return [
      {
        name: basePath,
        prevValue: prev,
        nextValue: next,
        rootField: basePath.includes(".") ? basePath.split(".")[0] : basePath,
      },
    ];
  }

  const prevIsObj =
    isObject(prev) && !Array.isArray(prev) && !(prev instanceof Date);
  const nextIsObj =
    isObject(next) && !Array.isArray(next) && !(next instanceof Date);

  if (!prevIsObj || !nextIsObj) {
    return [
      {
        name: basePath,
        prevValue: prev,
        nextValue: next,
        rootField: basePath.includes(".") ? basePath.split(".")[0] : basePath,
      },
    ];
  }

  const patches: Patch[] = [];
  const keys = new Set<string>([
    ...Object.keys(prev ?? {}),
    ...Object.keys(next ?? {}),
  ]);
  for (const k of keys) {
    const childPath = basePath ? `${basePath}.${k}` : k;
    const p = (prev ?? {})[k];
    const n = (next ?? {})[k];

    if (!deepEqual(p, n)) {
      if (Array.isArray(p) && Array.isArray(n)) {
        patches.push({
          name: childPath,
          prevValue: p,
          nextValue: n,
          rootField: childPath.includes(".")
            ? childPath.split(".")[0]
            : childPath,
        });
      } else if (p instanceof Date && n instanceof Date) {
        patches.push({
          name: childPath,
          prevValue: p,
          nextValue: n,
          rootField: childPath.includes(".")
            ? childPath.split(".")[0]
            : childPath,
        });
      } else if (isObject(p) && isObject(n)) {
        patches.push(...diffToPatches(p, n, childPath));
      } else {
        patches.push({
          name: childPath,
          prevValue: p,
          nextValue: n,
          rootField: childPath.includes(".")
            ? childPath.split(".")[0]
            : childPath,
        });
      }
    }
  }
  return patches;
}

export function stableStringify(obj: Record<string, any>): string {
  const keys = Object.keys(obj).sort();
  const out: Record<string, any> = {};
  for (const k of keys) out[k] = obj[k];
  return JSON.stringify(out);
}

export function isEditableElement(el: Element | null): boolean {
  if (!el || !(el as HTMLElement).closest) return false;
  const node = el as HTMLElement;
  if (node.isContentEditable) return true;
  const tag = node.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  // Also consider elements with role="textbox"
  if (node.getAttribute && node.getAttribute("role") === "textbox") return true;
  return false;
}
