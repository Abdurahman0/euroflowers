import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        mut: "var(--mut)",
        acc: "var(--acc)",
        accl: "var(--accL)",
        side: "var(--side)",
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
        drift: {
          "0%": { transform: "translateY(-80px) translateX(0) rotate(0)" },
          "50%": { transform: "translateY(55vh) translateX(-34px) rotate(210deg)" },
          "100%": { transform: "translateY(112vh) translateX(-20px) rotate(390deg)" },
        },
        spinSlow: { from: { transform: "rotate(0)" }, to: { transform: "rotate(360deg)" } },
      },
      animation: {
        sway: "sway 17s ease-in-out infinite alternate",
        blink: "blink 1.2s infinite",
        drift: "drift 30s linear infinite",
        "spin-slow": "spinSlow 90s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
