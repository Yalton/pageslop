export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-[400px] px-4">{children}</div>
    </div>
  )
}
