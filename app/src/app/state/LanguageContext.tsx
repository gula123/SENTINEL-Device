import React, { createContext, useContext, useState, useEffect, useMemo, PropsWithChildren } from "react";
import { useAuth } from "./AuthContext";
import { type Language, t as tFn, translations } from "../utils/i18n";
import * as SecureStore from "expo-secure-store";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: PropsWithChildren) {
  const { token, isAuthenticated } = useAuth();
  const [language, setLanguageState] = useState<Language>("en");

  // Load language from secure storage on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const stored = await SecureStore.getItemAsync("app_language");
        if (stored === "hu" || stored === "en") {
          setLanguageState(stored);
        }
      } catch (err) {
        console.error("Failed to load language from storage:", err);
      }
    };

    loadLanguage();
  }, []);

  // Fetch language from backend when authenticated
  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    const fetchLanguageFromBackend = async () => {
      try {
        const response = await fetch("http://localhost:8080/api/user-settings", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          const backendLang = data.language === "hu" ? "hu" : "en";
          setLanguageState(backendLang);
          await SecureStore.setItemAsync("app_language", backendLang);
        }
      } catch (err) {
        console.error("Failed to fetch language from backend:", err);
      }
    };

    fetchLanguageFromBackend();
  }, [isAuthenticated, token]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    
    try {
      await SecureStore.setItemAsync("app_language", lang);
    } catch (err) {
      console.error("Failed to save language to storage:", err);
    }

    // Save to backend if authenticated
    if (token) {
      try {
        await fetch("http://localhost:8080/api/user-settings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ language: lang }),
        });
      } catch (err) {
        console.error("Failed to save language to backend:", err);
      }
    }
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: string) => tFn(language, key),
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
