import type { Data } from './data'

const MINUS = '−'
export function pct(v: number, digits = 0): string {
  const k = Math.pow(10, digits)
  const n = Math.round(v * 100 * k) / k
  const sign = n > 0 ? '+' : n < 0 ? MINUS : ''
  return sign + Math.abs(n).toFixed(digits) + '%'
}
export const signed = (n: number) => (n > 0 ? '+' + n : n < 0 ? MINUS + Math.abs(n) : '0')
export const num = (n: number) => Math.round(n).toLocaleString('ko-KR')
export const dLabel = (d: number) => 'D+' + d
const WD = ['월', '화', '수', '목', '금', '토', '일']
export function dateLabel(data: Data, d: number): string {
  const i = data.days[d]
  return `${i.date.getMonth() + 1}월 ${i.date.getDate()}일 (${WD[i.dow]})`
}
export const hhmm = (sec: number) => `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`
