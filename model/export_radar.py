"""트렌드 레이더 데이터 내보내기 (2차)

네이버 검색량으로 '지금 급등한 키워드가 13주 뒤(이달의 맛 출시 시점)에도 수요가 남을까'를 예측하고
앱 화면이 읽는 src/lib/trend-data.ts 를 만든다.

1차와 달라진 점
- 키워드: 79개 -> 위키백과 디저트, 해외 바이럴, 연관 검색어까지 약 600개 (뜬 적 없는 디저트도 포함)
- 급등: 1.5배 규칙 + 평소 흔들림의 3배 이상 (검색광고 API 실제 월간 검색 수로 환산해서 잼)
- 버팀 정답: 급등으로 늘어난 부분의 50% 이상이 13주 뒤(12~14주 3주 평균)에도 남아야 버팀
- 힌트: 검색 곡선 8개 + 검색 규모 2개 + 30세 이상 검색 3개 (데이터랩 연령별)
- 성능: 처음 보는 키워드 + 미래로 시험 (키워드 5묶음, 2024/2025 기준 시점, 묶음 5번 반복)
- 주의: 평소 20대가 주로 찾던 디저트에 30세 이상 검색이 갑자기 늘어난 급등

실행: python model/export_radar.py   (레포 최상위 폴더에서, 5분 정도)
필요: pandas, numpy, scipy, scikit-learn
"""
import json
import os
import warnings

import numpy as np
import pandas as pd
from scipy.optimize import nnls
from sklearn.cluster import KMeans
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings('ignore')
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
OUT = os.path.join(HERE, '..', 'src', 'lib', 'trend-data.ts')
H = 13            # BR 리드타임 (주)
Z = 3             # 급등 인정: 평소 흔들림의 몇 배 이상 올랐나
KEEP = 0.5        # 버팀: 늘어난 부분 중 몇 %가 13주 뒤에 남아야 하나
RECENT = 26       # 최근 몇 주 안의 급등을 보여줄지
MIN_WEEKLY = 1000  # 이달의 맛 후보가 되려면 감지 주 실제 검색 수가 주 몇 회 이상이어야 하는지 (검색광고 API로 환산)
SHOW_WEEKS = 156  # 상세 그래프에 넣을 기간 (3년)
CUTOFFS = ['2024-01-01', '2025-01-01']  # 미래 시험 기준 시점
REPEAT = 5        # 키워드 묶음 나누기 반복 횟수
SAME = {'카다이프': '까타이프', '카늘레': '카눌레', '밀푀유': '나폴레옹'}  # 같은 디저트는 같은 묶음으로


def read(fn):
    return pd.read_csv(os.path.join(DATA, fn), encoding='utf-8-sig')


# 1. 데이터
old = []
for fn in ['datalab_weekly.csv', 'datalab_ingredients_weekly.csv', 'datalab_br_ingredients_weekly.csv']:
    d = read(fn); d.columns = ['kw', 'date', 'v']; old.append(d)
df = pd.concat(old); df['date'] = pd.to_datetime(df['date']); df = df.drop_duplicates(['kw', 'date'])
grid = pd.date_range(df.date.min(), df.date.max(), freq='W-MON')
n = len(grid)
W = df.pivot_table(index='date', columns='kw', values='v').reindex(grid).fillna(0)
ser = {k: ('기존', W[k].values) for k in W.columns}
related = read('related_keywords.csv'); related.columns = ['kw', 'kind', 'cnt']
for fn, grp in [('datalab_wiki_weekly.csv.gz', '위키'), ('datalab_overseas_weekly.csv.gz', '해외'), ('datalab_related_weekly.csv.gz', '연관')]:
    d = read(fn); d.columns = ['k', 'kind', 'cat', 'w', 'v']; d = d.dropna(subset=['w']); d['w'] = pd.to_datetime(d.w)
    for k, x in d.groupby('k'):
        if k not in ser and (grp != '연관' or k in set(related.kw)):
            ser[k] = (grp, x.set_index('w')['v'].reindex(grid).fillna(0).values)
m = read('searchad_monthly.csv'); m.columns = ['k', 'src', 'cnt', 'small', 'q', 'miss']
cnt = m.set_index('k')['cnt']
cnt = pd.concat([cnt, related.set_index('kw')['cnt'].loc[lambda s: ~s.index.isin(cnt.index)]])
A = read('datalab_age_weekly.csv.gz'); A.columns = ['k', 'age', 'w', 'v']
A = A.dropna(subset=['w']); A['w'] = pd.to_datetime(A.w)
AGE = {(k, a): x.set_index('w')['v'].reindex(grid).fillna(0).values for (k, a), x in A.groupby(['k', 'age'])}


# 2. 특징, 급등 감지, 규칙 유형 (1차와 같음)
def features(v, t):
    vt = v[t]
    k = 0
    while t - k - 1 >= 0 and v[t - k - 1] >= 0.25 * vt:
        k += 1
    prev_year = v[t-104:t-52].mean() if t >= 104 else v[:t-52].mean()
    return dict(
        rise4=np.log(vt / max(v[t-4:t].mean(), 0.5)),
        rise13=np.log(vt / max(v[t-13:t-9].mean(), 0.5)),
        rise_weeks=k,
        pos_runmax=vt / v[:t+1].max(),
        base52=v[t-52:t].mean() / vt,
        lastyear=np.log(max(v[t-56:t-47].max(), 0.5) / max(prev_year, 0.5)),
        vol8=np.std(np.diff(np.log(v[t-8:t+1] + 1))),
        age=t - np.argmax(v > 1) if (v > 1).any() else 0,
    )


def age_features(kw, t):
    """30세 이상 검색 곡선의 급등 주까지 모양 (그룹마다 최고 주 = 100이라 크기가 아니라 오른 정도만)"""
    o, y = AGE.get((kw, '30세 이상')), AGE.get((kw, '13~29세'))
    if o is None or y is None:
        return None
    ot, yt = max(o[t], 0.5), max(y[t], 0.5)
    old_rise4 = np.log(ot / max(o[t-4:t].mean(), 0.5))
    return dict(old_rise4=old_rise4, old_base52=o[t-52:t].mean() / ot, old_runmax=ot / max(o[:t+1].max(), 0.5),
                spread=old_rise4 - np.log(yt / max(y[t-4:t].mean(), 0.5)))


def is_surge(v, t):
    return v[t] >= 5 and v[t] >= 1.5 * max(v[t-12:t].mean(), 0.5)


def rule_type(v):
    s = pd.Series(v, index=grid)
    ratio = (s / s.rolling(52, min_periods=26).mean().replace(0, np.nan)).dropna()
    ac = ratio.autocorr(52) if len(ratio) > 110 else 0
    yr = s[(s.index.year >= 2016) & (s.index.year <= 2025)]
    pm = yr.groupby(yr.index.year).idxmax().dt.month
    mode = int(pm.mode().iloc[0])
    same = (np.minimum((pm - mode) % 12, (mode - pm) % 12) <= 1).mean()
    p = int(np.argmax(v))
    k = 0
    while p - k - 1 >= 0 and v[p - k - 1] >= 0.25 * v[p]:
        k += 1
    if ac >= 0.5 and same >= 0.8:
        return '반복형', ac, same, mode, k
    return ('단발형' if k <= 5 else '완만형' if k >= 10 else '보류'), ac, same, mode, k


FEATS = ['rise4', 'rise13', 'rise_weeks', 'pos_runmax', 'base52', 'lastyear', 'vol8', 'age']
SCALE = ['log_base', 'log_jump']
OLD = ['old_rise4', 'old_base52', 'old_runmax']
COLS = FEATS + SCALE + OLD

# 3. 품질 필터 + 실제 검색 수로 환산 (최근 4주 = 최근 한 달 실제 검색 수)
use, dropped = {}, {'검색수없음': 0, '최근4주0': 0, '2년미만': 0, '0주20%초과': 0}
for k, (grp, v) in ser.items():
    if k not in cnt.index or pd.isna(cnt[k]): dropped['검색수없음'] += 1; continue
    if v[-4:].mean() <= 0: dropped['최근4주0'] += 1; continue
    if (v > 0).sum() < 104: dropped['2년미만'] += 1; continue
    f = np.argmax(v > 0)
    if (v[f:] == 0).mean() > 0.2: dropped['0주20%초과'] += 1; continue
    c = v * (float(cnt[k]) / 4.33) / v[-4:].mean()
    use[k] = (grp, v, c)
print('품질 필터에서 빠짐:', dropped, '/ 사용 키워드', len(use))

# 평소 흔들림: 급등이 없는 구간에서 직전 12주 평균에서 벗어나는 폭을 검색 규모별로 재서 곡선으로 맞춤
rows = []
for k, (grp, v, c) in use.items():
    s, last = [], -99
    for t in range(60, n - H):
        if is_surge(v, t) and t - last >= 8: s.append(t); last = t
    near = set()
    for t in s: near.update(range(t - 4, t + 13))
    for t in range(60, n):
        if t in near: continue
        b = c[t-12:t].mean()
        if b > 0: rows.append((b, c[t] - b))
R = pd.DataFrame(rows, columns=['b', 'e'])
R['bin'] = pd.cut(np.log10(R.b), np.arange(-1, 6.01, 0.25))
tab = R.groupby('bin', observed=True).agg(cnt=('e', 'size'), b=('b', 'median'),
                                          sd=('e', lambda e: 1.4826 * np.median(np.abs(e - np.median(e)))))
tab = tab[tab.cnt >= 200]
P, LOGA = np.polyfit(np.log(tab.b), np.log(tab.sd), 1)
sd = lambda b: np.exp(LOGA) * np.maximum(b, 0.5) ** P
print(f'평소 흔들림 = {np.exp(LOGA):.2f} x 평소^{P:.2f}')

# 4. 키워드 정보: 유형, 30세 이상 검색 비중 (전체 곡선 = a x 13~29세 + b x 30세 이상 으로 맞춰서 추정)
info = {}
for k, (grp, v, c) in use.items():
    typ, ac, same, mode, kk = rule_type(v)
    share = None
    if (k, '30세 이상') in AGE:
        y, o = AGE[(k, '13~29세')], AGE[(k, '30세 이상')]
        msk = (v > 0) | (y > 0) | (o > 0)
        coef, _ = nnls(np.c_[y[msk], o[msk]], v[msk])
        tot = coef[0] * y[msk].sum() + coef[1] * o[msk].sum()
        share = float(coef[1] * o[msk].sum() / tot) if tot > 0 else None
    info[k] = dict(type=typ, ac=ac, same=same, peakMonth=mode, grp=grp, share=share)

# 5. 학습 데이터: 급등 감지 순간 (키워드마다 8주 간격, 흔들림 3배 이상만)
rows = []
for k, (grp, v, c) in use.items():
    last = -99
    for t in range(60, n - H - 1):
        if not is_surge(v, t) or t - last < 8: continue
        last = t
        b = max(c[t-12:t].mean(), 0.5)
        if (c[t] - b) < Z * sd(b): continue
        af = age_features(k, t)
        if af is None: continue
        after = c[t+H-1:t+H+2].mean()
        r = features(v, t); r.update(af)
        r.update(kw=k, typ=info[k]['type'], date=grid[t], log_base=np.log10(b), log_jump=np.log10(max(c[t] - b, 1)),
                 y=int((after - b) / (c[t] - b) >= KEEP))
        rows.append(r)
S = pd.DataFrame(rows)
S['grp_kw'] = S.kw.replace(SAME)
N = S[S.typ != '반복형']
print(f'급등 {len(S)}건 (새 트렌드 {len(N)}건), 버틴 비율 {S.y.mean():.3f} / 새 트렌드 {N.y.mean():.3f}')

# 주의 기준: 30세 이상이 20대보다 더 오른 정도가 상위 25%
RUSH = float(S.spread.quantile(0.75))


def rf():
    return RandomForestClassifier(400, min_samples_leaf=5, class_weight='balanced', random_state=0, n_jobs=-1)


CANDIDATES = {
    '랜덤 포레스트 (+30세 이상 힌트)': (rf, COLS),
    '랜덤 포레스트 (검색 곡선만)': (rf, FEATS + SCALE),
    '그래디언트 부스팅': (lambda: HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=200,
                                                           class_weight='balanced', random_state=0), COLS),
    '로지스틱 회귀': (lambda: make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, class_weight='balanced')), COLS),
}


# 6. 검증: 처음 보는 키워드 + 미래. 키워드 5묶음 중 4묶음의 '기준 시점 전에 결과가 확정된' 급등으로 학습,
#    남은 1묶음의 '기준 시점 이후' 급등으로 시험. 새 트렌드(반복형 제외)만. 묶음 나누기 REPEAT번 평균
def evaluate(D, make, cols):
    bal, auc, h1, h0 = [], [], [], []
    for seed in range(REPEAT):
        kws = np.array(sorted(D.grp_kw.unique())); rng = np.random.default_rng(seed); rng.shuffle(kws)
        fold = D.grp_kw.map({k: i % 5 for i, k in enumerate(kws)})
        for cutd in CUTOFFS:
            c = pd.Timestamp(cutd); Pp, Yy, ba = [], [], []
            for f in range(5):
                tr = D[(fold != f) & ((D.date + pd.Timedelta(weeks=H + 1)) < c)]
                te = D[(fold == f) & (D.date >= c)]
                pr = make().fit(tr[cols], tr.y).predict_proba(te[cols])[:, 1]
                Pp += list(pr); Yy += list(te.y); ba.append(balanced_accuracy_score(te.y, pr >= 0.5))
            Pp, Yy = np.array(Pp), np.array(Yy)
            bal.append(np.mean(ba)); auc.append(roc_auc_score(Yy, Pp))
            h1.append(((Pp >= 0.5) & (Yy == 1)).sum() / max((Yy == 1).sum(), 1))
            h0.append(((Pp < 0.5) & (Yy == 0)).sum() / max((Yy == 0).sum(), 1))
    return dict(bal=float(np.mean(bal)), bal_sd=float(np.std(bal)), auc=float(np.mean(auc)),
                hit_survive=float(np.mean(h1)), hit_fail=float(np.mean(h0)))


model_scores = []
for name, (make, cols) in CANDIDATES.items():
    r = evaluate(N, make, cols)
    model_scores.append(dict(name=name, bal=round(r['bal'], 3), auc=round(r['auc'], 3), used=name.endswith('힌트)'),
                             hit_survive=round(r['hit_survive'], 3), hit_fail=round(r['hit_fail'], 3)))
    print(name, {k: round(v, 3) for k, v in r.items()}, flush=True)
main = model_scores[0]
rule_bal = np.mean([balanced_accuracy_score(N[N.date >= pd.Timestamp(c)].y, (N[N.date >= pd.Timestamp(c)].rise_weeks > 5).astype(int))
                    for c in CUTOFFS])
yk = N[N.kw.map(lambda k: (info[k]['share'] or 1) < 0.5)]
scores = dict(
    samples=int(len(N)), keywords=len(use), survive_rate=round(float(N.y.mean()), 3),
    model_bal=main['bal'], model_auc=main['auc'], rule_bal=round(float(rule_bal), 3),
    hit_survive=main['hit_survive'], hit_fail=main['hit_fail'], repeat=REPEAT,
    warn_rate=round(float(yk[yk.spread >= RUSH].y.mean()), 3), warn_n=int((yk.spread >= RUSH).sum()),
    models=model_scores,
)
final = rf().fit(S[COLS], S.y)
backup = rf().fit(S[FEATS + SCALE], S.y)   # 연령 데이터가 없는 키워드용

# 7. 곡선 모양 군집 (비지도)
keys = list(use)
vecs = []
for k in keys:
    v = use[k][1]; pk = int(np.argmax(v))
    shape = np.array([v[i] if 0 <= i < n else 0 for i in range(pk - 26, pk + 53)]) / v[pk]
    vecs.append(np.r_[shape, info[k]['ac'] * 2, info[k]['same'] * 2])
V = np.array(vecs)
km = KMeans(4, n_init=20, random_state=0).fit(V)
clusters = []
for ci in range(4):
    members = [k for k, l in zip(keys, km.labels_) if l == ci]
    types = pd.Series([info[k]['type'] for k in members]).value_counts()
    clusters.append(dict(id=ci, size=len(members), main=types.index[0], match=int(types.iloc[0]),
                         members=members, curve=[round(float(x), 3) for x in V[km.labels_ == ci, :79].mean(0)]))
scores['cluster_match'] = round(sum(c['match'] for c in clusters) / len(keys), 2)


# 8. 최근 급등 키워드 예측과 BR 제안
def suggest(typ, prob, peak_month, weekly, warn):
    if typ == '반복형':
        return '시즌', f'매년 {peak_month}월 전후에 돌아오는 재료. 내년 {peak_month}월 출시에 맞춰 시즌 한정으로 준비'
    if warn:
        return '단기', ('30세 이상 검색이 갑자기 늘어난 급등. 평소엔 20대가 주로 찾던 디저트라, '
                      f'과거 비슷한 급등은 {scores["warn_rate"] * 100:.0f}%만 13주를 버팀. 팝업, SNS 콘텐츠로 짧게 대응')
    if prob >= 0.6 and weekly < MIN_WEEKLY:
        return '관찰', f'오래 가겠지만 규모가 작음 (주 {weekly:,}회 검색). 이달의 맛으로 내기엔 수요가 부족해서 더 커지는지 지켜보기'
    if prob >= 0.6:
        return '후보', '13주 뒤 출시 시점에도 수요가 남을 가능성이 높음. 이달의 맛 후보로 검토'
    if prob >= 0.4:
        return '관찰', f'13주 뒤 살아남을 확률이 반반({prob * 100:.0f}%)이라 아직 판단하기 이름. 4주 더 지켜본 뒤 다시 판정'
    return '단기', '이달의 맛으로는 늦을 가능성이 높음. 팝업, SNS 콘텐츠로 짧게 대응'


items = []
start = max(0, n - SHOW_WEEKS)
for k, (grp, v, c) in use.items():
    hits = []
    for t in range(n - RECENT, n):
        b = max(c[t-12:t].mean(), 0.5)
        if is_surge(v, t) and (c[t] - b) >= Z * sd(b): hits.append(t)
    if not hits: continue
    t = hits[-1]
    f = features(v, t)
    b = max(c[t-12:t].mean(), 0.5)
    f.update(log_base=np.log10(b), log_jump=np.log10(max(c[t] - b, 1)))
    af = age_features(k, t)
    if af is not None:
        f.update(af); prob = float(final.predict_proba(pd.DataFrame([f])[COLS])[0, 1])
    else:
        prob = float(backup.predict_proba(pd.DataFrame([f])[FEATS + SCALE])[0, 1])
    prob = round(prob, 2)   # 화면에 보이는 숫자로 판정
    share = info[k]['share']
    warn = bool(af is not None and share is not None and share < 0.5 and af['spread'] >= RUSH)
    actual = None if t + H + 1 >= n else bool((c[t+H-1:t+H+2].mean() - b) / (c[t] - b) >= KEEP)
    typ = info[k]['type']
    size = float(v[t])  # 데이터랩 값은 키워드별 역대 최고 = 100 이라 그대로 %
    action, text = suggest(typ, prob, info[k]['peakMonth'], int(round(c[t])), warn)
    items.append(dict(
        kw=k, type=typ, prob=round(prob, 2), action=action, suggestion=text, size=round(size),
        detected=grid[t].strftime('%Y-%m-%d'), detectedIdx=t - start, actual=actual,
        steady=int(f['rise_weeks']), base=round(float(f['base52']), 2), jump=round(float(np.exp(f['rise4'])), 1),
        weekly=int(round(c[t])), usual=int(round(b)),
        oldShare=None if share is None else round(share, 2), warn=warn,
        series=[round(float(x), 1) for x in v[start:]],
    ))
items.sort(key=lambda r: -r['prob'])
meta = dict(
    minWeekly=MIN_WEEKLY, first=grid[0].strftime('%Y-%m-%d'), last=grid[-1].strftime('%Y-%m-%d'),
    seriesStart=grid[start].strftime('%Y-%m-%d'), weeks=int(n), horizon=H, recent=RECENT, z=Z, keep=KEEP,
)

body = (
    '// 자동 생성 파일입니다. 직접 고치지 말고 model/export_radar.py 를 다시 실행하세요.\n'
    '// 출처: 네이버 데이터랩 주간 검색량 (키워드별 최고 주 = 100), 연령별 검색량, 검색광고 API 월간 검색 수\n'
    'import type { RadarData } from \'./trend\'\n\n'
    f'export const RADAR: RadarData = {json.dumps(dict(meta=meta, scores=scores, items=items, clusters=clusters), ensure_ascii=False)}\n'
)
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write(body)
print('저장:', os.path.relpath(OUT), f'{os.path.getsize(OUT) / 1024:.0f}KB')
print('성능:', {k: v for k, v in scores.items() if k != 'models'})
print('최근 급등:', len(items), '개, 주의', sum(i['warn'] for i in items), '개')
