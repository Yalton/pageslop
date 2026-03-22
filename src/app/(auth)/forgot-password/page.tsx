'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Mail } from 'lucide-react'
import { z } from 'zod'
import { authClient } from '@/lib/auth/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

const forgotSchema = z.object({
  email: z.string().email('Invalid email address'),
})
type ForgotInput = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotInput>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async (data: ForgotInput) => {
    setIsLoading(true)
    try {
      await authClient.requestPasswordReset({
        email: data.email,
        redirectTo: '/reset-password',
      })
      setSentTo(data.email)
      setEmailSent(true)
    } catch {
      // Always show success to prevent email enumeration
      setSentTo(data.email)
      setEmailSent(true)
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
              If an account exists for <strong className="text-foreground">{sentTo}</strong>, we sent a password reset link. Check your inbox.
            </p>
            <p className="text-xs text-muted-foreground">
              The link expires in 1 hour.
            </p>
          </CardContent>
        </Card>
        <p className="text-muted-foreground text-center text-sm">
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-[20px] font-semibold">Forgot password</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-center text-sm">
        Remember your password?{' '}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
