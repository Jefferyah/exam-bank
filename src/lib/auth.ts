import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub,
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        inviteCode: { label: "Invite Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const email = credentials.email as string;
        const inviteCode = (credentials.inviteCode as string)?.trim() || "";

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          // Existing user: direct login, no invite code needed
          return existingUser;
        }

        // New user: require invite code
        if (!inviteCode) {
          throw new Error("INVITE_CODE_REQUIRED");
        }

        // Validate invite code
        const code = await prisma.inviteCode.findUnique({
          where: { code: inviteCode },
        });

        if (!code) {
          throw new Error("INVITE_CODE_INVALID");
        }

        if (code.usedById) {
          throw new Error("INVITE_CODE_USED");
        }

        // Create new user and mark invite code as used
        const newUser = await prisma.user.create({
          data: {
            email,
            name: email.split("@")[0],
            role: "STUDENT",
          },
        });

        await prisma.inviteCode.update({
          where: { id: code.id },
          data: {
            usedById: newUser.id,
            usedAt: new Date(),
          },
        });

        return newUser;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role || "STUDENT";
        token.id = user.id;
      }
      // Ensure role persists on token refresh by re-reading from DB if missing
      if (!token.role && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        token.role = dbUser?.role || "STUDENT";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
