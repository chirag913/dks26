// types/global-jsx.d.ts
// Temporary fallback to ensure JSX namespace exists while TS picks up @types/react
// Remove this file after the proper @types/react / tsconfig fix has been validated.

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
