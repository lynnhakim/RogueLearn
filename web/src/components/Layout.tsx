import { Outlet } from 'react-router-dom'
import { Header } from './Header'

export function Layout() {
  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <Outlet />
      </main>
    </>
  )
}
