import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))", background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        card: "hsl(var(--card))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        navy: "hsl(var(--navy))",
        danger: "hsl(var(--danger))", success: "hsl(var(--success))", warn: "hsl(var(--warn))",
      },
      borderRadius: { DEFAULT: "6px", md: "6px", lg: "8px" },
      fontFamily: { sans: ["Inter", "Segoe UI", "system-ui", "-apple-system", "Roboto", "Noto Sans Arabic", "Tahoma", "Arial", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
