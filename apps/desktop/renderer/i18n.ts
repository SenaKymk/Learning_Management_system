export type Locale = "en" | "tr";

const STORAGE_KEY = "lms_lang";

const dictionary: Record<Locale, Record<string, string>> = {
  en: {
    login: "Login",
    logout: "Logout",
    courses: "Courses",
    modules: "Modules",
    questions: "Questions",
    submit: "Submit",
    dashboard: "Dashboard"
  },
  tr: {
    login: "Giris",
    logout: "Cikis",
    courses: "Dersler",
    modules: "Moduller",
    questions: "Sorular",
    submit: "Gonder",
    dashboard: "Panel"
  }
};

export function getLocale(): Locale {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "tr" ? "tr" : "en";
}

export function setLocale(locale: Locale) {
  window.localStorage.setItem(STORAGE_KEY, locale);
  window.dispatchEvent(new Event("lms-language-change"));
}

export function t(key: string) {
  const locale = getLocale();
  return dictionary[locale][key] ?? dictionary.en[key] ?? key;
}
