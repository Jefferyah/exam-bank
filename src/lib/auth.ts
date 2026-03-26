import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { validatePassword } from "./password";

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
        const password = (credentials.password as string) || "";
        const inviteCode = (credentials.inviteCode as string)?.trim() || "";

        if (!password) {
          throw new Error("PASSWORD_REQUIRED");
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          // Verify password
          if (!existingUser.password) {
            // Legacy user without password — force them to set one via migration
            // For now, allow login and set the password
            const hashed = await bcrypt.hash(password, 10);
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { password: hashed },
            });
          } else {
            const valid = await bcrypt.compare(password, existingUser.password);
            if (!valid) {
              throw new Error("INVALID_CREDENTIALS");
            }
          }

          if (existingUser.email.toLowerCase() === "jeffer@gmail.com" && existingUser.role !== "ADMIN") {
            return prisma.user.update({
              where: { id: existingUser.id },
              data: { role: "ADMIN" },
            });
          }

          return existingUser;
        }

        // New user: require invite code
        // Use unified error to prevent email enumeration
        if (!inviteCode) {
          throw new Error("INVALID_CREDENTIALS");
        }

        // Validate invite code — use transaction to prevent race condition (Bug #7)
        const newUser = await prisma.$transaction(async (tx) => {
          const code = await tx.inviteCode.findUnique({
            where: { code: inviteCode },
          });

          if (!code) {
            throw new Error("INVITE_CODE_INVALID");
          }

          // Check if code has remaining uses (maxUses=0 means unlimited)
          if (code.maxUses > 0 && code.usedCount >= code.maxUses) {
            throw new Error("INVITE_CODE_EXHAUSTED");
          }

          // Enforce password policy on registration
          const pwCheck = validatePassword(password);
          if (!pwCheck.valid) {
            throw new Error("WEAK_PASSWORD");
          }

          const hashedPassword = await bcrypt.hash(password, 10);

          // Create new user with hashed password
          const user = await tx.user.create({
            data: {
              email,
              name: email.split("@")[0],
              password: hashedPassword,
              role: "STUDENT",
            },
          });

          await tx.inviteCode.update({
            where: { id: code.id },
            data: {
              usedCount: { increment: 1 },
              ...(!code.usedById ? { usedById: user.id } : {}),
              usedAt: new Date(),
            },
          });

          return user;
        });

        return newUser;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user;
      const isOnLogin = nextUrl.pathname === "/login";
      const isApiRoute = nextUrl.pathname.startsWith("/api/");

      // API routes handle their own auth
      if (isApiRoute) return true;

      // Redirect logged-in users away from login page
      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      // Protect all other pages
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role || "STUDENT";
        token.id = user.id;
        token.jti = globalThis.crypto.randomUUID();
        token.passwordChangedAt = null;
      }

      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, passwordChangedAt: true },
        });
        if (!dbUser) {
          // User was deleted
          return { ...token, id: null };
        }
        token.role = dbUser.role || "STUDENT";
        // Invalidate session if password was changed after token was issued
        if (dbUser.passwordChangedAt && token.iat) {
          const changedAt = Math.floor(dbUser.passwordChangedAt.getTime() / 1000);
          if (changedAt > (token.iat as number)) {
            return { ...token, id: null };
          }
        }
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
