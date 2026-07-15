import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // semantik tokenlar — yangi dizayn tizimi
        primary: {
          DEFAULT: "var(--primary)",
          strong: "var(--primary-strong)",
          soft: "var(--primary-soft)",
          contrast: "var(--primary-contrast)",
        },
        success: { DEFAULT: "var(--success)", soft: "var(--success-soft)", ink: "var(--success-ink)" },
        warning: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)", ink: "var(--warning-ink)" },
        danger: { DEFAULT: "var(--danger)", soft: "var(--danger-soft)", ink: "var(--danger-ink)" },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)", ink: "var(--info-ink)" },
        surface: { DEFAULT: "var(--surface-solid)", 2: "var(--surface-2)" },
        // meros nomlari — mavjud sahifalar uchun
        ink: "var(--ink)",
        mut: "var(--mut)",
        acc: "var(--acc)",
        accl: "var(--accL)",
        side: "var(--side)",
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      borderColor: {
        line: "var(--line)",
        line2: "var(--line2)",
      },
      backgroundColor: {
        sfc: "var(--sfc)",
        bg2: "var(--bg2)",
        tint: "var(--tint)",
        peach: "var(--peach)",
        mint: "var(--mint)",
        rose: "var(--rose)",
        solid: "var(--solid)",
      },
      textColor: {
        tintink: "var(--tintink)",
        peachink: "var(--peachink)",
        mintink: "var(--mintink)",
        roseink: "var(--roseink)",
      },
      keyframes: {
        sway: { from: { transform: "rotate(-5deg)" }, to: { transform: "rotate(5deg)" } },
        blink: { "0%,80%,100%": { opacity: ".25" }, "40%": { opacity: "1" } },
        spinSlow: { from: { transform: "rotate(0)" }, to: { transform: "rotate(360deg)" } },
      },
      animation: {
        sway: "sway 17s ease-in-out infinite alternate",
        blink: "blink 1.2s infinite",
        "spin-slow": "spinSlow 90s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
