import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Outlet, ScrollRestoration } from 'react-router'
import { Nav } from './components/Nav'
import { Footer } from './components/Footer'
import { Home } from './pages/Home'
import { Play } from './pages/Play'
import { Sandbox } from './pages/Sandbox'
import { How } from './pages/How'
import { Download } from './pages/Download'
import { Registry, SpeciesPage } from './pages/Registry'
import './styles.css'

function Layout() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-body focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/play', element: <Play /> },
      { path: '/sandbox', element: <Sandbox /> },
      { path: '/how-it-works', element: <How /> },
      { path: '/download', element: <Download /> },
      { path: '/species', element: <Registry /> },
      { path: '/species/:id', element: <SpeciesPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
