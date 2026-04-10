import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import en from '../../locales/en.json';
import kin from '../../locales/kin.json';

const translatableAttributes = ['placeholder', 'title', 'aria-label', 'aria-placeholder', 'alt'] as const;

const flattenStrings = (obj: unknown, out: string[] = []): string[] => {
  if (!obj || typeof obj !== 'object') return out;
  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (typeof value === 'string') out.push(value);
    else flattenStrings(value, out);
  }
  return out;
};

const replaceCoreText = (raw: string, mapped: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  const start = raw.indexOf(trimmed);
  if (start < 0) return raw;
  return `${raw.slice(0, start)}${mapped}${raw.slice(start + trimmed.length)}`;
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function RuntimeKinyarwandaTranslator() {
  const { i18n } = useTranslation();

  const { enToKin, kinToEn, enPairs, kinPairs } = useMemo(() => {
    const english = flattenStrings(en);
    const kinyarwanda = flattenStrings(kin);
    const forward = new Map<string, string>();
    const reverse = new Map<string, string>();
    const size = Math.min(english.length, kinyarwanda.length);
    for (let i = 0; i < size; i++) {
      const source = english[i]?.trim();
      const target = kinyarwanda[i]?.trim();
      if (!source || !target || source === target) continue;
      if (!forward.has(source)) forward.set(source, target);
      if (!reverse.has(target)) reverse.set(target, source);
    }
    const toPairs = (map: Map<string, string>) =>
      [...map.entries()].sort((a, b) => b[0].length - a[0].length);
    return { enToKin: forward, kinToEn: reverse, enPairs: toPairs(forward), kinPairs: toPairs(reverse) };
  }, []);

  useEffect(() => {
    const applyMap = () => {
      const toKin = i18n.language === 'kin';
      const map = toKin ? enToKin : kinToEn;
      const pairs = toKin ? enPairs : kinPairs;
      if (!document.body || map.size === 0) return;

      const replaceKnownPhrases = (raw: string) => {
        if (!raw) return raw;
        let next = raw;
        for (const [source, target] of pairs) {
          if (!source || !target || source === target) continue;
          const exact = source.trim();
          if (!exact) continue;
          if (!next.includes(exact)) continue;
          next = next.replace(new RegExp(escapeRegExp(exact), 'g'), target);
        }
        return next;
      };

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const textNode = node as Text;
        const parentTag = (textNode.parentElement?.tagName || '').toLowerCase();
        if (parentTag === 'script' || parentTag === 'style') {
          node = walker.nextNode();
          continue;
        }
        const raw = textNode.nodeValue || '';
        const key = raw.trim();
        const mapped = key ? map.get(key) : undefined;
        if (mapped || raw) {
          const direct = mapped ? replaceCoreText(raw, mapped) : raw;
          const next = replaceKnownPhrases(direct);
          if (next !== raw) textNode.nodeValue = next;
        }
        node = walker.nextNode();
      }

      const elements = document.body.querySelectorAll<HTMLElement>('*');
      elements.forEach((el) => {
        translatableAttributes.forEach((attr) => {
          const raw = el.getAttribute(attr);
          if (!raw) return;
          const mapped = map.get(raw.trim());
          const direct = mapped ? replaceCoreText(raw, mapped) : raw;
          const next = replaceKnownPhrases(direct);
          if (next !== raw) el.setAttribute(attr, next);
        });
      });
    };

    let raf = 0;
    const scheduleApply = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(applyMap);
    };

    scheduleApply();
    i18n.on('languageChanged', scheduleApply);
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      i18n.off('languageChanged', scheduleApply);
    };
  }, [enPairs, enToKin, i18n, kinPairs, kinToEn]);

  return null;
}
