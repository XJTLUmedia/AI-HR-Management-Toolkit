"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "resume-parser-api-key";

interface ApiKeyInputProps {
  onKeyChange: (key: string) => void;
}

export function ApiKeyInput({ onKeyChange }: ApiKeyInputProps) {
  const [key, setKey] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || "";
    setKey(stored);
    onKeyChange(stored);
  }, [onKeyChange]);

  const handleSave = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, key);
    onKeyChange(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [key, onKeyChange]);

  const handleClear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setKey("");
    onKeyChange("");
  }, [onKeyChange]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type={isVisible ? "text" : "password"}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="sk-..."
          className="input-field w-full !pr-8 !text-xs"
        />
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="absolute right-2 top-1/2 -translate-y-1/2 transition-opacity opacity-50 hover:opacity-100"
          style={{ color: 'var(--muted)' }}
        >
          {isVisible ? (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          )}
        </button>
      </div>
      <button
        onClick={handleSave}
        className="btn-primary !rounded-lg !px-3 !py-1.5 !text-xs"
      >
        {saved ? "Saved!" : "Save"}
      </button>
      {key && (
        <button
          onClick={handleClear}
          className="btn-secondary !rounded-lg !px-3 !py-1.5 !text-xs"
        >
          Clear
        </button>
      )}
    </div>
  );
}
