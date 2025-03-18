import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Terminal } from './components/Tools/Terminal';
import { Browser } from './components/Tools/Browser';
import { CodeEditor } from './components/Tools/CodeEditor';
import AIChat from './components/Chat/AIChat';
import './App.css';
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

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'terminal' | 'browser' | 'editor'>('chat');

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Router>
          <div className="app-container">
            <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
              <div className="sidebar-toggle" onClick={toggleSidebar}>
                {sidebarOpen ? '←' : '→'}
              </div>
              <div className="sidebar-content">
                <div className="app-logo">
                  <h1>OpenManus</h1>
                </div>
                <nav className="app-nav">
                  <ul>
                    <li className={activeTab === 'chat' ? 'active' : ''}>
                      <button onClick={() => setActiveTab('chat')}>
                        <i className="fas fa-comment"></i> Chat
                      </button>
                    </li>
                    <li className={activeTab === 'terminal' ? 'active' : ''}>
                      <button onClick={() => setActiveTab('terminal')}>
                        <i className="fas fa-terminal"></i> Terminal
                      </button>
                    </li>
                    <li className={activeTab === 'browser' ? 'active' : ''}>
                      <button onClick={() => setActiveTab('browser')}>
                        <i className="fas fa-globe"></i> Browser
                      </button>
                    </li>
                    <li className={activeTab === 'editor' ? 'active' : ''}>
                      <button onClick={() => setActiveTab('editor')}>
                        <i className="fas fa-code"></i> Editor
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>

            <div className="main-content">
              <div className="tab-content">
                <div className={`tab-pane ${activeTab === 'chat' ? 'active' : ''}`}>
                  <AIChat />
                </div>
                <div className={`tab-pane ${activeTab === 'terminal' ? 'active' : ''}`}>
                  <Terminal />
                </div>
                <div className={`tab-pane ${activeTab === 'browser' ? 'active' : ''}`}>
                  <Browser />
                </div>
                <div className={`tab-pane ${activeTab === 'editor' ? 'active' : ''}`}>
                  <CodeEditor />
                </div>
              </div>
            </div>
          </div>
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
  );
};

export default App;