/**
 * Field Path Utilities
 * Utilities for working with nested field paths in forms
 * Supports both dot notation (user.profile.name) and bracket notation (user[0].name)
 */

export type FieldPath = string;
export type PathSegment = string | number;

/**
 * Parse a field path string into an array of segments
 * Supports: 'user.name', 'user[0]', 'user[0].name', 'user.items[0].value'
 * 
 * @example
 * parsePath('user.profile.name') // ['user', 'profile', 'name']
 * parsePath('users[0].name') // ['users', 0, 'name']
 * parsePath('items[0][1]') // ['items', 0, 1]
 */
export function parsePath(path: string): PathSegment[] {
  if (!path) return [];

  const segments: PathSegment[] = [];
  let current = '';
  let inBracket = false;

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (char === '[') {
      if (current) {
        segments.push(current);
        current = '';
      }
      inBracket = true;
    } else if (char === ']') {
      if (inBracket && current) {
        const num = parseInt(current, 10);
        segments.push(isNaN(num) ? current : num);
        current = '';
      }
      inBracket = false;
    } else if (char === '.' && !inBracket) {
      if (current) {
        segments.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

/**
 * Convert path segments back to a string path
 * 
 * @example
 * joinPath(['user', 'profile', 'name']) // 'user.profile.name'
 * joinPath(['users', 0, 'name']) // 'users[0].name'
 */
export function joinPath(segments: PathSegment[]): string {
  if (!segments || segments.length === 0) return '';

  return segments.reduce((path, segment, index) => {
    if (typeof segment === 'number') {
      return `${path}[${segment}]`;
    }
    return index === 0 ? segment : `${path}.${segment}`;
  }, '') as string;
}

/**
 * Get a value from an object using a path
 * 
 * @example
 * getByPath({ user: { name: 'John' } }, 'user.name') // 'John'
 * getByPath({ users: [{ name: 'John' }] }, 'users[0].name') // 'John'
 */
export function getByPath<T = any>(
  obj: any,
  path: string | PathSegment[]
): T | undefined {
  if (!obj) return undefined;

  const segments = typeof path === 'string' ? parsePath(path) : path;
  
  let current = obj;
  for (const segment of segments) {
    if (current == null) return undefined;
    current = current[segment];
  }

  return current as T;
}

/**
 * Set a value in an object using a path
 * Creates intermediate objects/arrays as needed
 * 
 * @example
 * const obj = {};
 * setByPath(obj, 'user.name', 'John');
 * // obj = { user: { name: 'John' } }
 * 
 * setByPath(obj, 'users[0].name', 'Jane');
 * // obj = { users: [{ name: 'Jane' }] }
 */
export function setByPath(
  obj: any,
  path: string | PathSegment[],
  value: any
): void {
  if (!obj) return;

  const segments = typeof path === 'string' ? parsePath(path) : path;
  if (segments.length === 0) return;

  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];

    if (current[segment] === undefined || current[segment] === null) {
      // Create array if next segment is a number, otherwise create object
      current[segment] = typeof nextSegment === 'number' ? [] : {};
    }

    current = current[segment];
  }

  const lastSegment = segments[segments.length - 1];
  current[lastSegment] = value;
}

/**
 * Delete a value from an object using a path
 * 
 * @example
 * const obj = { user: { name: 'John', age: 30 } };
 * deleteByPath(obj, 'user.age');
 * // obj = { user: { name: 'John' } }
 */
export function deleteByPath(
  obj: any,
  path: string | PathSegment[]
): boolean {
  if (!obj) return false;

  const segments = typeof path === 'string' ? parsePath(path) : path;
  if (segments.length === 0) return false;

  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (current[segment] === undefined || current[segment] === null) {
      return false;
    }
    current = current[segment];
  }

  const lastSegment = segments[segments.length - 1];
  if (lastSegment in current) {
    delete current[lastSegment];
    return true;
  }

  return false;
}

/**
 * Check if a path exists in an object
 * 
 * @example
 * hasPath({ user: { name: 'John' } }, 'user.name') // true
 * hasPath({ user: { name: 'John' } }, 'user.age') // false
 */
export function hasPath(obj: any, path: string | PathSegment[]): boolean {
  if (!obj) return false;

  const segments = typeof path === 'string' ? parsePath(path) : path;
  
  let current = obj;
  for (const segment of segments) {
    if (current == null || !(segment in current)) {
      return false;
    }
    current = current[segment];
  }

  return true;
}

/**
 * Get the parent path of a field path
 * 
 * @example
 * getParentPath('user.profile.name') // 'user.profile'
 * getParentPath('users[0].name') // 'users[0]'
 * getParentPath('name') // ''
 */
export function getParentPath(path: string): string {
  const segments = parsePath(path);
  if (segments.length <= 1) return '';
  return joinPath(segments.slice(0, -1));
}

/**
 * Get the last segment of a field path
 * 
 * @example
 * getFieldName('user.profile.name') // 'name'
 * getFieldName('users[0]') // 0
 * getFieldName('name') // 'name'
 */
export function getFieldName(path: string): PathSegment {
  const segments = parsePath(path);
  return segments.length > 0 ? segments[segments.length - 1] : '';
}

/**
 * Check if a path is a parent of another path
 * 
 * @example
 * isParentPath('user', 'user.name') // true
 * isParentPath('user.profile', 'user.profile.name') // true
 * isParentPath('user.name', 'user.email') // false
 */
export function isParentPath(parentPath: string, childPath: string): boolean {
  if (!parentPath) return true;
  if (!childPath) return false;
  if (parentPath === childPath) return false;

  const parentSegments = parsePath(parentPath);
  const childSegments = parsePath(childPath);

  if (parentSegments.length >= childSegments.length) return false;

  return parentSegments.every(
    (segment, index) => segment === childSegments[index]
  );
}

/**
 * Check if a path is a child of another path
 * 
 * @example
 * isChildPath('user.name', 'user') // true
 * isChildPath('user.profile.name', 'user') // true
 * isChildPath('user.email', 'user.profile') // false
 */
export function isChildPath(childPath: string, parentPath: string): boolean {
  return isParentPath(parentPath, childPath);
}

/**
 * Get all paths in an object (flattened)
 * 
 * @example
 * getAllPaths({ user: { name: 'John', age: 30 } })
 * // ['user', 'user.name', 'user.age']
 * 
 * getAllPaths({ users: [{ name: 'John' }] })
 * // ['users', 'users[0]', 'users[0].name']
 */
export function getAllPaths(
  obj: any,
  prefix: string = '',
  includeArrays: boolean = true
): string[] {
  if (!obj || typeof obj !== 'object') return [];

  const paths: string[] = [];
  
  if (Array.isArray(obj)) {
    if (includeArrays && prefix) {
      paths.push(prefix);
    }
    
    obj.forEach((item, index) => {
      const currentPath = prefix ? `${prefix}[${index}]` : `[${index}]`;
      paths.push(currentPath);
      
      if (item && typeof item === 'object') {
        paths.push(...getAllPaths(item, currentPath, includeArrays));
      }
    });
  } else {
    if (prefix) {
      paths.push(prefix);
    }

    Object.keys(obj).forEach((key) => {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      // Only add the path if it's not an array, or if includeArrays is true
      if (!Array.isArray(value) || includeArrays) {
        paths.push(currentPath);
      }
      
      if (value && typeof value === 'object') {
        paths.push(...getAllPaths(value, currentPath, includeArrays));
      }
    });
  }

  return paths;
}

/**
 * Convert bracket notation to dot notation where possible
 * 
 * @example
 * normalizePath('user.profile.name') // 'user.profile.name'
 * normalizePath('users[0].name') // 'users.0.name'
 */
export function normalizePath(path: string): string {
  return joinPath(parsePath(path));
}

/**
 * Deep clone an object following a specific path
 * Only clones objects along the path, other references remain shallow
 * 
 * @example
 * const obj = { user: { name: 'John', settings: { theme: 'dark' } } };
 * const cloned = cloneAlongPath(obj, 'user.name');
 * cloned.user.name = 'Jane'; // obj.user.name is still 'John'
 * cloned.user.settings === obj.user.settings // true (shallow copy)
 */
export function cloneAlongPath(obj: any, path: string | PathSegment[]): any {
  if (!obj || typeof obj !== 'object') return obj;

  const segments = typeof path === 'string' ? parsePath(path) : path;
  if (segments.length === 0) return obj;

  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  
  let current = result;
  let original = obj;
  
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const next = original[segment];
    
    if (next && typeof next === 'object') {
      current[segment] = Array.isArray(next) ? [...next] : { ...next };
      current = current[segment];
      original = next;
    } else {
      break;
    }
  }

  return result;
}
