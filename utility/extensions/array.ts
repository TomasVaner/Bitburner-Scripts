export {};
declare global {
  interface Array<T> {
    count(pred: (item: T) => boolean): number;
    count_unique(mod?: (item: T) => unknown): number;
    sum(mod?: (item: T) => number): number;
    sortby(mod?: (item: T) => number, increase?: boolean): T[];
  }

  type Unpacked<T> = T extends (infer U)[] ? U : T;
}

if (!Array.prototype.count) {
  Array.prototype.count = function count<T>(this: T[], pred: (item: T) => boolean): number {
    return this.filter(pred).length;
  };
}

if (!Array.prototype.count_unique) {
  Array.prototype.count_unique = function count_unique<T>(
    this: T[],
    mod = ((item: T) => item) as (item: T) => unknown,
  ) {
    return new Set(this.map(mod)).size;
  };
}

if (!Array.prototype.sum) {
  Array.prototype.sum = function sum<T>(this: T[], mod = ((item: T) => item) as (item: T) => number) {
    return this.reduce((s, i) => s + mod(i), 0);
  };
}

if (!Array.prototype.sum) {
  Array.prototype.sortby = function sortby<T>(
    this: T[],
    mod = ((item: T) => item) as (item: T) => number,
    increase = true,
  ) {
    return this.sort((i1, i2) => (increase ? mod(i1) - mod(i2) : mod(i2) - mod(i1)));
  };
}
