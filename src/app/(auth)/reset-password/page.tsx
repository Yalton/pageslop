'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { z } from 'zod'
import { authClient } from '@/lib/auth/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

const resetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type ResetInput = z.infer<typeof resetSchema>

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
  })

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-center text-[20px] font-semibold">Invalid link</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
        <p className="text-muted-foreground text-center text-sm">
          <Link href="/forgot-password" className="text-foreground underline-offset-4 hover:underline">
            Request a new link
          </Link>
        </p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-center text-[20px] font-semibold">Password reset</h1>
        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="size-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="size-6 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              Your password has been reset successfully.
            </p>
            <Button onClick={() => router.push('/login')} className="w-full">
              Log in with new password
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const onSubmit = async (data: ResetInput) => {
    setIsLoading(true)
    try {
      const { error } = await authClient.resetPassword({
        newPassword: data.password,
        token,
      })

      if (error) {
        toast.error(error.message || 'Failed to reset password. The link may have expired.')
        return
      }

      setSuccess(true)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-[20px] font-semibold">Set new password</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">New password</Label>
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat password"
                aria-invalid={!!errors.confirmPassword}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-destructive text-[12px]">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center py-8 text-muted-foreground">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
