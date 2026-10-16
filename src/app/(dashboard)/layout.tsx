import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/server"
import { Sidebar } from "@/components/layout/Sidebar"
import { MobileFAB } from "@/components/layout/MobileFAB"
import { DataProvider } from "@/components/providers/DataProvider"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect("/login")
  }

  return (
    <DataProvider userId={session.user.id}>
      <div className="min-h-screen">
        <Sidebar />

        {/* Main content area with left margin for sidebar */}
        {/* Desktop: ml-[240px], Tablet: ml-16, Mobile: no margin (sidebar is overlay) */}
        <main className="ml-0 md:ml-16 lg:ml-[240px]">
          {children}
        </main>

        {/* Mobile FAB */}
        <MobileFAB />
      </div>
    </DataProvider>
  )
}
