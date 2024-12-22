type Stringable = {
  toString: () => string;
};

export class List {
  items: Stringable[];

  constructor(items: Stringable[] = []) {
    this.items = items;
  }

  toString() {
    return this.items.map((item) => item.toString()).join('\n');
  }
}
