import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Dropzone from './components/Dropzone';
import SkuResult from './components/SkuResult';
import { extractSkuFromImage, validateSkuWithWeb, checkSpellingInImage, hasValidApiKey, saveManualApiKey } from './services/geminiService';
import { AppState, BatchAnalysisItem, BatchItemStatus } from './types';
import { Loader2, AlertCircle, Image as ImageIcon, CheckCircle, ScanLine, Globe, X, Laptop, Key, ChevronRight, Plus, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [manualKeyInput, setManualKeyInput] = useState('');
  
  // New Queue System State
  const [queue, setQueue] = useState<BatchAnalysisItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Ref to track if we are currently running a loop to avoid double triggers
  const processingRef = useRef(false);

  useEffect(() => {
    const valid = hasValidApiKey();
    setHasKey(valid);

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setIsDarkMode(true);
        document.documentElement.classList.add('dark');
    } else {
        setIsDarkMode(false);
        document.documentElement.classList.remove('dark');
    }
  }, []);

  // -- THEME LOGIC --
  const toggleTheme = () => {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      if (newMode) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
      } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
      }
  };

  const handleSaveKey = () => {
      if (!manualKeyInput.trim()) {
          alert("Por favor ingresa una llave válida.");
          return;
      }
      saveManualApiKey(manualKeyInput);
      setHasKey(true);
      window.location.reload();
  };

  // -- QUEUE PROCESSING LOGIC --
  
  // Watch queue changes. If there are PENDING items and we aren't processing, start.
  useEffect(() => {
      const pendingItems = queue.filter(item => item.status === 'PENDING');
      if (pendingItems.length > 0 && !processingRef.current) {
          processNextItem();
      }
  }, [queue]);

  const processNextItem = async () => {
      processingRef.current = true;
      setIsProcessing(true);

      // Find first pending item
      const itemIndex = queue.findIndex(i => i.status === 'PENDING');
      if (itemIndex === -1) {
          processingRef.current = false;
          setIsProcessing(false);
          return;
      }

      const item = queue[itemIndex];

      // Update status to ANALYZING
      updateItemStatus(item.id, 'ANALYZING');

      try {
          // 1. Extract SKU & Spelling
          const [extractionResult, spellingAnalysis] = await Promise.all([
              extractSkuFromImage(item.fileBase64, item.mimeType),
              checkSpellingInImage(item.fileBase64, item.mimeType)
          ]);

          // Update spelling result
          setQueue(prev => prev.map(i => i.id === item.id ? { ...i, spellingResult: spellingAnalysis } : i));

          const foundProducts = extractionResult.products || [];

          if (foundProducts.length > 0) {
              // Update status to VALIDATING
              updateItemStatus(item.id, 'VALIDATING');

              // 2. Validate SKUs
              const validationPromises = foundProducts.map(async (product) => {
                  const details = await validateSkuWithWeb(product.sku);
                  return { 
                      sku: product.sku, 
                      priceOnArt: product.priceOnArt, 
                      details 
                  };
              });

              const validationResults = await Promise.all(validationPromises);
              
              // COMPLETE SUCCESS
              setQueue(prev => prev.map(i => i.id === item.id ? { 
                  ...i, 
                  status: 'COMPLETED',
                  results: validationResults 
              } : i));

          } else {
              // ERROR: No SKUs found
              setQueue(prev => prev.map(i => i.id === item.id ? { 
                  ...i, 
                  status: 'ERROR',
                  errorMsg: "No se encontraron códigos SKU visibles."
              } : i));
          }

      } catch (error: any) {
          console.error(`Error processing item ${item.id}`, error);
          const msg = error.message === 'API_KEY_MISSING' ? 'Falta API Key' : "Error al procesar imagen.";
          setQueue(prev => prev.map(i => i.id === item.id ? { 
              ...i, 
              status: 'ERROR',
              errorMsg: msg
          } : i));
      }

      // Small delay to let UI breathe
      await new Promise(r => setTimeout(r, 500));
      
      // Continue to next
      processingRef.current = false;
      
      // Trigger effect again by implicit state change or recursive call? 
      // Effect dependency on [queue] handles it because we updated state status to COMPLETED/ERROR, 
      // so the next render finds the NEXT pending item.
  };

  const updateItemStatus = (id: string, status: BatchItemStatus) => {
      setQueue(prev => prev.map(item => item.id === id ? { ...item, status } : item));
  };

  // -- HANDLERS --

  const handleImagesSelected = (files: { base64: string, mimeType: string, name: string }[]) => {
      const newItems: BatchAnalysisItem[] = files.map(file => ({
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          fileBase64: file.base64,
          mimeType: file.mimeType,
          fileName: file.name,
          status: 'PENDING',
          results: [],
          spellingResult: null
      }));

      setQueue(prev => [...prev, ...newItems]);
  };

  const clearQueue = () => {
      setQueue([]);
      setIsProcessing(false);
      processingRef.current = false;
  };

  const removeQueueItem = (id: string) => {
      setQueue(prev => prev.filter(i => i.id !== id));
  };

  // --- RENDER HELPERS ---

  const renderStatusIcon = (status: BatchItemStatus) => {
      switch(status) {
          case 'PENDING': return <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>;
          case 'ANALYZING': return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
          case 'VALIDATING': return <Globe className="w-6 h-6 text-purple-500 animate-pulse" />;
          case 'COMPLETED': return <CheckCircle className="w-6 h-6 text-green-500" />;
          case 'ERROR': return <AlertCircle className="w-6 h-6 text-red-500" />;
      }
  };

  const renderStatusText = (status: BatchItemStatus, errorMsg?: string) => {
      switch(status) {
          case 'PENDING': return "En espera...";
          case 'ANALYZING': return "Analizando imagen...";
          case 'VALIDATING': return "Validando con Novey.com.pa...";
          case 'COMPLETED': return "Análisis completado";
          case 'ERROR': return errorMsg || "Error";
      }
  };

  // --- SETUP SCREEN ---
  if (!hasKey) {
      return (
          <div className="min-h-screen bg-gradient-to-br from-novey-red to-red-900 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-fade-in-up">
                  <div className="flex justify-center mb-6">
                      <div className="bg-red-100 p-4 rounded-full">
                          <Key className="w-8 h-8 text-novey-red" />
                      </div>
                  </div>
                  <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Bienvenido a Art Inspector</h1>
                  <p className="text-center text-gray-500 mb-6 text-sm">
                      Para comenzar, necesitamos conectar la herramienta con los servicios de Google AI.
                  </p>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                              Google Gemini API Key
                          </label>
                          <input 
                              type="password" 
                              value={manualKeyInput}
                              onChange={(e) => setManualKeyInput(e.target.value)}
                              placeholder="AIzaSy..."
                              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-novey-red focus:border-transparent outline-none transition-all"
                          />
                      </div>
                      <button 
                          onClick={handleSaveKey}
                          className="w-full bg-novey-red text-white font-bold py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                          Conectar y Empezar <ChevronRight className="w-5 h-5" />
                      </button>
                  </div>
                  <p className="mt-6 text-xs text-center text-gray-400">
                      Esta llave se guardará de forma segura en este navegador.
                  </p>
              </div>
          </div>
      );
  }

  // --- MAIN RENDER ---
  return (
    <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans min-h-screen transition-colors duration-300 pb-20">
      <Navbar 
        onSettingsClick={() => setShowSettings(true)} 
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        
        {/* TOP SECTION: Dropzone always visible if queue is empty OR if we want to add more? 
            Let's keep it simple: Show dropzone if queue is empty. If queue exists, show Summary + List + Add Button.
        */}

        {queue.length === 0 ? (
          <div className="animate-fade-in-up max-w-4xl mx-auto mt-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-3 text-gray-800 dark:text-white">Art Inspector</h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 font-medium">
                Sube tus diseños (por lote) para validar SKUs, precios y ortografía.
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-2 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                <Dropzone onImagesSelected={handleImagesSelected} />
            </div>

            <div className="mt-12 grid grid-cols-3 gap-6 text-center">
                <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-transform hover:-translate-y-1">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full w-fit mx-auto mb-4">
                        <ImageIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">1. Carga Múltiple</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">Arrastra hasta 10 imágenes a la vez</p>
                </div>
                 <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-transform hover:-translate-y-1">
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-full w-fit mx-auto mb-4">
                        <ScanLine className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">2. Análisis en Cola</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">Procesamos uno a uno automáticamente</p>
                </div>
                 <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-transform hover:-translate-y-1">
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-full w-fit mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">3. Reporte Completo</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">SKU, Precios y Ortografía por imagen</p>
                </div>
            </div>
          </div>
        ) : (
            // QUEUE LIST VIEW
            <div className="animate-fade-in">
                {/* Header Actions */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cola de Análisis</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Procesando {queue.filter(i => i.status === 'COMPLETED').length} de {queue.length} imágenes
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={clearQueue}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reiniciar Todo
                        </button>
                        {/* Hidden input trick to add more files? Or just rely on restart? 
                            Let's keep it simple: Restart to add new batch. 
                        */}
                    </div>
                </div>

                {/* The List */}
                <div className="space-y-8">
                    {queue.map((item, index) => (
                        <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                            {/* Card Header (File Info & Status) */}
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <span className="font-mono text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded border dark:border-gray-700">
                                        #{index + 1}
                                    </span>
                                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[200px] md:max-w-md">
                                        {item.fileName}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 hidden sm:block">
                                        {renderStatusText(item.status, item.errorMsg)}
                                    </span>
                                    {renderStatusIcon(item.status)}
                                    {item.status !== 'ANALYZING' && item.status !== 'VALIDATING' && (
                                        <button 
                                            onClick={() => removeQueueItem(item.id)}
                                            className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                                            title="Eliminar de la lista"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Card Body (Content) */}
                            <div className="p-0">
                                {item.status === 'COMPLETED' ? (
                                    <div className="p-6">
                                        <SkuResult 
                                            results={item.results}
                                            spellingResult={item.spellingResult}
                                            imageSrc={item.fileBase64}
                                            onReset={() => {}} // No reset inside list item
                                            isBatchMode={true} // Cleaner UI
                                        />
                                    </div>
                                ) : item.status === 'ERROR' ? (
                                    <div className="p-8 text-center bg-red-50/50 dark:bg-red-900/10">
                                        <div className="flex justify-center mb-4">
                                            <img src={item.fileBase64} className="h-32 object-contain rounded opacity-50 grayscale" alt="Thumb" />
                                        </div>
                                        <p className="text-red-600 dark:text-red-400 font-medium">
                                            {item.errorMsg || "Error desconocido"}
                                        </p>
                                    </div>
                                ) : (
                                    // Loading / Pending State
                                    <div className="p-12 flex flex-col items-center justify-center min-h-[300px]">
                                        {item.status !== 'PENDING' && (
                                            <div className="w-full max-w-md mb-8">
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                    <div className="bg-blue-500 h-2 rounded-full w-1/3 animate-[loading_1s_ease-in-out_infinite]"></div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="relative mb-4">
                                            <img 
                                                src={item.fileBase64} 
                                                className={`h-48 object-contain rounded shadow-lg transition-all duration-500 ${item.status === 'PENDING' ? 'opacity-50 grayscale scale-95' : 'opacity-100 scale-100'}`} 
                                                alt="Preview" 
                                            />
                                            {item.status !== 'PENDING' && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-black/30 backdrop-blur-[2px] rounded">
                                                    <Loader2 className="w-10 h-10 text-novey-red animate-spin" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400 animate-pulse">
                                            {renderStatusText(item.status)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 relative">
                    <button 
                        onClick={() => setShowSettings(false)}
                        className="absolute top-4 right-4 p-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    
                    <div className="flex flex-col items-center text-center">
                        <div className="bg-novey-red p-3 rounded-xl mb-4 shadow-lg shadow-novey-red/20">
                             <Laptop className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Art Inspector</h2>
                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500 dark:text-gray-300 mt-2">v3.0 Batch</span>
                        
                        <div className="my-6 text-sm text-gray-600 dark:text-gray-400 space-y-2">
                            <p>Herramienta interna para el equipo de diseño.</p>
                            <p className="text-gray-400 dark:text-gray-500 text-xs mt-4">
                                Powered by Gemini AI
                            </p>
                        </div>
                        
                        <button
                            className="text-xs text-red-500 hover:text-red-600 underline mb-6"
                            onClick={() => {
                                localStorage.removeItem('art_inspector_api_key');
                                window.location.reload();
                            }}
                        >
                            Desvincular API Key
                        </button>

                        <button 
                            className="w-full bg-gray-900 dark:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
                            onClick={() => setShowSettings(false)}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default App;