

import React, { useState } from 'react';
import { ExternalLink, CheckCircle, Search, Copy, ShoppingCart, AlertTriangle, XCircle, Tag, Grid, Layout, SpellCheck, ArrowRight, DollarSign } from 'lucide-react';
import { ProductResultItem, NoveyProductDetails, SpellingAnalysis } from '../types';

interface SkuResultProps {
  results: ProductResultItem[];
  spellingResult: SpellingAnalysis | null;
  imageSrc: string;
  onReset: () => void;
}

const ProductCard: React.FC<{ item: ProductResultItem }> = ({ item }) => {
    const [imgError, setImgError] = useState(false);
    const { sku, details, priceOnArt } = item;
    
    const isMatchFound = details.found;
    const hasDiscount = details.regularPrice && details.regularPrice !== details.price;
    const targetUrl = details.url || `https://www.novey.com.pa/catalogsearch/result/?q=${sku}`;

    // Price Matching Logic for the Card visual
    const parsePrice = (priceStr?: string) => {
        if (!priceStr) return 0;
        return parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    };

    const webPriceVal = parsePrice(details.price);
    const artPriceVal = priceOnArt || 0;
    
    // Simple logic: if Art price is defined and differs > 0.05 from web price
    const isPriceMismatch = isMatchFound && artPriceVal > 0 && Math.abs(webPriceVal - artPriceVal) > 0.05;

    return (
        <div className={`
            relative bg-white rounded-xl shadow-sm border transition-all duration-300 hover:shadow-md hover:scale-[1.02] flex flex-col h-full
            ${isMatchFound 
                ? (isPriceMismatch ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200') 
                : 'border-orange-300 ring-1 ring-orange-100'}
        `}>
            {/* Status Header */}
            <div className={`
                px-4 py-2 text-xs font-semibold flex justify-between items-center border-b rounded-t-xl
                ${isMatchFound 
                    ? 'bg-green-50 text-green-700 border-green-100' 
                    : 'bg-orange-100 text-orange-900 border-orange-200'}
            `}>
                <span className="flex items-center gap-1.5">
                    {isMatchFound ? (
                        <CheckCircle className="w-3 h-3" />
                    ) : (
                        <Search className="w-4 h-4 stroke-[2.5]" />
                    )}
                    {isMatchFound ? 'Verificado' : 'Búsqueda Manual'}
                </span>
                <span className="font-mono bg-white/50 px-2 py-0.5 rounded">SKU: {sku}</span>
            </div>

            {/* Discount Badge */}
            {hasDiscount && isMatchFound && (
                <div className="absolute top-10 right-2 bg-novey-red text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm z-10 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    OFERTA
                </div>
            )}

            {/* Price Warning Overlay on Image */}
            {isPriceMismatch && (
                <div className="absolute top-10 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm z-10 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    ERROR PRECIO
                </div>
            )}

            {/* Image Section */}
            <div className="h-40 p-4 flex items-center justify-center bg-gray-50/50 relative overflow-hidden group">
                 {details.imageUrl && !imgError ? (
                    <img 
                        src={details.imageUrl} 
                        alt={details.title}
                        className="w-full h-full object-contain mix-blend-multiply transition-opacity duration-300"
                        onError={() => setImgError(true)}
                    />
                 ) : (
                    <div className="flex flex-col items-center justify-center text-gray-300">
                        {isMatchFound ? (
                            <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
                        ) : (
                            <Search className="w-10 h-10 mb-2 opacity-30 text-orange-300" />
                        )}
                        <span className="text-xs">{isMatchFound ? 'Sin imagen' : 'No visible'}</span>
                    </div>
                 )}
            </div>

            {/* Content Section */}
            <div className="p-4 flex-1 flex flex-col">
                <h4 className="text-sm font-bold text-gray-900 leading-tight mb-2 line-clamp-2 min-h-[2.5em]" title={details.title}>
                    {details.title || "Producto no identificado en web"}
                </h4>

                <div className="mt-auto pt-2 border-t border-gray-50">
                     {isMatchFound ? (
                         <div className="flex justify-between items-end">
                            <div>
                                {hasDiscount && (
                                    <p className="text-xs text-gray-400 line-through">
                                        {details.regularPrice}
                                    </p>
                                )}
                                <div className="flex flex-col">
                                    <p className={`text-lg font-bold leading-none ${isPriceMismatch ? 'text-green-600' : 'text-novey-red'}`}>
                                        {details.price}
                                    </p>
                                    {isPriceMismatch && (
                                        <p className="text-[10px] text-red-500 font-semibold">
                                            Arte: ${artPriceVal.toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <a 
                                href={targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-800 transition-colors"
                            >
                                Ver Web
                            </a>
                         </div>
                     ) : (
                         <div className="text-center">
                            <p className="text-xs text-orange-800 bg-orange-50 p-2 rounded mb-2">
                                No se pudo validar este SKU automáticamente.
                            </p>
                            <a 
                                href={targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block w-full text-xs border border-orange-500 text-orange-700 font-medium px-2 py-2 rounded hover:bg-orange-50 transition-colors flex items-center justify-center gap-1"
                            >
                                <Search className="w-3 h-3" />
                                Buscar Manualmente
                            </a>
                         </div>
                     )}
                </div>
            </div>
        </div>
    );
};

const OrthographyAlert: React.FC<{ analysis: SpellingAnalysis }> = ({ analysis }) => {
    if (!analysis.hasErrors) return (
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-3 mb-6">
            <div className="bg-green-100 p-2 rounded-full">
                <SpellCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
                <h4 className="font-bold text-green-900 text-sm">Ortografía Impecable</h4>
                <p className="text-xs text-green-700">No se detectaron errores gramaticales.</p>
            </div>
        </div>
    );

    return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 p-2 rounded-full animate-pulse">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-novey-red uppercase tracking-wide">CORREGIR ORTOGRAFÍA</h3>
                    <p className="text-sm text-red-700">Se detectaron {analysis.corrections.length} posibles errores.</p>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {analysis.corrections.map((correction, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border-l-4 border-novey-red shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-500 line-through text-sm">{correction.original}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <span className="font-bold text-green-700 text-base">{correction.suggestion}</span>
                        </div>
                        {correction.context && (
                            <p className="text-xs text-gray-500 italic">{correction.context}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const PriceIntegrityAlert: React.FC<{ results: ProductResultItem[] }> = ({ results }) => {
    // Filter items that have a visual price AND a web match
    const priceItems = results.filter(r => r.priceOnArt !== undefined && r.priceOnArt !== null && r.details.found);
    
    if (priceItems.length === 0) return null; // No readable prices to compare

    const mismatches = priceItems.filter(item => {
        const webPriceRaw = item.details.price || "0";
        const webPrice = parseFloat(webPriceRaw.replace(/[^0-9.]/g, ''));
        const artPrice = item.priceOnArt || 0;
        // Tolerance of 5 cents
        return Math.abs(webPrice - artPrice) > 0.05;
    });

    if (mismatches.length === 0) {
        return (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-3 mb-6">
                <div className="bg-green-100 p-2 rounded-full">
                    <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                    <h4 className="font-bold text-green-900 text-sm">Precios Correctos</h4>
                    <p className="text-xs text-green-700">Los precios en el arte coinciden con la web de Novey.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 p-2 rounded-full animate-pulse">
                    <DollarSign className="w-6 h-6 text-red-600" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-novey-red uppercase tracking-wide">ERROR DE PRECIO DETECTADO</h3>
                    <p className="text-sm text-red-700">Hay diferencias entre el arte y la web actual.</p>
                </div>
            </div>

            <div className="space-y-3">
                {mismatches.map((item) => (
                    <div key={item.sku} className="bg-white p-3 rounded-lg border-l-4 border-red-500 shadow-sm flex items-center justify-between">
                        <div>
                            <span className="text-xs font-mono bg-gray-100 px-1 rounded text-gray-500 block mb-1">SKU {item.sku}</span>
                            <h5 className="font-medium text-sm text-gray-800 line-clamp-1">{item.details.title}</h5>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                             <div>
                                 <p className="text-xs text-red-500 font-bold uppercase">En Arte</p>
                                 <p className="text-lg font-bold text-red-600 line-through decoration-2">${item.priceOnArt?.toFixed(2)}</p>
                             </div>
                             <ArrowRight className="w-4 h-4 text-gray-400" />
                             <div>
                                 <p className="text-xs text-green-600 font-bold uppercase">En Web</p>
                                 <p className="text-lg font-bold text-green-600">{item.details.price}</p>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SkuResult: React.FC<SkuResultProps> = ({ results, spellingResult, imageSrc, onReset }) => {
  const totalSkus = results.length;
  const foundSkus = results.filter(r => r.details.found).length;
  
  const isSingleMode = totalSkus === 1;
  const singleItem = results[0];

  return (
    <div className="flex flex-col h-full animate-fade-in pb-12">
      
      {/* Universal Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${foundSkus === totalSkus ? 'bg-green-100' : 'bg-yellow-100'}`}>
              {foundSkus === totalSkus ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">
                {foundSkus}/{totalSkus} Productos Validados
              </p>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                {isSingleMode ? `SKU: ${singleItem.sku}` : 'Resumen de Análisis'}
              </h2>
            </div>
          </div>
          
          <div className="flex gap-3">
             <button 
                onClick={onReset}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors shadow-sm"
             >
                Escanear Nuevo Arte
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Spelling Alerts Section */}
          {spellingResult && <OrthographyAlert analysis={spellingResult} />}
          
          {/* Price Integrity Section */}
          <PriceIntegrityAlert results={results} />
      </div>

      {/* Main Content Layout */}
      <div className={`grid gap-6 ${isSingleMode ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3'}`}>
        
        {/* Left: Original Art */}
        <div className={`${isSingleMode ? '' : 'lg:col-span-1'}`}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col sticky top-24">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-700">Tu Arte Original</h3>
                    <span className="text-xs text-gray-400 bg-white px-2 py-1 rounded border">
                        {totalSkus} Códigos detectados
                    </span>
                </div>
                <div className="bg-gray-100 relative flex items-center justify-center p-4 overflow-hidden min-h-[300px]">
                    <img 
                    src={imageSrc} 
                    alt="Arte subido" 
                    className="max-w-full max-h-[500px] object-contain shadow-lg rounded-md" 
                    />
                </div>
            </div>
        </div>

        {/* Right: Results Area */}
        <div className={`${isSingleMode ? '' : 'lg:col-span-2'}`}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full bg-gray-50/50">
                <div className="p-4 border-b border-gray-100 bg-white flex justify-between items-center">
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        Resultados Web
                    </h3>
                </div>

                <div className="p-6">
                    {/* Grid for Cards */}
                    <div className={`grid gap-6 ${isSingleMode ? 'grid-cols-1 place-items-center' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3'}`}>
                        {results.map((item) => (
                             <div key={item.sku} className={isSingleMode ? 'w-full max-w-sm' : 'w-full'}>
                                 <ProductCard item={item} />
                             </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default SkuResult;