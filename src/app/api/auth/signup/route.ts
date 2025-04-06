import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { addUser, users } from '../auth.config'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    console.log('Signup attempt for email:', email)

    if (!email || !password) {
      console.log('Missing email or password')
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (users.has(email)) {
      console.log('User already exists:', email)
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const id = uuidv4()
    const user = {
      id,
      email,
      password: hashedPassword,
    }

    addUser(user)

    console.log('User created successfully:', { id, email })
    console.log('Current users:', Array.from(users.keys()))

    return NextResponse.json(
      { message: 'User created successfully', user: { id, email } },
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