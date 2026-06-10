import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        navy: "#33416F",
        navyDark: "#263154",
        navySoft: "#eef1f8",
        steel: "#4b587c",
        line: "#e5e7eb",
        mist: "#f3f5fa"
      }
    },
  },
  plugins: [],
};

export default config;
