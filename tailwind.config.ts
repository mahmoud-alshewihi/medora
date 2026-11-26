import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))", input: "hsl(var(--input))", ring: "hsl(var(--ring))",
        background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        primary: {
          DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))",
          strong: "hsl(var(--primary-strong))", soft: "hsl(var(--primary-soft))",
        },
        navy: "hsl(var(--navy))",
        danger: { DEFAULT: "hsl(var(--danger))", soft: "hsl(var(--danger-soft))" },
        success: { DEFAULT: "hsl(var(--success))", soft: "hsl(var(--success-soft))" },
        warn: { DEFAULT: "hsl(var(--warn))", soft: "hsl(var(--warn-soft))" },
        info: { DEFAULT: "hsl(var(--info))", soft: "hsl(var(--info-soft))" },
        chart: { 1: "hsl(var(--chart-1))", 2: "hsl(var(--chart-2))", 3: "hsl(var(--chart-3))", 4: "hsl(var(--chart-4))", 5: "hsl(var(--chart-5))" },
      },
      borderRadius: { sm: "6px", DEFAULT: "8px", md: "8px", lg: "10px", xl: "14px", "2xl": "18px" },
      boxShadow: {
        xs: "var(--shadow-xs)", sm: "var(--shadow-sm)", DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)", lg: "var(--shadow-lg)", xl: "var(--shadow-xl)",
      },
      fontFamily: { sans: ["Inter", "Segoe UI", "system-ui", "-apple-system", "Roboto", "Noto Sans Arabic", "Tahoma", "Arial", "sans-serif"] },
      transitionDuration: { fast: "120ms", med: "200ms", slow: "320ms" },
      transitionTimingFunction: { smooth: "cubic-bezier(0.22, 1, 0.36, 1)" },
    },
  },
  plugins: [],
};
export default config;
