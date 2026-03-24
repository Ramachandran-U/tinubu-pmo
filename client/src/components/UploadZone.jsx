import { useState, useRef } from 'react';
import { useApi } from '../hooks/useApi';

/**
 * Reusable Drag and Drop file upload zone.
 */
export default function UploadZone({ endpoint, title, info, onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const inputRef = useRef(null);
  
  const { req, loading, error } = useApi();

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setSuccessMsg('');
    
    // FormData bypasses standard JSON body
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await req(endpoint, {
        method: 'POST',
        headers: {
          // fetch automatically sets correct multipart boundary when posting FormData if Content-Type is omitted
          'Content-Type': undefined 
        },
        body: formData
      });
      
      const versionLabel = res.version ? ` (v${res.version})` : '';
      setSuccessMsg(`Successfully parsed ${res.rowCount} rows for period ${res.yearMonth}${versionLabel}.`);
      setFile(null);
      if (onUploadSuccess) onUploadSuccess();
      
    } catch (err) {
      // error is handled by useApi
    }
  };

  return (
    <div className="bg-surface-container-lowest p-6 rounded-lg shadow-sm border border-outline-variant/10 flex flex-col gap-4">
      <h3 className="text-lg font-bold text-on-surface">{title}</h3>
      <p className="text-xs text-on-surface-variant">{info}</p>
      
      <div 
        className={`relative flex flex-col items-center justify-center p-8 mt-2 border-2 border-dashed rounded-xl transition-all ${
          dragActive ? 'border-primary bg-primary/5' : 'border-outline-variant/30 bg-surface-container-low/30 hover:bg-surface-container-low/70'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          ref={inputRef} 
          type="file" 
          accept=".xlsx, .xls" 
          className="hidden" 
          onChange={handleChange} 
        />
        
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
          <span className="material-symbols-outlined text-2xl">cloud_upload</span>
        </div>
        
        {file ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-on-surface">{file.name}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <button 
              onClick={() => setFile(null)}
              className="mt-3 text-[10px] font-bold text-error uppercase tracking-widest hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium text-on-surface-variant">
              Drag and drop an <strong className="text-primary">Excel</strong> file here
            </p>
            <p className="text-xs text-outline mt-1 mb-4">or</p>
            <button 
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-lg transition-colors border border-outline-variant/20 shadow-sm"
            >
              Browse Files
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-error-container/30 border border-error/20 rounded-lg text-xs text-error flex items-center gap-2 mt-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2 mt-2">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className={`w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
          !file || loading
            ? 'bg-surface-container text-outline cursor-not-allowed border border-outline-variant/10'
            : 'primary-gradient text-white shadow-sm hover:opacity-90'
        }`}
      >
        {loading ? (
          <>
            <span className="material-symbols-outlined animate-spin text-sm">sync</span>
            Processing...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-sm">upload</span>
            Upload & Process Data
          </>
        )}
      </button>
    </div>
  );
}
