/* 배스킨라빈스 출시 이력. 트렌드 재료가 이미 배라에 있는 맛인지, 이달의 맛으로 얼마나 자주 나왔는지 본다.
 * 출처: baskinrobbins.co.kr 아이스크림 메뉴(/menu/list.php?category=A)와 이달의 맛 히스토리(/story/history.php), 2026-11-10 수집.
 * 히스토리 페이지에는 연도만 있고 월은 없어, 주기는 연 단위로 계산한다. */

export const BR_SOURCE = { menu: 'https://baskinrobbins.co.kr/menu/list.php?category=A', history: 'https://baskinrobbins.co.kr/story/history.php', collected: '2026-11-10' }
/** 이력을 세는 기준 연도 (데이터 기준일의 해) */
export const THIS_YEAR = 2026
/** 이달의 맛으로 한 번만 나온 재료는 이만큼 지나면 다시 낼 때가 됐다고 본다 (팀 가정) */
export const SINGLE_GAP = 3

/** 지금 매장에서 파는 아이스크림 35종과 해시태그 */
export const BR_MENU: { name: string; tags: string[] }[] = [
  { name: '잘 될거예엿', tags: ['누가', '카라멜 크런치 아몬드', '엿'] },
  { name: '레몬베리 코튼캔디', tags: ['딸기우유', '레몬샤베트'] },
  { name: '도우와줘요 호빵맨', tags: ['크림치즈', '모카번', '메이플시럽', '쿠키도우볼'] },
  { name: '루나 치즈 케이크', tags: ['치즈케이크', '초콜릿', '크래커'] },
  { name: '바나나 스플릿', tags: ['바나나', '딸기', '체리', '아몬드', '초코'] },
  { name: '아이엠, 샘', tags: ['마카다미아', '화이트무스'] },
  { name: '말차에 바나나', tags: ['말차'] },
  { name: '프랄린 앤 크림', tags: ['프랄린피칸', '카라멜'] },
  { name: '골드 메달 리본', tags: ['초콜릿', '카라멜시럽'] },
  { name: '팥있는 말차당', tags: ['말차', '당고', '팥'] },
  { name: '고무고무 블루베리 마카롱', tags: ['블루베리요거트'] },
  { name: '망고 탱고', tags: ['망고'] },
  { name: '우디의 후르츠 어드벤처', tags: ['우디'] },
  { name: '두바이에서 온 엄마는 외계인', tags: ['카다이프', '초콜릿쫀떡볼'] },
  { name: '레인보우 샤베트', tags: ['파인애플', '오렌지', '라즈베리'] },
  { name: '그린티', tags: ['녹차', '그린티'] },
  { name: '메롱 멜론', tags: ['멜론'] },
  { name: '애플민트', tags: ['그린애플'] },
  { name: '바 베 바', tags: ['바나나', '딸기', '바닐라'] },
  { name: '사랑에 빠진 딸기', tags: ['딸기', '치즈', '크런치초콜릿'] },
  { name: '엄마는 외계인', tags: ['초콜릿', '초코볼'] },
  { name: '민트 초콜릿 칩', tags: ['민트', '초콜릿'] },
  { name: '뉴욕 치즈케이크', tags: ['치즈케이크'] },
  { name: '체리쥬빌레', tags: ['체리'] },
  { name: '슈팅스타', tags: ['팝핑캔디', '체리'] },
  { name: '오레오 쿠키 앤 크림', tags: ['바닐라', '오레오'] },
  { name: '베리베리 스트로베리', tags: ['스트로베리'] },
  { name: '31요거트', tags: ['요거트'] },
  { name: '바람과 함께 사라지다', tags: ['블루베리', '스트로베리', '치즈케이크'] },
  { name: '피스타치오 아몬드', tags: ['피스타치오', '아몬드'] },
  { name: '초콜릿', tags: ['초콜릿'] },
  { name: '자모카 아몬드 훠지', tags: ['모카', '초콜릿'] },
  { name: '아몬드 봉봉', tags: ['아몬드', '초콜릿'] },
  { name: '바닐라', tags: ['바닐라'] },
]
export const MENU_NAMES = BR_MENU.map((m) => m.name)

/** 이달의 맛 히스토리. 한 해 안의 순서는 사이트에 보이는 순서 그대로 */
export const BR_MONTHLY: Record<number, string[]> = {
  2018: ['더블 바닐라 초콜릿', '트리플 치즈 러브', '츄파츕스 스트로베리 앤 크림', '아쿠르트 샤베트', '미니미니 미니언즈', '체리쥬빌레31', '핑크퐁 상어가족', '베리 스윗 바이올렛', '쫀떡궁합', '몬스터 마시멜로', '오레오 쿠키 앤 카라멜', '누가 크런치'],
  2019: ['꿀꿀허니', '허쉬 마카다미아 넛', '베리 그래놀라', '스트로베리 아보카도', '아이스 죠리퐁', '블랙 소르베', '핑크 스타', '심슨에 반하나', '쌀떡궁합', '아빠는 딸바봉', '오레오 쿠키 앤 크림치즈', '아이스 초코파이 정'],
  2020: ['우리끼리', '아이스 킷캣', '로투스 비스코프', '아이스 바나나킥', '판타스틱 트롤', '아몬드 봉봉봉', '펭수 아슈크림', '보라보라', '매시업스 시리얼', '미찐 감자', '아이스 호떡', '아이스 촉촉한 초코칩'],
  2021: ['우유속에 끼인 소보로 (우.낀.소)', '아이스 밀카 초콜릿', '아이스 허니버터 아몬드', '민트 초코 봉봉', '아이스 홈런볼', '오버더 레인보우 샤베트', '꿀바망', '아이스 꼬북칩', '찰떡콩떡', '치즈 고구마구마', '치즈나무숲', '아이스 고디바 초콜릿'],
  2022: ['기운 센 아이스 콘푸로스트', '아이스 로아커', '오레오 쿠키 앤 스트로베리', '사랑에 빠진 외계인', '피카피카 피카츄', '너로 정했다! 이브이', '마우나로아 마카다미아', '아이스 초당 옥수수', '내가 아인슈페너?!', '외계인의 바나나킥', '핑크스푼비긴즈', '아이스 허쉬 앤 리세스'],
  2023: ['벅스 버니버니 당근당근', '아이스 기가델리 초콜릿', '러브미', '딸기 연유 퐁당', '복숭아로 피치올려', '구름 속 시나모롤', '시카고 팝콘', '라이언 망고 마카롱', '아이스 노티드 우유 생크림', '초코 퐁당 쿠키런', '초코, 우리 이제 헤이즐넛', '나는 딸기치오', '도라에몽의 팥붕! 슈붕', '고디바 다크 크런치'],
  2024: ['황치즈 드래곤 볼', '바삭한 쫀꾸렛', '탕탕! 스트로베리', '아이스 도쿄바나나', '이상한 나라의 슈팅스타', '우주 라이크 봉봉', '블루 서퍼 비치', '피치PANG 망고PANG', '우석이도 외계인', '숭아야, 그릭다....', '치토스 밀크쉐이크 아이스크림', '키세스 브라우니 초콜릿'],
  2025: ['춘식이의 고구마얌!', '아이스 초코 도쿄바나나', '말랑 딸기 찹쌀떡', '아이스 그린티 킷캣', '봄날의 곰을 좋아하세요?', '카페오레 초코 크런치', '애망빙', '블루 바나나 브륄레', '위대한 비쵸비', '말차다미아', '솔티키 나 너 초코', '치즈가 브러우니?', '골든 프랄린 버터', '초콜릿 쿠키 스모어'],
  2026: ['베리 굿', '진정한 쫀꾸렛', '두바이에서 온 엄마는 외계인', '두바이 크런치 봉봉', '말랑 포도 메타몽', '우디의 후르츠어드벤처', '쵸파의 코튼캔디 크런치', '산딸기가 끌리는 연유', '도쿄바나나 크렘브륄레', '몬스터 크런치 쿠키'],
}

/** 재료나 IP가 메뉴 이름·해시태그에 어떤 말로 나오는지 (팀이 정한 같은 재료 표현). 없는 재료는 자기 이름만 찾는다 */
const ALIAS: Record<string, string[]> = {
  찹쌀모찌: ['모찌'],
  찹쌀떡: ['찹쌀떡', '쫀떡', '쌀떡', '찰떡'],
  잔기지떡: ['잔기지'],
  생초콜릿: ['생초콜릿', '생초코'],
  진저브레드: ['진저'],
  '생강 쿠키': ['생강'],
  타이야끼: ['타이야끼', '붕어빵', '팥붕', '슈붕'],
  초코붕어빵: ['붕어빵', '팥붕', '슈붕'],
  미니붕어빵: ['붕어빵', '팥붕', '슈붕'],
  딸기: ['딸기', '스트로베리', '딸바'],
  복숭아: ['복숭아', '피치', '숭아'],
  애플망고: ['망고', '애망'],
  포켓몬스터: ['포켓몬', '피카츄', '이브이', '메타몽'],
  원피스: ['원피스', '쵸파'],
  '짱구는 못말려': ['짱구'],
}
const norm = (s: string) => s.replace(/\s/g, '')
const words = (kw: string) => (ALIAS[kw] ?? [kw]).map(norm)

export type BrStatus = 'new' | 'onMenu' | 'recent' | 'due'
export interface BrRecord {
  kw: string
  status: BrStatus
  /** 지금 파는 메뉴 중 같은 재료가 들어간 것 */
  menu: string[]
  /** 이달의 맛으로 나온 기록 (오래된 순) */
  launches: { year: number; name: string }[]
  /** 출시 사이 평균 간격 (년). 한 번만 나왔으면 SINGLE_GAP 가정 */
  gap: number | null
  last: number | null
}

/** 상시 메뉴에 있으면 뺀다. 이달의 맛으로 나왔으면 평균 주기만큼 지났을 때만 남긴다(재출시 주기). 처음 보는 재료는 그대로 */
export function brRecord(kw: string): BrRecord {
  const w = words(kw)
  const hit = (s: string) => w.some((x) => norm(s).includes(x))
  const menu = BR_MENU.filter((m) => hit(m.name) || m.tags.some(hit)).map((m) => m.name)
  const launches = Object.entries(BR_MONTHLY).flatMap(([y, names]) => names.filter(hit).map((name) => ({ year: Number(y), name })))
  const years = launches.map((l) => l.year)
  const last = years.length ? Math.max(...years) : null
  const gap = !years.length ? null : years.length === 1 ? SINGLE_GAP : Math.max(1, Math.round((last! - Math.min(...years)) / (years.length - 1)))
  const status: BrStatus = menu.length ? 'onMenu' : last === null ? 'new' : THIS_YEAR - last >= gap! ? 'due' : 'recent'
  return { kw, status, menu, launches, gap, last }
}

export const brKept = (r: BrRecord) => r.status === 'new' || r.status === 'due'

/** 화면에 쓰는 한 줄 설명 */
export function brLine(r: BrRecord): string {
  const list = r.launches.map((l) => l.year).join(', ')
  if (r.status === 'onMenu') return `지금 파는 ${r.menu.slice(0, 2).join(', ')}${r.menu.length > 2 ? ` 외 ${r.menu.length - 2}개` : ''}에 들어 있어 뺐어요`
  if (r.status === 'recent') return `이달의 맛으로 ${r.launches.length}번(${list}) 나왔고 마지막이 ${r.last}년이라, ${r.gap}년 주기가 아직 안 돌아와 뺐어요`
  if (r.status === 'due') return `이달의 맛으로 ${r.launches.length}번(${list}) 나왔어요, ${r.gap}년 주기${r.launches.length === 1 ? '(한 번만 나와 3년으로 가정)' : ''}가 돌아와 다시 낼 수 있어요`
  return '이달의 맛으로 나온 적 없는 재료예요'
}
