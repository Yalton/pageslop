'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Mail, RefreshCw } from 'lucide-react'
import { authClient } from '@/lib/auth/client'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true)
    setUnverifiedEmail(null)
    try {
      const { error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      })

      if (error) {
        if (error.message?.toLowerCase().includes('verify') || error.code === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(data.email)
        } else {
          toast.error('Invalid email or password. Please try again.')
        }
        return
      }

      router.push('/dashboard')
    } catch {
      toast.error('Invalid email or password. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    if (!unverifiedEmail) return
    setResending(true)
    try {
      await authClient.sendVerificationEmail({ email: unverifiedEmail, callbackURL: '/login' })
      setResent(true)
      toast.success('Verification email sent!')
      setTimeout(() => setResent(false), 10000)
    } catch {
      toast.error('Failed to resend. Try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-[20px] font-semibold">Welcome back</h1>

      {unverifiedEmail && (
        <Card className="border-amber-500/50">
          <CardContent className="py-4 flex flex-col items-center gap-3 text-center">
            <div className="size-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Mail className="size-5 text-amber-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              Your email <strong className="text-foreground">{unverifiedEmail}</strong> hasn&apos;t been verified yet.
            </p>
            {resent ? (
              <p className="text-xs text-green-600">Verification email sent! Check your inbox.</p>
            ) : (
              <Button variant="outline" size="sm" disabled={resending} onClick={handleResend}>
                {resending ? <><RefreshCw className="size-3 animate-spin" /> Sending...</> : 'Resend verification email'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
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
                  Logging in...
                </>
              ) : (
                'Log In'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-center text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-foreground underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
