/// <reference types="react" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      style: React.DetailedHTMLProps<React.StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement> & {
        jsx?: true | boolean;
        global?: true | boolean;
      };
    }
  }
}
