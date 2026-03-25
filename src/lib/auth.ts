import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
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
          if (existingUser.email === "demo@example.com" && existingUser.role !== "ADMIN") {
            return prisma.user.update({
              where: { id: existingUser.id },
              data: { role: "ADMIN" },
            });
          }

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

        // Check if code has remaining uses (maxUses=0 means unlimited)
        if (code.maxUses > 0 && code.usedCount >= code.maxUses) {
          throw new Error("INVITE_CODE_USED");
        }

        // Create new user and increment invite code usage
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
            usedCount: { increment: 1 },
            // Keep first user reference for backward compat
            ...(!code.usedById ? { usedById: newUser.id } : {}),
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

      if (token.id) {
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
