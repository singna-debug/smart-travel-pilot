import { DetailedProductInfo } from '../../types';
import { inferDestination } from '../crawler-base-utils';

export function extractHanjinTravelCode(url: string): string | null {
  try {
    const match = url.match(/[?&](?:gdsNo|evtNo)=([A-Za-z0-9_-]+)/i);
    if (match) return match[1];
    return null;
  } catch (e) {
    return null;
  }
}

// ─── Meal type code mapping ───
const MEAL_MAP: Record<string, string> = {
  'ML_TP_001': '불포함',
  'ML_TP_002': '포함',
  'ML_TP_003': '자유식',
  'ML_TP_900': '-',
};

function mealLabel(code: string, cntn: string): string {
  if (cntn && cntn.trim().length > 0) return cntn.trim();
  return MEAL_MAP[code] || '-';
}

// ─── API Base ───
const API_BASE = 'https://www.hanjintravel.com/api/v1/dp/display';

export async function fetchHanjinTravelNative(url: string, isSummaryOnly: boolean = false): Promise<DetailedProductInfo | null> {
  try {
    const gdsNo = url.match(/gdsNo=([^&]+)/i)?.[1];
    const evtNo = url.match(/evtNo=([^&]+)/i)?.[1];

    if (!gdsNo || !evtNo) {
      console.warn('[HanjinTravel] Missing gdsNo or evtNo in URL:', url);
      return null;
    }

    console.log(`[HanjinTravel] API fetch for gdsNo=${gdsNo}, evtNo=${evtNo}`);
    const start = Date.now();

    // ─── 3 API calls in parallel (~300-500ms total) ───
    const [detailRes, scheduleRes, cautionRes] = await Promise.all([
      fetch(`${API_BASE}/event-detail?gdsNo=${gdsNo}&evtNo=${evtNo}`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE}/schedule?evtNo=${evtNo}`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE}/need-item-and-caution?evtNo=${evtNo}`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    console.log(`[HanjinTravel] API calls completed in ${Date.now() - start}ms`);

    if (!detailRes?.detail) {
      console.error('[HanjinTravel] API returned no detail data');
      return null;
    }

    const d = detailRes.detail;

    // ─── Basic product info ───
    const title = d.gdsNm || '';
    const adultPrice = d.adltFare ? Number(d.adltFare) : 0;
    const fakePrice = d.adltFakeFare ? Number(d.adltFakeFare) : 0;
    const priceStr = adultPrice > 0
      ? `${adultPrice.toLocaleString()}원`
      : (fakePrice > 0 ? `${fakePrice.toLocaleString()}원` : '가격 정보 문의 (선착순 특가)');

    // ─── Dates ───
    const tofDe = d.tofDe || ''; // YYYYMMDD
    const depDate = tofDe.length === 8
      ? `${tofDe.slice(0, 4)}-${tofDe.slice(4, 6)}-${tofDe.slice(6, 8)}`
      : (d.deptDt || '');

    const daysCount = d.trPrdNody ? Number(d.trPrdNody) : 0;
    const nightsCount = d.trPrdLodgNody ? Number(d.trPrdLodgNody) : Math.max(0, daysCount - 1);
    const duration = daysCount > 0 ? `${nightsCount}박 ${daysCount}일` : '';

    // Calculate return date from departure + days
    let returnDate = d.rthcDt || '';
    if (!returnDate && tofDe.length === 8 && daysCount > 0) {
      const depD = new Date(Number(tofDe.slice(0, 4)), Number(tofDe.slice(4, 6)) - 1, Number(tofDe.slice(6, 8)));
      depD.setDate(depD.getDate() + daysCount - 1);
      returnDate = `${depD.getFullYear()}-${String(depD.getMonth() + 1).padStart(2, '0')}-${String(depD.getDate()).padStart(2, '0')}`;
    }

    // ─── Flight info ───
    const airline = d.dpfcArlnNm || '';
    const depFlight = d.dpfcFltschNm || '';
    const retFlight = d.rthcFltschNm || '';
    const depTime = d.dpfcDprtTofHr && d.dpfcDprtTofMi ? `${d.dpfcDprtTofHr}:${d.dpfcDprtTofMi}` : '';
    const arrTime = d.dpfcDestArvlHr && d.dpfcDestArvlMi ? `${d.dpfcDestArvlHr}:${d.dpfcDestArvlMi}` : '';
    const retDepTime = d.rthcDprtTofHr && d.rthcDprtTofMi ? `${d.rthcDprtTofHr}:${d.rthcDprtTofMi}` : '';
    const retArrTime = d.rthcDestArvlHr && d.rthcDestArvlMi ? `${d.rthcDestArvlHr}:${d.rthcDestArvlMi}` : '';

    const depCity = d.dpfcDprtArptCtyNm || '서울';
    const arrCity = d.dpfcDestArptCtyNm || '';
    const retDepCity = d.rthcDprtArptCtyNm || arrCity;
    const retArrCity = d.rthcDestArptCtyNm || depCity;

    // ─── Images ───
    const images: string[] = [];
    if (d.evtImgList && Array.isArray(d.evtImgList)) {
      for (const img of d.evtImgList) {
        if (img.imgS3Url) images.push(img.imgS3Url);
      }
    }

    // ─── Key points ───
    const rawKeyPoints: string[] = [];
    if (d.gdsCorePntKyftCntn) {
      d.gdsCorePntKyftCntn.split('\n').forEach((line: string) => {
        const t = line.trim();
        if (t.length > 2) rawKeyPoints.push(t);
      });
    }
    for (let i = 1; i <= 5; i++) {
      const val = d[`gdsItrd${i}Val`];
      if (val && val.trim().length > 2 && !rawKeyPoints.includes(val.trim())) {
        rawKeyPoints.push(val.trim());
      }
    }
    for (let i = 1; i <= 5; i++) {
      const ttl = d[`gdsCorePntAvtnT${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'}Ttl`];
      const cntn = d[`gdsCorePntAvtnT${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'}Cntn`];
      if (ttl && ttl.trim().length > 2) rawKeyPoints.push(ttl.trim());
      if (cntn && cntn.trim().length > 2) rawKeyPoints.push(cntn.trim());
    }
    const keyPoints = Array.from(new Set(rawKeyPoints)).slice(0, 6);

    // ─── Destination ───
    let destination = inferDestination(title, `${d.catePath || ''} ${d.vstCtyCntn || ''}`, url);
    if ((!destination || destination === '미정') && d.catePath) {
      const parts = d.catePath.split('>').map((p: string) => p.trim());
      if (parts.length >= 3) destination = parts.slice(2).join(' / ');
    }

    // ─── Inclusions / Exclusions ───
    const inclusions: string[] = [];
    if (d.inclMtrCntn) {
      d.inclMtrCntn.split('\n').forEach((line: string) => {
        const t = line.trim();
        if (t.length > 1) inclusions.push(`▶ ${t.replace(/^▶\s*/, '')}`);
      });
    }

    const exclusions: string[] = [];
    if (d.ninclMtrCntn) {
      d.ninclMtrCntn.split('\n').forEach((line: string) => {
        const t = line.trim();
        if (t.length > 1) exclusions.push(`▶ ${t.replace(/^▶\s*/, '')}`);
      });
    }

    // ─── Cancellation policy from cnclFeeList ───
    let cancelTerms = '[한진트래블 국외여행 표준약관 적용]';
    if (d.cnclFeeList && Array.isArray(d.cnclFeeList) && d.cnclFeeList.length > 0) {
      const lines = d.cnclFeeList.map((fee: any) => {
        const pct = fee.cmpsVal || 0;
        const note = fee.cmpsCntn || '';
        if (pct === 0 && note) return `• ${note}`;
        if (fee.cndBgnNody === 0 && fee.cndEndNody > 30) return `• 여행개시 ${fee.cndEndNody}일 전까지 통보 시: 계약금 환급`;
        return `• 여행개시 ${fee.cndBgnNody}~${fee.cndEndNody}일 전 통보 시: 여행요금의 ${pct}% 배상`;
      });
      cancelTerms += '\n' + lines.join('\n');
    }

    // ─── Itinerary from schedule API ───
    const itinerary: any[] = [];

    if (scheduleRes) {
      const dayList = scheduleRes.eventScheduleDayList || [];
      const tripList = scheduleRes.tripList || [];
      const descList = scheduleRes.descList || [];
      const lodgList = scheduleRes.lodgList || [];
      const imgList = scheduleRes.imgList || [];

      for (const dayInfo of dayList) {
        const dayNum = dayInfo.schdlDyo;
        const dtlSn = dayInfo.schdlDtlSn;

        // Meals
        const breakfast = mealLabel(dayInfo.bfMlTpCd, dayInfo.bfMlCntn);
        const lunch = mealLabel(dayInfo.lncMlTpCd, dayInfo.lncMlCntn);
        const dinner = mealLabel(dayInfo.dnrMlTpCd, dayInfo.dnrMlCntn);

        // Spots for this day
        const daySpots = tripList
          .filter((t: any) => t.schdlDtlSn === dtlSn)
          .sort((a: any, b: any) => (a.srtSeq || 0) - (b.srtSeq || 0));

        // Descriptions for this day
        const dayDescs = descList
          .filter((desc: any) => desc.schdlDtlSn === dtlSn)
          .sort((a: any, b: any) => (a.srtSeq || 0) - (b.srtSeq || 0));

        // Hotel for this day
        const dayLodg = lodgList.find((l: any) => l.schdlDtlSn === dtlSn);
        const hotelName = dayLodg
          ? `${dayLodg.htlKrnm || ''}${dayLodg.htlEngnm ? `(${dayLodg.htlEngnm})` : ''}`
          : '-';

        // Images for this day
        const dayImages = imgList
          .filter((img: any) => img.schdlDtlSn === dtlSn && img.s3Url)
          .map((img: any) => img.s3Url);

        // Build description from desc items
        const descText = dayDescs
          .map((desc: any) => (desc.amplDescCntn || '').replace(/_@@_\s*/g, '').trim())
          .filter((t: string) => t.length > 0)
          .join('\n');

        // Build items from spots + descriptions
        const items: any[] = [];

        // Map images to spots by schdlDtlSeqSn
        const imgBySeq: Record<number, string[]> = {};
        for (const img of imgList.filter((im: any) => im.schdlDtlSn === dtlSn && im.s3Url)) {
          const seq = img.schdlDtlSeqSn;
          if (!imgBySeq[seq]) imgBySeq[seq] = [];
          imgBySeq[seq].push(img.s3Url);
        }

        for (const spot of daySpots) {
          const spotImgs = imgBySeq[spot.schdlDtlSeqSn] || [];
          items.push({
            title: spot.trdstnNm || '',
            description: spot.trdstnDesc || '',
            type: 'location' as const,
            image: spotImgs[0] || spot.s3Url || '',
            images: spotImgs.length > 0 ? spotImgs : (spot.s3Url ? [spot.s3Url] : []),
          });
        }

        // If no spots found, create items from description lines
        if (items.length === 0 && descText) {
          items.push({
            title: `${dayNum}일차 일정`,
            description: descText,
            type: 'default' as const,
            image: dayImages[0] || '',
          });
        }

        // Calculate date for this day
        let dayDate = '';
        if (tofDe.length === 8 && dayNum > 0) {
          const baseDate = new Date(Number(tofDe.slice(0, 4)), Number(tofDe.slice(4, 6)) - 1, Number(tofDe.slice(6, 8)));
          baseDate.setDate(baseDate.getDate() + dayNum - 1);
          const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
          dayDate = `${String(baseDate.getFullYear()).slice(2)}.${String(baseDate.getMonth() + 1).padStart(2, '0')}.${String(baseDate.getDate()).padStart(2, '0')}(${dayNames[baseDate.getDay()]})`;
        }

        // Flight info for first/last day
        let flightInfo = undefined;
        let transport = '-';
        if (dayNum === 1 && depFlight) {
          flightInfo = {
            airline,
            flightNo: depFlight,
            departureCity: `${depCity}(${d.dpfcDprtArptCd || 'ICN'})`,
            departureTime: depTime,
            arrivalCity: `${arrCity}(${d.dpfcDestArptCd || ''})`,
            arrivalTime: arrTime,
          };
          transport = `${airline} ${depFlight} (${depCity} → ${arrCity})`;
        } else if (dayNum === daysCount && retFlight) {
          flightInfo = {
            airline: d.rthcArlnNm || airline,
            flightNo: retFlight,
            departureCity: `${retDepCity}(${d.rthcDprtArptCd || ''})`,
            departureTime: retDepTime,
            arrivalCity: `${retArrCity}(${d.rthcDestArptCd || 'ICN'})`,
            arrivalTime: retArrTime,
          };
          transport = `${d.rthcArlnNm || airline} ${retFlight} (${retDepCity} → ${retArrCity})`;
        }

        itinerary.push({
          day: dayNum,
          date: dayDate,
          title: '',
          flight: flightInfo,
          flightInfo: flightInfo,
          transport,
          description: descText,
          meals: { breakfast, lunch, dinner },
          hotel: hotelName,
          items: items.length > 0 ? items : [{ title: `${dayNum}일차 세부 일정`, description: descText || '상세 일정은 원본을 참고해주세요.', type: 'default' as const, image: '' }],
          timeline: items.length > 0 ? items : [{ title: `${dayNum}일차 세부 일정`, description: descText || '상세 일정은 원본을 참고해주세요.', type: 'default' as const, image: '' }],
        });
      }
    }

    itinerary.sort((a, b) => a.day - b.day);

    // ─── Hotels array ───
    const parsedHotels: any[] = [];
    const hotelSet = new Set<string>();

    if (scheduleRes?.lodgList) {
      for (const lodg of scheduleRes.lodgList) {
        const name = lodg.htlKrnm || '';
        if (name && !hotelSet.has(name)) {
          hotelSet.add(name);
          parsedHotels.push({
            name: `${name}${lodg.htlEngnm ? ` (${lodg.htlEngnm})` : ''}`,
            checkIn: '',
            checkOut: '',
            amenities: ['무선 인터넷', '24시간 데스크'],
            image: lodg.s3Url || '',
            description: lodg.htlDesc || '',
          });
        }
      }
    }

    if (parsedHotels.length === 0) {
      parsedHotels.push({ name: '상세 일정 참조', checkIn: depDate, checkOut: '', amenities: [] });
    }

    // Add schedule images to main images array
    if (scheduleRes?.imgList) {
      for (const img of scheduleRes.imgList) {
        if (img.s3Url && !images.includes(img.s3Url)) {
          images.push(img.s3Url);
        }
      }
    }

    // ─── Special terms from caution API ───
    let specialNotes = '';
    if (cautionRes?.needItemAndCaution) {
      const c = cautionRes.needItemAndCaution;
      const parts: string[] = [];
      if (c.pspVisaCntn) parts.push(c.pspVisaCntn);
      if (c.noteCntn) parts.push(c.noteCntn);
      specialNotes = parts.join('\n\n');
    }

    const targetUrl = url;

    console.log(`[HanjinTravel] Successfully parsed: "${title}" (${priceStr}) in ${Date.now() - start}ms`);

    const result: DetailedProductInfo = {
      title,
      destination,
      price: priceStr,
      departureDate: depDate,
      returnDate,
      duration,
      airline,
      departureFlightNumber: depFlight,
      returnFlightNumber: retFlight,
      departureTime: depTime,
      arrivalTime: arrTime,
      returnDepartureTime: retDepTime,
      returnArrivalTime: retArrTime,
      departureAirport: `${depCity}(ICN)`,
      hotel: parsedHotels.map(h => h.name).join(' / '),
      hotels: parsedHotels,
      url: targetUrl,
      images,
      keyPoints,
      inclusions: inclusions.length > 0 ? inclusions : ['▶ 왕복항공료', '▶ 숙박요금', '▶ 일정표상 관광지 입장료', '▶ 여행자 보험'],
      exclusions: exclusions.length > 0 ? exclusions : ['▶ 개인 경비 및 에티켓 팁'],
      cancellationPolicy: cancelTerms,
      specialTerms: cancelTerms + (specialNotes ? '\n\n' + specialNotes : ''),
      itinerary,
      features: [],
      courses: [],
      specialOffers: [],
      shoppingInfo: [],
      optionalTours: [],
      raw: {
        title,
        priceStr,
        depDateStr: depDate,
        inclusions,
        exclusions,
        specialTerms: cancelTerms,
        itineraryRaw: itinerary,
      }
    };

    return result;
  } catch (error) {
    console.error('[HanjinTravel] Error processing URL:', error);
    return null;
  }
}
