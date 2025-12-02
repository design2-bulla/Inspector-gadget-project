import React, { useCallback, useState } from 'react';
import { Upload, Layers } from 'lucide-react';

interface FileData {
    base64: string;
    mimeType: string;
    name: string;
}

interface DropzoneProps {
  onImagesSelected: (files: FileData[]) => void;
  disabled?: boolean;
}

const Dropzone: React.FC<DropzoneProps> = ({ onImagesSelected, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    const validFiles = filesArray.filter(f => f.type.startsWith('image/'));

    if (validFiles.length === 0) {
        alert("Por favor sube archivos de imagen válidos.");
        return;
    }

    // Process all files concurrently
    const promises = validFiles.map(file => {
        return new Promise<FileData>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                resolve({
                    base64: event.target?.result as string,
                    mimeType: file.type,
                    name: file.name
                });
            };
            reader.readAsDataURL(file);
        });
    });

    const results = await Promise.all(promises);
    onImagesSelected(results);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [disabled, onImagesSelected]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
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
        h-72 w-full
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
        multiple // Enable multiple files
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        onChange={handleFileInput}
        disabled={disabled}
      />
      
      <div className="bg-novey-red/10 dark:bg-novey-red/20 p-5 rounded-full mb-4 group-hover:bg-novey-red/20 dark:group-hover:bg-novey-red/30 transition-colors relative">
        <Upload className="w-10 h-10 text-novey-red relative z-10" />
        <div className="absolute top-0 right-0 -mr-2 -mt-1 bg-white dark:bg-gray-700 rounded-full p-1 shadow-sm">
            <Layers className="w-4 h-4 text-gray-500" />
        </div>
      </div>
      
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
        Arrastra tus artes aquí
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm px-4 mb-1">
        Procesamiento por lotes activado.
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Puedes subir hasta 5 o más imágenes a la vez.
      </p>
    </div>
  );
};

export default Dropzone;