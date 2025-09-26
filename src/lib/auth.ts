import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  // Providers without database adapter to keep serverless bundle small
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  // Use JWT-based sessions (no database storage)
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // When a user signs in, enhance the token with profile details
      if (account && profile) {
        token.name = (profile as any).name ?? token.name;
        token.email = (profile as any).email ?? token.email;
        token.picture = (profile as any).picture ?? token.picture;
      }
      // Preserve user id if available (OAuth user id is in token.sub)
      if (user && (user as any).id) {
        (token as any).id = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).id || token.sub || undefined;
        session.user.name = token.name as string | undefined;
        session.user.email = token.email as string | undefined;
        (session.user as any).image = (token as any).picture as string | undefined;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
