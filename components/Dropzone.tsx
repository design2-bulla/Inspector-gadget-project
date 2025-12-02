import React, { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';

interface DropzoneProps {
  onImageSelected: (base64: string, mimeType: string) => void;
  disabled?: boolean;
}

const Dropzone: React.FC<DropzoneProps> = ({ onImageSelected, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Por favor sube un archivo de imagen válido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      onImageSelected(result, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [disabled, onImageSelected]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative group cursor-pointer transition-all duration-300 ease-in-out
        border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center
        h-64 w-full
        ${isDragging 
          ? 'border-novey-red bg-red-50 dark:bg-red-900/10 scale-[1.01]' 
          : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-novey-red dark:hover:border-novey-red hover:bg-gray-50 dark:hover:bg-gray-800/80'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input
        type="file"
        accept="image/*"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        onChange={handleFileInput}
        disabled={disabled}
      />
      
      <div className="bg-novey-red/10 dark:bg-novey-red/20 p-5 rounded-full mb-4 group-hover:bg-novey-red/20 dark:group-hover:bg-novey-red/30 transition-colors">
        <Upload className="w-10 h-10 text-novey-red" />
      </div>
      
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
        Sube o arrastra tu arte
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm px-4">
        Soporta JPG y PNG. Detectamos SKU, Precios y Ortografía automáticamente.
      </p>
    </div>
  );
};

export default Dropzone;