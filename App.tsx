import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dropzone from './components/Dropzone';
import SkuResult from './components/SkuResult';
import { extractSkuFromImage, validateSkuWithWeb, checkSpellingInImage, hasValidApiKey, saveManualApiKey } from './services/geminiService';
import { AppState, ProductResultItem, SpellingAnalysis } from './types';
import { Loader2, AlertCircle, Image as ImageIcon, CheckCircle, ScanLine, Globe, X, Laptop, Key, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [hasKey, setHasKey] = useState<boolean>(true); // Assume true initially
  const [manualKeyInput, setManualKeyInput] = useState('');
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const [results, setResults] = useState<ProductResultItem[]>([]);
  const [detectedSkuStrings, setDetectedSkuStrings] = useState<string[]>([]);
  
  const [spellingResult, setSpellingResult] = useState<SpellingAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    // Check if we have an API Key available (either Env or LocalStorage)
    const valid = hasValidApiKey();
    setHasKey(valid);

    // Initialize Theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setIsDarkMode(true);
        document.documentElement.classList.add('dark');
    } else {
        setIsDarkMode(false);
        document.documentElement.classList.remove('dark');
    }
  }, []);

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
      window.location.reload(); // Reload to pick up the new key
  };

  const handleImageSelected = async (base64: string, mimeType: string) => {
    setSelectedImage(base64);
    setAppState(AppState.ANALYZING);
    setErrorMsg(null);
    setResults([]);
    setDetectedSkuStrings([]);
    setSpellingResult(null);

    try {
      // Step 1: Run Extraction and Spelling Check in Parallel
      const [extractionResult, spellingAnalysis] = await Promise.all([
        extractSkuFromImage(base64, mimeType),
        checkSpellingInImage(base64, mimeType)
      ]);

      setSpellingResult(spellingAnalysis);
      
      const foundProducts = extractionResult.products || [];

      if (foundProducts.length > 0) {
        setDetectedSkuStrings(foundProducts.map(p => p.sku));
        
        // Step 2: Validate with Web
        setAppState(AppState.VALIDATING);
        
        const validationPromises = foundProducts.map(async (product) => {
            const details = await validateSkuWithWeb(product.sku);
            return { 
                sku: product.sku, 
                priceOnArt: product.priceOnArt, // Pass the visually extracted price
                details 
            };
        });

        const validationResults = await Promise.all(validationPromises);
        
        setResults(validationResults);
        setAppState(AppState.SUCCESS);
      } else {
        setErrorMsg("No pudimos encontrar códigos SKU válidos en la imagen. Asegúrate de que los rectángulos con el código sean visibles.");
        setAppState(AppState.ERROR);
      }
    } catch (error: any) {
      console.error(error);
      if (error.message === 'API_KEY_MISSING') {
          setHasKey(false);
          setAppState(AppState.IDLE);
          setSelectedImage(null);
          return;
      }
      setErrorMsg("Ocurrió un error al procesar la imagen con la IA. Inténtalo de nuevo.");
      setAppState(AppState.ERROR);
    }
  };

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setSelectedImage(null);
    setResults([]);
    setDetectedSkuStrings([]);
    setSpellingResult(null);
    setErrorMsg(null);
  };

  // --- SETUP SCREEN (If no API Key found) ---
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

  // --- MAIN APP ---
  return (
    <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans min-h-[600px] transition-colors duration-300">
      <Navbar 
        onSettingsClick={() => setShowSettings(true)} 
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      <main className="p-4 md:p-8">
        
        {/* IDLE STATE */}
        {appState === AppState.IDLE && (
          <div className="animate-fade-in-up max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 font-medium">
                Sube tu diseño para validar SKUs, precios y ortografía.
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-2 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                <Dropzone onImageSelected={handleImageSelected} />
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 text-center">
                <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-transform hover:-translate-y-1">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full w-fit mx-auto mb-4">
                        <ImageIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">1. Arte</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">Sube tu imagen JPG o PNG</p>
                </div>
                 <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-transform hover:-translate-y-1">
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-full w-fit mx-auto mb-4">
                        <ScanLine className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">2. Escaneo</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">IA detecta SKU y Precios</p>
                </div>
                 <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-transform hover:-translate-y-1">
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-full w-fit mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">3. Validación</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">Compara con novey.com.pa</p>
                </div>
            </div>
          </div>
        )}

        {/* ANALYZING STATE */}
        {appState === AppState.ANALYZING && (
          <div className="mt-12 text-center">
             <div className="relative w-full max-w-xs mx-auto aspect-video bg-gray-200 dark:bg-gray-700 rounded-xl overflow-hidden mb-8 shadow-inner border border-gray-300 dark:border-gray-600">
                {selectedImage && (
                    <img src={selectedImage} className="w-full h-full object-contain opacity-50 blur-sm" alt="Analizando" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-t from-white/90 dark:from-gray-900/90 to-transparent"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <Loader2 className="w-12 h-12 text-novey-red animate-spin mb-4" />
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">Analizando...</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-300">Buscando SKUs y errores...</p>
                    </div>
                </div>
                <div className="absolute top-0 left-0 w-full h-1 bg-novey-red shadow-[0_0_15px_rgba(227,28,35,0.8)] animate-[scan_2s_linear_infinite]"></div>
             </div>
          </div>
        )}

        {/* VALIDATING STATE */}
        {appState === AppState.VALIDATING && (
           <div className="mt-12 text-center">
             <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 max-w-md mx-auto">
                <Globe className="w-16 h-16 text-blue-500 mx-auto mb-6 animate-pulse" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {detectedSkuStrings.length > 1 
                        ? `Detectados ${detectedSkuStrings.length} SKUs`
                        : `SKU: ${detectedSkuStrings[0]}`
                    }
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
                    Consultando base de datos de novey.com.pa...
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3 overflow-hidden">
                  <div className="bg-blue-600 h-3 rounded-full w-2/3 animate-[loading_1.5s_ease-in-out_infinite]"></div>
                </div>
             </div>
           </div>
        )}

        {/* SUCCESS STATE */}
        {appState === AppState.SUCCESS && selectedImage && (
          <SkuResult 
            results={results}
            spellingResult={spellingResult}
            imageSrc={selectedImage} 
            onReset={resetApp} 
          />
        )}

        {/* ERROR STATE */}
        {appState === AppState.ERROR && (
           <div className="mt-10 text-center">
             <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-8 rounded-2xl max-w-lg mx-auto">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Algo salió mal</h3>
                <p className="text-base text-gray-600 dark:text-gray-300 mb-8">
                    {errorMsg}
                </p>
                <button 
                    onClick={resetApp}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                    Intentar otra imagen
                </button>
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
                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500 dark:text-gray-300 mt-2">v2.1 Web</span>
                        
                        <div className="my-6 text-sm text-gray-600 dark:text-gray-400 space-y-2">
                            <p>Herramienta interna para el equipo de diseño.</p>
                            <p className="text-gray-400 dark:text-gray-500 text-xs mt-4">
                                Powered by Gemini AI
                            </p>
                        </div>
                        
                        {/* Option to clear local key if needed */}
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

      <style>{`
        @keyframes scan {
            0% { top: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
        }
        @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default App;