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

  useEffect(() => {
    // Check if we have an API Key available (either Env or LocalStorage)
    const valid = hasValidApiKey();
    setHasKey(valid);
  }, []);

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
    <div className="bg-gray-50 text-gray-900 font-sans min-h-[600px]">
      <Navbar onSettingsClick={() => setShowSettings(true)} />

      <main className="p-4">
        
        {/* IDLE STATE */}
        {appState === AppState.IDLE && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-600">
                Sube tu diseño para validar SKUs, precios y ortografía.
              </p>
            </div>
            
            <div className="bg-white p-2 rounded-xl shadow-md border border-gray-100">
                <Dropzone onImageSelected={handleImageSelected} />
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                    <ImageIcon className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                    <h3 className="text-xs font-semibold">1. Arte</h3>
                </div>
                 <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                    <ScanLine className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                    <h3 className="text-xs font-semibold">2. Escaneo</h3>
                </div>
                 <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                    <h3 className="text-xs font-semibold">3. Validación</h3>
                </div>
            </div>
          </div>
        )}

        {/* ANALYZING STATE */}
        {appState === AppState.ANALYZING && (
          <div className="mt-12 text-center">
             <div className="relative w-full max-w-xs mx-auto aspect-video bg-gray-200 rounded-lg overflow-hidden mb-8 shadow-inner border border-gray-300">
                {selectedImage && (
                    <img src={selectedImage} className="w-full h-full object-contain opacity-50 blur-sm" alt="Analizando" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-t from-white/90 to-transparent"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <Loader2 className="w-10 h-10 text-novey-red animate-spin mb-3" />
                        <h3 className="text-lg font-bold text-gray-800">Analizando...</h3>
                        <p className="text-xs text-gray-500">Buscando SKUs y errores...</p>
                    </div>
                </div>
                <div className="absolute top-0 left-0 w-full h-1 bg-novey-red shadow-[0_0_15px_rgba(227,28,35,0.8)] animate-[scan_2s_linear_infinite]"></div>
             </div>
          </div>
        )}

        {/* VALIDATING STATE */}
        {appState === AppState.VALIDATING && (
           <div className="mt-12 text-center">
             <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 max-w-sm mx-auto">
                <Globe className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {detectedSkuStrings.length > 1 
                        ? `Detectados ${detectedSkuStrings.length} SKUs`
                        : `SKU: ${detectedSkuStrings[0]}`
                    }
                </h3>
                <p className="text-xs text-gray-600 mb-6">
                    Consultando novey.com.pa...
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3 overflow-hidden">
                  <div className="bg-blue-600 h-2 rounded-full w-2/3 animate-[loading_1.5s_ease-in-out_infinite]"></div>
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
             <div className="bg-red-50 border border-red-100 p-6 rounded-xl">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Algo salió mal</h3>
                <p className="text-sm text-gray-600 mb-6">
                    {errorMsg}
                </p>
                <button 
                    onClick={resetApp}
                    className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
                >
                    Intentar otra imagen
                </button>
             </div>
           </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-xl w-full max-w-xs shadow-2xl p-5 relative">
                    <button 
                        onClick={() => setShowSettings(false)}
                        className="absolute top-3 right-3 p-1 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    
                    <div className="flex flex-col items-center text-center">
                        <div className="bg-novey-red p-2 rounded-lg mb-3">
                             <Laptop className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">Art Inspector</h2>
                        <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-500 mt-1">v2.0 Web</span>
                        
                        <div className="my-4 text-xs text-gray-600 space-y-2">
                            <p>Herramienta interna para el equipo de diseño.</p>
                            <p className="text-gray-400">
                                Powered by Gemini AI
                            </p>
                        </div>
                        
                        {/* Option to clear local key if needed */}
                        <button
                            className="text-xs text-red-500 underline mb-4"
                            onClick={() => {
                                localStorage.removeItem('art_inspector_api_key');
                                window.location.reload();
                            }}
                        >
                            Desvincular API Key
                        </button>

                        <button 
                            className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
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