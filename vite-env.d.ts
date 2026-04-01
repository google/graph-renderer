/// <reference types="vite/client" />

/**
 * Standard CSS module script import.
 * Matches: import sheet from './styles.css' with { type: 'css' };
 */
declare module '*.css' {
  const sheet: CSSStyleSheet;
  export default sheet;
}
