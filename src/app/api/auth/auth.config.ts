import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import fs from 'fs'
import path from 'path'

// Path to the users JSON file
const usersFilePath = path.join(process.cwd(), 'src/app/api/auth/users.json')

// Function to read users from file
function readUsers() {
  try {
    const data = fs.readFileSync(usersFilePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

// Function to write users to file
function writeUsers(users: any[]) {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2))
}

// Initialize users from file
export const users = new Map<string, { id: string; email: string; password: string }>(
  readUsers().map((user: any) => [user.email, user])
)

// Function to add a user
export function addUser(user: { id: string; email: string; password: string }) {
  users.set(user.email, user)
  writeUsers(Array.from(users.values()))
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          console.log('Auth attempt for email:', credentials?.email)
          console.log('Current users:', Array.from(users.keys()))

          if (!credentials?.email || !credentials?.password) {
            console.log('Missing credentials')
            throw new Error('Email and password are required')
          }

          const user = users.get(credentials.email)
          if (!user) {
            console.log('User not found:', credentials.email)
            throw new Error('Invalid email or password')
          }

          const isValid = await bcrypt.compare(credentials.password, user.password)
          if (!isValid) {
            console.log('Invalid password for user:', credentials.email)
            throw new Error('Invalid email or password')
          }

          console.log('Authentication successful for user:', user.email)
          return {
            id: user.id,
            email: user.email,
          }
        } catch (error) {
          console.error('Auth error:', error)
          throw error
        }
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
      }
      return session
    }
  },
  debug: process.env.NODE_ENV === 'development',
}