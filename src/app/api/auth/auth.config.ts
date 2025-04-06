import type { AuthOptions, User, DefaultSession, Session } from 'next-auth'
import type { AdapterUser } from "next-auth/adapters"
import type { JWT } from "next-auth/jwt"
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import Redis from 'ioredis'

// Initialize Redis client
// Ensure REDIS_URL is set in your environment variables (.env.local for development)
const redisUrl = process.env.REDIS_URL
if (!redisUrl) {
  console.error('REDIS_URL environment variable is not set.')
  // In a real app, you might throw an error or handle this more gracefully
  // For now, we log and potentially let it fail later if Redis is required.
}
const redis = redisUrl ? new Redis(redisUrl) : null

console.log(redis ? 'Redis client initialized.' : 'Redis client initialization failed: REDIS_URL not found.')

if (redis) {
  console.log('Redis client initialized.')
  redis.on('error', (err) => console.error('Redis Client Error', err))
  redis.on('connect', () => console.log('Redis connected.'))
  redis.on('reconnecting', () => console.log('Redis reconnecting.'))
  redis.on('end', () => console.log('Redis connection ended.'))
} else {
  console.error('Redis client initialization failed: REDIS_URL not found.')
}

// Define the structure for user data stored in Redis
// We store the hashed password and the user ID
interface StoredUser {
  id: string
  hashedPassword: string
}

/**
 * Retrieves user details from Redis by username.
 * Returns null if the user is not found or Redis is unavailable.
 */
export async function getUserByUsername(username: string): Promise<(User & StoredUser) | null> {
  if (!redis) {
    console.error('Redis client not available in getUserByUsername')
    return null
  }
  try {
    const userDataString = await redis.get(`user:${username}`)
    if (!userDataString) {
      return null
    }
    const userData: StoredUser = JSON.parse(userDataString)
    // Construct the User object expected by NextAuth
    return {
      id: userData.id,
      username: username,
      hashedPassword: userData.hashedPassword,
      name: username
    }
  } catch (error) {
    console.error('Redis error getting user:', error)
    return null
  }
}

/**
 * Adds a new user to Redis.
 * Returns the new user object (without password) or null on failure/if user exists.
 */
export async function addUser(username: string, password: string): Promise<User | null> {
  if (!redis) {
    console.error('Redis client not available in addUser')
    return null
  }
  try {
    // Check if user already exists using EXISTS command for efficiency
    const exists = await redis.exists(`user:${username}`)
    if (exists) {
      console.log(`Attempted to add existing user: ${username}`)
      return null // User already exists
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const userId = uuidv4()
    const newUser: StoredUser = {
      id: userId,
      hashedPassword: hashedPassword,
    }

    // Store the user data as a JSON string
    await redis.set(`user:${username}`, JSON.stringify(newUser))
    console.log(`User ${username} added successfully with ID ${userId}`)

    // Return the user object compatible with NextAuth (excluding password)
    return {
      id: userId,
      username: username,
      name: username
    }
  } catch (error) {
    console.error('Redis error adding user:', error)
    return null
  }
}

// Ensure NEXTAUTH_SECRET is set
if (!process.env.NEXTAUTH_SECRET) {
  console.error('NEXTAUTH_SECRET environment variable is not set.')
  // In a real app, you might throw an error or handle this more gracefully
}

export const authOptions: AuthOptions = {
  pages: {
    signIn: '/auth/signin',
  },
  providers: [
    Credentials({
      // Define the fields expected in the credentials object
      credentials: {
        username: { label: "Username", type: "text", placeholder: "jsmith" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!redis) {
          console.error('Redis client not available during authorization')
          return null
        }
        const username = credentials?.username
        const password = credentials?.password

        if (!username || !password) {
          console.log('Authorize failed: Missing username or password')
          return null
        }

        console.log(`Attempting authorization for user: ${username}`)
        const user = await getUserByUsername(username)

        if (!user) {
          console.log(`Authorization failed: User not found - ${username}`)
          return null
        }

        const passwordsMatch = await bcrypt.compare(
          password,
          user.hashedPassword
        )

        if (passwordsMatch) {
          console.log(`Authorization successful for user: ${username}`)
          const { hashedPassword, ...userWithoutPassword } = user
          return {
            ...userWithoutPassword,
            username: username, // Ensure username is included
          }
        } else {
          console.log(`Authorization failed: Invalid password for user - ${username}`)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = user.username ?? undefined
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.username = token.username
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  // debug: process.env.NODE_ENV === 'development', // Optional: Enable debug logs in dev
}

// Augment NextAuth types
declare module 'next-auth' {
  interface Session extends DefaultSession {
    // Intersect custom properties directly onto the user object
    user: DefaultSession['user'] & {
      id?: string;
      username?: string;
    };
  }

  // Only add the custom property to the base User interface
  interface User {
    username?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    username?: string;
  }
}