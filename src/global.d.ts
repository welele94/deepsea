declare module '*.css'

declare global {
  interface Document {
    querySelector(selectors: '#app'): HTMLDivElement
  }
}

export {}
