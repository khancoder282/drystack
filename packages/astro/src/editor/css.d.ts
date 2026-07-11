// Vite returns the processed stylesheet as a string when a CSS file is
// imported with the `?inline` query. See editor/index.tsx.
declare module '*.css?inline' {
  const css: string;
  export default css;
}
