import React, { useState } from 'react';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { Dashboard } from './components/Dashboard';
import { AddTorrentModal } from './components/AddTorrentModal';

const App: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-primary transition-colors duration-300">
      {/* Header */}
      <header className="bg-bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-accent-primary to-accent-secondary rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-accent-primary/20">
              S
            </div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              Superseedr <span className="text-accent-primary">WebUI</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-accent-primary hover:bg-accent-secondary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-accent-primary/20 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Add Torrent</span>
            </button>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <AddTorrentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Main App */}
      <Dashboard />

      {/* Footer */}
      <footer className="py-8 text-center text-text-muted text-sm">
        <p>Superseedr Sidecar Web Interface</p>
      </footer>
    </div>
  );
};

export default App;
