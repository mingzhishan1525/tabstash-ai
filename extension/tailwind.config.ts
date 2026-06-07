import type { Config } from "tailwindcss";

export default {
  content: ["./sidepanel.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        muted: "#6b7280",
        panel: "#f7f7f5",
        line: "#e7e5df"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.04)"
      }
    }
  },
  plugins: []
} satisfies Config;
