import { useEffect, useState } from "react";

export type Locale = "en" | "tr";

const STORAGE_KEY = "lms_lang";

const dictionary: Record<Locale, Record<string, string>> = {
  en: {
    login: "Login",
    logout: "Logout",
    courses: "Courses",
    modules: "Modules",
    questions: "Questions",
    submit: "Submit"
  },
  tr: {
    login: "Giris",
    logout: "Cikis",
    courses: "Dersler",
    modules: "Moduller",
    questions: "Sorular",
    submit: "Gonder"
  }
};

function getStoredLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "tr" ? "tr" : "en";
}

export function setStoredLocale(locale: Locale) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, locale);
  window.dispatchEvent(new Event("lms-language-change"));
}

export function useI18n() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    setLocale(getStoredLocale());

    const handleChange = () => setLocale(getStoredLocale());
    window.addEventListener("storage", handleChange);
    window.addEventListener("lms-language-change", handleChange);
    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener("lms-language-change", handleChange);
    };
  }, []);

  const t = (key: string) => dictionary[locale][key] ?? dictionary.en[key] ?? key;

  return {
    locale,
    t,
    setLocale: setStoredLocale
  };
}
