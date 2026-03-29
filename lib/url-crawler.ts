
import type { DetailedProductInfo } from '../types';
export type { DetailedProductInfo };

// 각 모드별 크롤러 모듈 임포트
import { crawlTravelProduct as normalCrawl } from './crawlers/normal';
import { crawlForBooking as bookingCrawl } from './crawlers/booking';
import { crawlForConfirmation as confirmationCrawl } from './crawlers/confirmation/index';

import { crawlForReservationGuide as reservationGuideCrawl } from '@/lib/crawlers/reservation-guide';

// 유틸리티 재수출 (호환성 유지)
export * from './crawler-base-utils';
export * from './crawlers/fetcher';
export * from './crawlers/refiner';
export * from './crawler-formatter';
export { scrapeWithBrowser } from './browser-crawler';

// 기본 크롤러 함수 재수출
export const crawlTravelProduct = normalCrawl;
export const crawlForBooking = bookingCrawl;
export const crawlForConfirmation = confirmationCrawl;
export const crawlForReservationGuide = reservationGuideCrawl;

