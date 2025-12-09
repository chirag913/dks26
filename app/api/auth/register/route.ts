import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid input',
        details: validation.error.issues
      }, { status: 400 });
    }

    const { email, password } = validation.data;
    const supabase = createRouteHandlerClient({ cookies });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${request.headers.get('origin')}/auth/callback`,
      },
    });

    if (error) {
      console.error('Auth error:', error.message);
      return NextResponse.json({
        error: error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      user: data.user,
      message: 'Check your email to confirm your account'
    }, { status: 201 });

  } catch (err) {
    const error = err as Error;
    console.error('Server error:', error.message);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}