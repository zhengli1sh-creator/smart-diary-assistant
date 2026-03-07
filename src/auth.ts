import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/gmail.readonly",
          ].join(" "),
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }) {
      // On first sign-in, persist Google's access/refresh tokens for API calls
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        // token.sub is Google's unique permanent user ID (set automatically)
      }
      return token;
    },
    async session({ session, token }) {
      // Expose the Google sub as session.user.id for API routes
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      // Expose Google tokens so we can call Calendar/Gmail APIs
      (session as any).accessToken = token.accessToken;
      (session as any).refreshToken = token.refreshToken;
      return session;
    },
  },
});


