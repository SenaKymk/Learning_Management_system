import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type Locale = "tr" | "en" | "es";

const STORAGE_KEY = "lms_lang";
const listeners = new Set<(locale: Locale) => void>();

const dictionary: Record<Locale, Record<string, string>> = {
  tr: {
    language: "Dil",
    turkish: "Türkçe",
    english: "İngilizce",
    spanish: "İspanyolca",
    notes: "Notlar",
    saveNotes: "Notları kaydet",
    openPdf: "PDF aç",
    downloadPdf: "PDF indir",
    startTimer: "Zamanlayıcı başlat",
    timerRunning: "Zamanlayıcı çalışıyor",
    timerDone: "Zamanlayıcı bitti",
    minutes: "dakika"
  },
  en: {
    language: "Language",
    turkish: "Turkish",
    english: "English",
    spanish: "Spanish",
    notes: "Notes",
    saveNotes: "Save notes",
    openPdf: "Open PDF",
    downloadPdf: "Download PDF",
    startTimer: "Start timer",
    timerRunning: "Timer running",
    timerDone: "Timer finished",
    minutes: "minutes"
  },
  es: {
    language: "Idioma",
    turkish: "Turco",
    english: "Inglés",
    spanish: "Español",
    notes: "Notas",
    saveNotes: "Guardar notas",
    openPdf: "Abrir PDF",
    downloadPdf: "Descargar PDF",
    startTimer: "Iniciar temporizador",
    timerRunning: "Temporizador en marcha",
    timerDone: "Temporizador terminado",
    minutes: "minutos"
  }
};

async function getStoredLocale(): Promise<Locale> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "es" ? stored : "tr";
}

export async function setStoredLocale(locale: Locale) {
  await AsyncStorage.setItem(STORAGE_KEY, locale);
  listeners.forEach((listener) => listener(locale));
}

export function useI18n() {
  const [locale, setLocale] = useState<Locale>("tr");

  useEffect(() => {
    let mounted = true;
    getStoredLocale().then((stored) => {
      if (mounted) {
        setLocale(stored);
      }
    });
    const listener = (next: Locale) => setLocale(next);
    listeners.add(listener);
    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  const t = (key: string) => dictionary[locale][key] ?? dictionary.tr[key] ?? key;

  return { locale, setLocale: setStoredLocale, t };
}
