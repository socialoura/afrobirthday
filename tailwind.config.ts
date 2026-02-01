import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FF6B35",
          50: "#FFF0EB",
          100: "#FFE1D6",
          200: "#FFC3AD",
          300: "#FFA585",
          400: "#FF875C",
          500: "#FF6B35",
          600: "#FC4A00",
          700: "#C43A00",
          800: "#8C2900",
          900: "#541900",
        },
        secondary: {
          DEFAULT: "#FFD700",
          50: "#FFFCE5",
          100: "#FFF9CC",
          200: "#FFF399",
          300: "#FFED66",
          400: "#FFE733",
          500: "#FFD700",
          600: "#CCAC00",
          700: "#998100",
          800: "#665600",
          900: "#332B00",
        },
        accent: {
          DEFAULT: "#2BA199",
          50: "#E6F7F6",
          100: "#CCEFED",
          200: "#99DFDB",
          300: "#66CFC9",
          400: "#33BFB7",
          500: "#2BA199",
          600: "#228179",
          700: "#1A615B",
          800: "#11403D",
          900: "#09201E",
        },
        dark: "#1F2121",
        light: "#FCF8F9",
        error: "#C01527",
        success: "#22C55E",
      },
      fontFamily: {
        display: ["Poppins", "Montserrat", "sans-serif"],
        body: ["Inter", "Poppins", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
