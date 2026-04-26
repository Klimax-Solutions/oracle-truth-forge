import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Fallback publishable values — used only if env vars are missing in the build
// environment (Supabase URL + anon key are public by design).
const SUPABASE_URL_FALLBACK = "https://pggkwyhtplxyarctuoze.supabase.co";
const SUPABASE_ANON_KEY_FALLBACK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2t3eWh0cGx4eWFyY3R1b3plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDY0NzgsImV4cCI6MjA4NTAyMjQ3OH0.lt54xvmZuKO0gUh1ZKX3_AMg2t_xHLfha3olVw4rFWs";
const SUPABASE_PROJECT_ID_FALLBACK = "pggkwyhtplxyarctuoze";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL || SUPABASE_URL_FALLBACK,
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY_FALLBACK,
    ),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
      process.env.VITE_SUPABASE_PROJECT_ID || SUPABASE_PROJECT_ID_FALLBACK,
    ),
  },
}));
