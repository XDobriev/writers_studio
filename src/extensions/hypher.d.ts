declare module 'hypher' {
  export default class Hypher {
    constructor(language: object);
    hyphenate(word: string): string[];
  }
}

declare module 'hyphenation.ru' {
  const patterns: object;
  export default patterns;
}
