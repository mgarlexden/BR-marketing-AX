/* 손님 유형별 대표 매장 15곳(유형마다 3곳)과 대조 매장(가상) 20곳. 방문·반응 수치는 data.ts에서 합성한다. */
import type { StoreType } from './data'

export type License = '영업' | '인허가 없음' | '가상'
export interface Place {
  type: StoreType; name: string; gu: string
  /** 유형을 정한 기준 지역 (행정동 또는 상권) */
  dong: string
  direct: boolean; area: number | null; license: License
  /** 대표 매장이면 선출시 대상. 아니면 대조 매장(가상) */
  rep: boolean
}

const rep = (type: StoreType, name: string, gu: string, dong: string, direct: boolean, area: number | null, license: License = '영업'): Place => ({ type, name, gu, dong, direct, area, license, rep: true })
const ctrl = (type: StoreType, n: number): Place => ({ type, name: `${type} 일반 ${'ABCD'[n]}점`, gu: '-', dong: '대조 매장(가상)', direct: false, area: null, license: '가상', rep: false })

/** 유형마다 대표 3곳 → 대조 4곳 순서. data.ts가 이 순서(유형당 7곳)로 읽는다 */
export const PLACES: Place[] = [
  rep('2030', '서울대병원점', '종로구', '이화동', true, 40.5),
  rep('2030', '왕십리민자역사점', '성동구', '왕십리역', true, 35.5),
  rep('2030', '관악은천점', '관악구', '은천초등학교', false, 123),
  ...[0, 1, 2, 3].map((n) => ctrl('2030', n)),
  rep('4050 가족', '증미역점', '강서구', '염창동', false, 116),
  rep('4050 가족', '광나루역점', '광진구', '광장동', false, 115.3),
  rep('4050 가족', '위례중앙점', '송파구', '위례동', false, 114.8),
  ...[0, 1, 2, 3].map((n) => ctrl('4050 가족', n)),
  rep('관광·나들이', '대학로점', '종로구', '대학로', true, 270.6),
  rep('관광·나들이', '시청역점', '중구', '명동 관광특구', true, 124.3),
  rep('관광·나들이', '홍대상상마당점', '마포구', '홍대입구역', true, null, '인허가 없음'),
  ...[0, 1, 2, 3].map((n) => ctrl('관광·나들이', n)),
  rep('직장인', '여의도IFC몰점', '영등포구', '여의도역', true, 250),
  rep('직장인', '광화문점', '종로구', '종각역', true, 157.3),
  rep('직장인', '한남점', '용산구', '한남오거리', true, null, '인허가 없음'),
  ...[0, 1, 2, 3].map((n) => ctrl('직장인', n)),
  rep('혼합', '청량리역사점', '동대문구', '청량리역', true, null, '인허가 없음'),
  rep('혼합', '대림우성점', '영등포구', '대림역', false, 190),
  rep('혼합', '마포성산점', '마포구', '성산2동', false, 189.1),
  ...[0, 1, 2, 3].map((n) => ctrl('혼합', n)),
]

/** 유형별 후보 매장 수(서울). 대표 매장 평균을 전국 평균으로 바꿀 때 가중치로 쓴다. 전국 비중이 아니라 가정 */
export const TYPE_COUNT: Record<StoreType, number> = { '2030': 50, '4050 가족': 41, '관광·나들이': 7, '직장인': 55, '혼합': 131 }
