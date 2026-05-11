import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        // Surface tokens — warm off-white, hairline borders
        canvas: "#F8F7F4",        // page background (warm off-white)
        surface: "#FFFFFF",        // card / panel
        "surface-muted": "#F2F1ED",
        line: "#E8E6E1",           // hairline border
        "line-strong": "#D9D6CF",

        // Text tokens
        ink: "#0F0F0F",
        "ink-muted": "#6B6B6B",
        "ink-subtle": "#9C9C9C",

        // Brand accent (used very sparingly per manifesto)
        accent: "#1E1E1E",

        // Status colors — only ones allowed by rule_16
        status: {
          draft:    "#94908A",  // neutral gray
          ready:    "#3F3F46",  // slate
          inquiry:  "#B97A1F",  // amber
          deal:     "#1E5FBF",  // blue
          paid:     "#1F7A4D",  // emerald
          closed:   "#5A574F",  // muted neutral
          brokered: "#5E3FB8",  // purple
        },
      },
      borderRadius: {
        DEFAULT: "10px",
        sm: "6px",
        md: "10px",
        lg: "14px",
      },
      boxShadow: {
        // Minimal shadows only — per manifesto rule_16
        hairline: "0 0 0 1px #E8E6E1",
        soft: "0 1px 2px rgba(15, 15, 15, 0.04)",
      },
      letterSpacing: {
        tightish: "-0.01em",
        tight2: "-0.02em",
      },
    },
  },
  plugins: [],
};

export default config;
