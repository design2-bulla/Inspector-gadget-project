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
        border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center
        h-48 w-full bg-white
        ${isDragging 
          ? 'border-novey-red bg-red-50 scale-[1.01]' 
          : 'border-gray-300 hover:border-novey-red hover:bg-gray-50'
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
      
      <div className="bg-novey-red/10 p-3 rounded-full mb-3 group-hover:bg-novey-red/20 transition-colors">
        <Upload className="w-6 h-6 text-novey-red" />
      </div>
      
      <h3 className="text-base font-semibold text-gray-800 mb-0.5">
        Sube o arrastra
      </h3>
      <p className="text-xs text-gray-500 max-w-xs px-4">
        JPG/PNG. Detectamos SKU y Precios.
      </p>
    </div>
  );
};

export default Dropzone;