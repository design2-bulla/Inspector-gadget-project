import React from 'react';
import { ScanLine, Settings, Moon, Sun } from 'lucide-react';

interface NavbarProps {
  onSettingsClick?: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onSettingsClick, isDarkMode, onToggleTheme }) => {
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 h-16 flex items-center transition-colors duration-300">
      <div className="w-full px-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-novey-red p-2 rounded-lg text-white shadow-sm">
                <ScanLine className="h-6 w-6" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">ART INSPECTOR</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all focus:outline-none"
              title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={onSettingsClick}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all focus:outline-none"
              title="Ajustes"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;