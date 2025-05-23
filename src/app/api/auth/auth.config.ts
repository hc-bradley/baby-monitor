import type { AuthOptions, User, DefaultSession, Session } from 'next-auth'
import type { AdapterUser } from "next-auth/adapters"
import type { JWT } from "next-auth/jwt"
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import Redis from 'ioredis'

// Validate required environment variables
if (!process.env.REDIS_URL) {
  console.error('REDIS_URL environment variable is not set.')
  throw new Error('REDIS_URL is required for authentication')
}

if (!process.env.NEXTAUTH_SECRET) {
  console.error('NEXTAUTH_SECRET environment variable is not set.')
  throw new Error('NEXTAUTH_SECRET is required for authentication')
}

if (!process.env.NEXTAUTH_URL) {
  console.error('NEXTAUTH_URL environment variable is not set.')
  throw new Error('NEXTAUTH_URL is required for authentication')
}

// Initialize Redis client with better error handling
let redis: Redis | null = null

// Function to initialize Redis with retries
async function initializeRedis() {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    console.error('REDIS_URL environment variable is not set.')
    return null
  }

  try {
    // Log the Redis URL (without sensitive parts) for debugging
    const maskedUrl = redisUrl.replace(/(redis:\/\/[^:]+):([^@]+)@/, '$1:****@')
    console.log('Connecting to Redis at:', maskedUrl)

    const client = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        console.log(`Redis connection attempt ${times}, retrying in ${delay}ms`)
        return delay
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000
    })

    // Set up event handlers
    client.on('error', (err) => {
      console.error('Redis Client Error:', err)
    })

    client.on('connect', () => {
      console.log('Redis connected successfully')
    })

    client.on('ready', () => {
      console.log('Redis client is ready')
    })

    client.on('reconnecting', () => {
      console.log('Redis reconnecting...')
    })

    client.on('end', () => {
      console.log('Redis connection ended')
    })

    // Wait for the connection to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'))
      }, 10000)

      client.once('ready', () => {
        clearTimeout(timeout)
        resolve(true)
      })

      client.once('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    // Test the connection
    await client.ping()
    console.log('Redis connection test successful')
    return client
  } catch (error) {
    console.error('Failed to initialize Redis client:', error)
    return null
  }
}

// Initialize Redis immediately and store the promise
const redisInitPromise = initializeRedis().then(client => {
  redis = client
  return client
}).catch(error => {
  console.error('Failed to initialize Redis:', error)
  redis = null
  return null
})

// Ensure Redis is initialized before any auth operations
async function ensureRedis() {
  if (!redis) {
    redis = await redisInitPromise
  }
  if (!redis) {
    throw new Error('Redis connection failed')
  }
  return redis
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

export const authConfig: AuthOptions = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.username || !credentials?.password) {
            console.error('Missing credentials in authorize')
            throw new Error('Missing credentials')
          }

          // Ensure Redis is connected before proceeding
          const redisClient = await ensureRedis()
          console.log(`Attempting to authenticate user: ${credentials.username}`)

          const user = await getUserByUsername(credentials.username)
          if (!user) {
            console.error(`User not found: ${credentials.username}`)
            throw new Error('Invalid username or password')
          }

          const isValid = await bcrypt.compare(credentials.password, user.hashedPassword)
          if (!isValid) {
            console.error(`Invalid password for user: ${credentials.username}`)
            throw new Error('Invalid username or password')
          }

          console.log(`Successfully authenticated user: ${credentials.username}`)
          return {
            id: user.id,
            username: credentials.username
          }
        } catch (error) {
          console.error('Authentication error:', error)
          throw error
        }
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  },
  callbacks: {
    async jwt({ token, user }) {
      try {
        if (user) {
          token.id = user.id
          token.username = user.username ?? undefined
        }
        return token
      } catch (error) {
        console.error('JWT callback error:', error)
        throw error
      }
    },
    async session({ session, token }) {
      try {
        if (session.user) {
          session.user.id = token.id
          session.user.username = token.username
        }
        return session
      } catch (error) {
        console.error('Session callback error:', error)
        throw error
      }
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: true, // Enable debug logs in production to help diagnose issues
  secret: process.env.NEXTAUTH_SECRET
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