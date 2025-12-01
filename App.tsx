import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Dropzone from './components/Dropzone';
import SkuResult from './components/SkuResult';
import { extractSkuFromImage, validateSkuWithWeb, checkSpellingInImage } from './services/geminiService';
import { AppState, ProductResultItem, SpellingAnalysis } from './types';
import { Loader2, AlertCircle, Image as ImageIcon, CheckCircle, ScanLine, Globe, X, Laptop } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const [results, setResults] = useState<ProductResultItem[]>([]);
  // Use a string array just for the loading screen display
  const [detectedSkuStrings, setDetectedSkuStrings] = useState<string[]>([]);
  
  const [spellingResult, setSpellingResult] = useState<SpellingAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    } catch (error) {
      console.error(error);
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
                        <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-500 mt-1">v1.2.0 Extension</span>
                        
                        <div className="my-4 text-xs text-gray-600 space-y-2">
                            <p>Herramienta interna para el equipo de diseño.</p>
                            <p className="text-gray-400">
                                Powered by Gemini AI
                            </p>
                        </div>

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