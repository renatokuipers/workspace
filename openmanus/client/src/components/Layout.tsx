import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { Footer } from "./Footer"

export function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <Header />
      <div className="flex h-[calc(100vh-4rem)] pt-16">
        <main className="flex-1 overflow-y-auto">
          <div className="h-full p-4">
            <Outlet />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}