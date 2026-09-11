export {}

declare global {
  interface Document {
    querySelector<E extends Element = HTMLDivElement>(selectors: '#app'): E
  }
}
