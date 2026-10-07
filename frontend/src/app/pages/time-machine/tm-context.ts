import { LandmarkPhoto } from './time-machine-photos';
import { Lang } from './tm-i18n';

/**
 * What the Time Lens and Education modules need from the Time Machine page: its data in the current
 * language, and a way to select a landmark/era on the page. Implemented by TimeMachineComponent.
 */
export interface TmContext {
  lang(): Lang;
  /** Vietnamese or English text, by page language. */
  tr(vi: string, en: string): string;
  /** Landmark keys, in page order. */
  keys(): string[];
  name(key: string): string;
  /** Short subtitle of a landmark (e.g. "Hanoi Opera House · 1911"). */
  sub(key: string): string;
  /** Shareable link that opens the page on a landmark (in the current language). */
  landmarkUrl(key: string): string;
  events(key: string): Array<{ year: string; sort: number; text: string }>;
  tours(): Array<{ id: string; name: string; stops: string[] }>;
  /** A landmark's photo for an era, in the current language (captions, alt text). */
  photo(key: string, eraId: string): LandmarkPhoto | undefined;
  /** The oldest archive photo of a landmark and its era, if any. */
  thenPhoto(key: string): { era: string; photo: LandmarkPhoto } | null;
  /** Landmark currently selected on the page. */
  current(): string;
  /** Era currently selected on the page ('1926' … '2100'). */
  era(): string;
  /** Selects a landmark (and optionally an era) on the page. */
  select(key: string, eraId?: string): void;
  link(text: string, url: string): HTMLAnchorElement;
}
