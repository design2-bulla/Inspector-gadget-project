import React from 'react';
import { ScanLine, Settings } from 'lucide-react';

interface NavbarProps {
  onSettingsClick?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onSettingsClick }) => {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 h-14 flex items-center">
      <div className="w-full px-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-novey-red p-1.5 rounded text-white">
                <ScanLine className="h-5 w-5" />
            </div>
            <div>
                <h1 className="text-lg font-bold text-gray-900 tracking-tight leading-none">ART INSPECTOR</h1>
            </div>
          </div>
          <div className="flex items-center">
            <button 
              onClick={onSettingsClick}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all focus:outline-none"
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