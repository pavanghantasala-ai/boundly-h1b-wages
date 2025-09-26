import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Ensure this route runs in a Node.js environment (not Edge) on Netlify
export const runtime = "nodejs";
// Avoid static optimization/caching for auth
export const dynamic = "force-dynamic";

// Enable trustHost at the handler level for Netlify proxies
const handler = NextAuth({ ...(authOptions as any), trustHost: true });
export { handler as GET, handler as POST };
