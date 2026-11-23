import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Inter"', '"Segoe UI"', 'Roboto', '"Noto Sans Arabic"', 'sans-serif'],
      },
      colors: {
        accent: { DEFAULT: "#0a84ff", soft: "rgba(10,132,255,0.12)" },
        ink: { 1: "var(--ink-1)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)", glass: "var(--glass)" },
        line: "var(--line)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
        pop: "0 12px 40px rgba(0,0,0,0.18)",
      },
      borderRadius: { xl2: "14px" },
    },
  },
  plugins: [],
} satisfies Config;
