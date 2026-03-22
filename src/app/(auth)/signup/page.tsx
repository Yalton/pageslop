'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Mail } from 'lucide-react'
import { authClient } from '@/lib/auth/client'
import { signupSchema, type SignupInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupInput) => {
    setIsLoading(true)
    try {
      const { error } = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
      })

      if (error) {
        toast.error(error.message || 'Signup failed. Please try again.')
        return
      }

      setSentTo(data.email)
      setEmailSent(true)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-center text-[20px] font-semibold">Check your email</h1>
        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="size-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              We sent a verification link to <strong className="text-foreground">{sentTo}</strong>. Click the link in the email to activate your account.
            </p>
            <p className="text-xs text-muted-foreground">
              Didn&apos;t receive it? Check your spam folder.
            </p>
          </CardContent>
        </Card>
        <p className="text-muted-foreground text-center text-sm">
          Already verified?{' '}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-[20px] font-semibold">
        Create your account
      </h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-destructive text-[12px]">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-destructive text-[12px]">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-destructive text-[12px]">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
