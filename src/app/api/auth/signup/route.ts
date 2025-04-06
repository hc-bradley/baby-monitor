import { NextResponse } from 'next/server'
import { addUser } from '../auth.config'
import Redis from 'ioredis'

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL!)

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Check username format (alphanumeric, 3-20 characters)
    const usernameRegex = /^[a-zA-Z0-9]{3,20}$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-20 characters long and contain only letters and numbers' },
        { status: 400 }
      )
    }

    // Check password strength (at least 8 characters)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const exists = await redis.exists(`user:${username}`)
    if (exists) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 409 }
      )
    }

    // Add user to Redis
    const user = await addUser(username, password)
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'User created successfully', user: { id: user.id, username: user.username } },
      { status: 201 }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}