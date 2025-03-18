import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "./components/ui/theme-provider"
import { Toaster } from "sonner"
import { AuthProvider } from "./contexts/AuthContext"
import { Login } from "./pages/Login"
import { Register } from "./pages/Register"
import { Layout } from "./components/Layout"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { Home } from "./pages/Home"
import { Projects } from "./pages/Projects"
import { ErrorBoundary } from "./components/ErrorBoundary"

function App() {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<Layout />}>
              <Route path="/" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/chat/:projectId" element={<ProtectedRoute>
                <ErrorBoundary>
                  <Home />
                </ErrorBoundary>
              </ProtectedRoute>} />
            </Route>
          </Routes>
          <Toaster
            position="top-right"
            duration={3000}
            closeButton
            theme="system"
            richColors
          />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App