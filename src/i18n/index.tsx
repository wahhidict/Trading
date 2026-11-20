import { createContext, useContext, useMemo } from 'react'
import { t, type Lang, type StringKey } from './strings'

export interface I18nCtx {
  lang: Lang
  dir: 'rtl' | 'ltr'
  t: (key: StringKey) => string
}

const Ctx = createContext<I18nCtx>({ lang: 'ar', dir: 'rtl', t: (k) => t('ar', k) })

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }): React.ReactNode {
  const value = useMemo<I18nCtx>(() => ({
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    t: (k: StringKey) => t(lang, k),
  }), [lang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useT(): I18nCtx {
  return useContext(Ctx)
}
