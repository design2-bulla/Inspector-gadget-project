import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Dropzone from './components/Dropzone';
import SkuResult from './components/SkuResult';
import { extractSkuFromImage, validateSkuWithWeb, checkSpellingInImage, hasValidApiKey, saveManualApiKey } from './services/geminiService';
import { AppState, BatchAnalysisItem, BatchItemStatus } from './types';
import { Loader2, AlertCircle, Image as ImageIcon, CheckCircle, ScanLine, Globe, X, Laptop, Key, ChevronRight, Plus, RefreshCw, Play, StopCircle, Info } from 'lucide-react';

const INSPECTOR_LOGO = "https://i.postimg.cc/tJnXV91p/inspector-gadget.png";

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [manualKeyInput, setManualKeyInput] = useState('');
  
  // New Queue System State
  const [queue, setQueue] = useState<BatchAnalysisItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false); // Sidebar state
  
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
      if (pendingItems.length > 0 && !isProcessing) {
          processNextItem();
      }
  }, [queue, isProcessing]);

  // Manual trigger to unstick the queue
  const forceProcessQueue = () => {
      // Reset locks
      processingRef.current = false;
      setIsProcessing(false);
      // The useEffect will pick it up, or we can force call:
      setTimeout(() => processNextItem(), 100);
  };

  const processSpecificItem = (id: string) => {
      if (isProcessing) return; // Wait for current to finish
      
      const itemIndex = queue.findIndex(i => i.id === id);
      if (itemIndex !== -1) {
          processItemAtIndex(itemIndex);
      }
  };

  const processNextItem = async () => {
      // Safety check
      if (processingRef.current) return;

      // Find first pending item
      const itemIndex = queue.findIndex(i => i.status === 'PENDING');
      if (itemIndex === -1) {
          return;
      }
      
      await processItemAtIndex(itemIndex);
  };

  const processItemAtIndex = async (index: number) => {
      processingRef.current = true;
      setIsProcessing(true);

      const item = queue[index];

      // Update status to ANALYZING
      updateItemStatus(item.id, 'ANALYZING');

      try {
          // --- STEP 1: EXTRACT SKU (Sequential to save API limit) ---
          const extractionResult = await extractSkuFromImage(item.fileBase64, item.mimeType);

          const foundProducts = extractionResult.products || [];
          let validationResults: any[] = [];

          if (foundProducts.length > 0) {
              // Update status to VALIDATING
              updateItemStatus(item.id, 'VALIDATING');

              // --- STEP 2: VALIDATE SKUS ON WEB (Sequential) ---
              // We do this inside a loop to process multiple SKUs in one image without bursting API
              for (const product of foundProducts) {
                  const details = await validateSkuWithWeb(product.sku);
                  
                  validationResults.push({ 
                      sku: product.sku, 
                      priceOnArt: product.priceOnArt, 
                      visualDescription: product.visualDescription,
                      contentMismatch: false, // Feature disabled for stability
                      details 
                  });
                  
                  // Mini delay between SKUs in same image if multiple
                  if (foundProducts.length > 1) await new Promise(r => setTimeout(r, 500));
              }
          } else {
             // If no SKUs found, validationResults is empty
          }

          // --- STEP 3: CHECK SPELLING (Sequential, done last) ---
          const spellingAnalysis = await checkSpellingInImage(item.fileBase64, item.mimeType);

          // Update State with Results
          setQueue(prev => prev.map(i => i.id === item.id ? { 
              ...i, 
              status: foundProducts.length > 0 ? 'COMPLETED' : 'ERROR',
              results: validationResults,
              spellingResult: spellingAnalysis,
              errorMsg: foundProducts.length === 0 ? "No se encontraron códigos SKU visibles." : undefined
          } : i));
          
          // Save to History (LocalStorage or Session)
          if (foundProducts.length > 0) {
              const historyItem = {
                  id: item.id,
                  sku: validationResults[0]?.sku || 'Multi',
                  timestamp: Date.now(),
                  thumbnail: item.fileBase64
              };
              // Add to history logic here if needed, or rely on queue for now
          }

      } catch (error: any) {
          console.error(`Error processing item ${item.id}`, error);
          let msg = "Error al procesar imagen.";
          
          if (error.message === 'API_KEY_MISSING') msg = 'Falta API Key';
          else if (error.message?.includes('429') || error.message?.includes('Quota') || error.status === 429) {
              msg = 'Límite de velocidad (429). Intentando continuar...';
          }
          else if (error.message) msg = error.message.slice(0, 50);

          setQueue(prev => prev.map(i => i.id === item.id ? { 
              ...i, 
              status: 'ERROR',
              errorMsg: msg
          } : i));
      } finally {
        // ALWAYS RELEASE LOCK, BUT WITH A DELAY
        // This delay prevents slamming the API with the next request instantly
        setTimeout(() => {
            processingRef.current = false;
            setIsProcessing(false);
        }, 3000); // 3 seconds cool-down between items is safer
      }
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

  const cancelAllPending = () => {
    // Keep only completed or error items (remove pending and analyzing)
    setQueue(prev => prev.filter(i => i.status === 'COMPLETED' || i.status === 'ERROR'));
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
                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-blue-600 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                        <img 
                            src={INSPECTOR_LOGO} 
                            alt="Inspector Gadget" 
                            className="relative w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl"
                        />
                      </div>
                  </div>
                  <h1 className="text-2xl font-bold text-center text-gray-900 mb-2 flex items-center justify-center gap-2">
                    Art Inspector
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">BETA</span>
                  </h1>
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
        logoSrc={INSPECTOR_LOGO}
      />

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        
        {/* TOP SECTION: Dropzone always visible if queue is empty */}

        {queue.length === 0 ? (
          <div className="animate-fade-in-up max-w-4xl mx-auto mt-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-3 text-gray-800 dark:text-white flex items-center justify-center gap-3">
                Art Inspector
                <span className="text-sm bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800 font-semibold tracking-wide">
                    BETA
                </span>
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 font-medium">
                Sube tus diseños (por lote) para validar SKUs, precios y ortografía.
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-2 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                <Dropzone onImagesSelected={handleImagesSelected} />
            </div>

            <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-4 max-w-lg mx-auto flex items-center justify-center gap-1">
                <Info className="w-3 h-3" />
                Sugerencia: Sube lotes de máximo 5 imágenes para evitar pausas por límite de la IA.
            </p>

            <div className="mt-12 grid grid-cols-3 gap-6 text-center">
                <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-transform hover:-translate-y-1">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full w-fit mx-auto mb-4">
                        <ImageIcon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">1. Carga Múltiple</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 hidden sm:block">Arrastra hasta 10 imágenes a la vez</p>
                </div>
                 <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-transform hover:-translate-y-1">
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-full w-fit mx-auto mb-4">
                        <ScanLine className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">2. Análisis en Cola</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 hidden sm:block">Procesamos uno a uno automáticamente</p>
                </div>
                 <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-transform hover:-translate-y-1">
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-full w-fit mx-auto mb-4">
                        <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">3. Reporte Completo</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 hidden sm:block">SKU, Precios y Ortografía por imagen</p>
                </div>
            </div>
          </div>
        ) : (
            // QUEUE LIST VIEW
            <div className="animate-fade-in">
                {/* NEW: Compact Dropzone for adding more files */}
                <Dropzone onImagesSelected={handleImagesSelected} compact={true} />

                {/* Header Actions */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cola de Análisis</h2>
                        <div className="flex items-center gap-2 mt-1">
                            {isProcessing && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {isProcessing 
                                    ? `Procesando... (${queue.filter(i => i.status === 'COMPLETED').length}/${queue.length})` 
                                    : queue.some(i => i.status === 'PENDING') 
                                        ? "Pausado / En espera"
                                        : "Todos los análisis completados"
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {/* Force Continue Button */}
                        {queue.some(i => i.status === 'PENDING') && (
                            <button 
                                onClick={forceProcessQueue}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
                                title="Forzar que continúe el siguiente análisis"
                            >
                                <Play className="w-4 h-4 fill-current" />
                                Continuar Cola
                            </button>
                        )}

                        {/* Global Cancel Button */}
                        {queue.some(i => i.status === 'PENDING' || i.status === 'ANALYZING' || i.status === 'VALIDATING') && (
                             <button 
                                onClick={cancelAllPending}
                                className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800/50 rounded-lg text-sm font-medium transition-colors"
                                title="Cancelar todos los análisis pendientes"
                            >
                                <StopCircle className="w-4 h-4" />
                                Cancelar Pendientes
                            </button>
                        )}
                        
                        <button 
                            onClick={clearQueue}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reiniciar Todo
                        </button>
                    </div>
                </div>

                {/* RATE LIMIT NOTICE */}
                <div className="mb-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 p-3 rounded-lg flex items-center gap-3">
                     <Info className="w-5 h-5 text-blue-500 shrink-0" />
                     <p className="text-xs text-blue-700 dark:text-blue-300">
                        <strong>Sugerencia de rendimiento:</strong> Si procesas muchas imágenes seguidas, podrías ver errores temporales (límite de velocidad). 
                        Recomendamos subir lotes de <strong>5 imágenes</strong> a la vez para un flujo sin interrupciones.
                     </p>
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
                                    {/* Manual Start Button for individual item */}
                                    {item.status === 'PENDING' && !isProcessing && (
                                        <button
                                            onClick={() => processSpecificItem(item.id)}
                                            className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors mr-2"
                                        >
                                            <Play className="w-3 h-3 fill-current" />
                                            Analizar Ahora
                                        </button>
                                    )}

                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 hidden sm:block">
                                        {renderStatusText(item.status, item.errorMsg)}
                                    </span>
                                    {renderStatusIcon(item.status)}
                                    
                                    {/* Dynamic Cancel/Delete Button */}
                                    <button 
                                        onClick={() => removeQueueItem(item.id)}
                                        className={`ml-2 p-1 transition-colors rounded-full ${
                                            (item.status === 'ANALYZING' || item.status === 'VALIDATING') 
                                            ? 'text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30' 
                                            : 'text-gray-400 hover:text-red-500'
                                        }`}
                                        title={(item.status === 'ANALYZING' || item.status === 'VALIDATING') ? "Cancelar proceso" : "Eliminar de la lista"}
                                    >
                                        {(item.status === 'ANALYZING' || item.status === 'VALIDATING') ? (
                                            <StopCircle className="w-6 h-6 animate-pulse" />
                                        ) : (
                                            <X className="w-5 h-5" />
                                        )}
                                    </button>
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
                        <div className="mb-4">
                            <img src={INSPECTOR_LOGO} className="w-20 h-20 rounded-full object-cover border-4 border-gray-100 dark:border-gray-700 shadow-md" alt="Logo" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            Art Inspector 
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500 dark:text-gray-300">BETA</span>
                        </h2>
                        
                        <div className="my-6 text-sm text-gray-600 dark:text-gray-400 space-y-2">
                            <p>Herramienta interna para el equipo de diseño, desarrollada por el team novey en making bulla.</p>
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