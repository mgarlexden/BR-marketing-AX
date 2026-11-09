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
- 모델 (2주차 최종, 검증결과 23번): 레이더 힌트 + Chronos-2 예측 힌트 3개 + Chronos-2 선형 탐침 확률 1개를 랜덤 포레스트로 합침 (스태킹)
  Chronos-2 값은 Hugging Face에 접속되는 컴퓨터에서 미리 계산해 data/chronos2_*.npz 로 넣어 둠
  (학습용: radar_v2/step22_chronos_more.py + step23_c2_embed.py, 화면용 최근 급등: radar_v2/step25_chronos_live.py)
  두 파일이 없으면 Chronos 없이 지난 레이더 모델로 만든다

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
from sklearn.decomposition import PCA
from sklearn.metrics import balanced_accuracy_score, roc_auc_score
from sklearn.model_selection import GroupKFold
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
MIN_SIZE = 20     # 1차 규모 기준. 결정 탭(decide.tsx)이 읽어서 남겨 둠, 레이더 판정에는 안 씀
MIN_WEEKLY = 1000  # 이달의 맛 후보가 되려면 감지 주 실제 검색 수가 주 몇 회 이상이어야 하는지 (검색광고 API로 환산)
SHOW_WEEKS = 156  # 상세 그래프에 넣을 기간 (3년)
CUTOFFS = ['2024-01-01', '2025-01-01']  # 미래 시험 기준 시점
REPEAT = 5        # 키워드 묶음 나누기 반복 횟수
SAME = {'카다이프': '까타이프', '카늘레': '카눌레', '밀푀유': '나폴레옹'}  # 같은 디저트는 같은 묶음으로
EXCLUDE = {'소한'}  # 디저트 이름이지만 검색은 대부분 다른 뜻 (소한: 1월 절기)


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
WIKI_BRAND = set()   # 위키백과 목록에서 '상표'로 분류한 것 (고디바, 페레로 로쉐 등)
related = read('related_keywords.csv'); related.columns = ['kw', 'kind', 'cnt']
for fn, grp in [('datalab_wiki_weekly.csv.gz', '위키'), ('datalab_overseas_weekly.csv.gz', '해외'), ('datalab_related_weekly.csv.gz', '연관')]:
    d = read(fn); d.columns = ['k', 'kind', 'cat', 'w', 'v']; d = d.dropna(subset=['w']); d['w'] = pd.to_datetime(d.w)
    WIKI_BRAND.update(d[d.kind == '상표'].k.unique())
    for k, x in d.groupby('k'):
        if k not in ser and k not in EXCLUDE and (grp != '연관' or k in set(related.kw)):
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
        r.update(kw=k, t=t, typ=info[k]['type'], date=grid[t], log_base=np.log10(b), log_jump=np.log10(max(c[t] - b, 1)),
                 y=int((after - b) / (c[t] - b) >= KEEP))
        rows.append(r)
S = pd.DataFrame(rows)
S['grp_kw'] = S.kw.replace(SAME)

# Chronos-2 값 붙이기: 13주 뒤(12~14주 평균) 예측을 '늘어난 부분 중 남는 비율'로 바꾼 3칸 + 요약 벡터 1536칸(예측 칸 768 + 요약 칸 768)
CHR = ['c2_keep10', 'c2_keep50', 'c2_keep90']
TRAIN_C2, LIVE_C2 = os.path.join(DATA, 'chronos2_train.npz'), os.path.join(DATA, 'chronos2_live.npz')
CHRONOS = os.path.exists(TRAIN_C2) and os.path.exists(LIVE_C2)


def load_c2(path):
    z = np.load(path)
    return {(k, int(t)): (q, e) for k, t, q, e in zip(z['kw'], z['t'], z['q'], z['emb'])}, z['emb'].shape[1]


def add_c2(D, c2):
    """D의 (kw, t)마다 Chronos-2 힌트 3칸 + 요약 벡터를 붙임. 값이 없는 행은 NaN"""
    b, jump = 10 ** D.log_base.values, 10 ** D.log_jump.values
    Q = np.full((len(D), 3), np.nan); E = np.full((len(D), ED), np.nan, dtype=np.float32)
    for i, key in enumerate(zip(D.kw, D.t)):
        if key in c2: Q[i], E[i] = c2[key]
    D = D.copy()
    for j, c in enumerate(CHR): D[c] = (Q[:, j] - b) / jump
    return pd.concat([D.reset_index(drop=True), pd.DataFrame(E, columns=ECOLS)], axis=1)


if CHRONOS:
    C2_TRAIN, ED = load_c2(TRAIN_C2); C2_LIVE, _ = load_c2(LIVE_C2)
    ECOLS = [f'e{i}' for i in range(ED)]
    S = add_c2(S, C2_TRAIN)
    print(f'Chronos-2 값 붙음: 학습 {S[CHR[0]].notna().sum()}/{len(S)}건, 화면용 {len(C2_LIVE)}건')
    S = S.dropna(subset=CHR).reset_index(drop=True)
else:
    print('Chronos-2 파일 없음: 지난 레이더 모델로 만듦')
N = S[S.typ != '반복형']
print(f'급등 {len(S)}건 (새 트렌드 {len(N)}건), 버틴 비율 {S.y.mean():.3f} / 새 트렌드 {N.y.mean():.3f}')

# 주의 기준: 30세 이상이 20대보다 더 오른 정도가 상위 25%
RUSH = float(S.spread.quantile(0.75))


def rf():
    return RandomForestClassifier(400, min_samples_leaf=5, class_weight='balanced', random_state=0, n_jobs=-1)


def probe():
    """선형 탐침: Chronos-2 요약 벡터를 표준화 -> 32칸으로 줄임 -> 로지스틱 회귀 (Chronos-2 몸통은 그대로)"""
    return make_pipeline(StandardScaler(), PCA(32, random_state=0), LogisticRegression(C=0.1, class_weight='balanced', max_iter=2000))


class Probe:
    """요약 벡터만 보는 선형 탐침 (비교용)"""
    def fit(self, X, y):
        self.p = probe().fit(X[ECOLS].values, y); return self

    def predict_proba(self, X):
        return self.p.predict_proba(X[ECOLS].values)


class Stack:
    """스태킹: 레이더 힌트 + Chronos-2 힌트 + '탐침이 본 버틸 확률' 1칸으로 랜덤 포레스트.
    학습 때 탐침 확률은 학습 데이터 안에서 3묶음(키워드 단위)으로 나눠 '안 본 키워드'에 대해 낸 값을 씀 (답이 새지 않게)"""
    def __init__(self, cols):
        self.cols = cols

    def fit(self, X, y):
        E, g = X[ECOLS].values, X.grp_kw.values
        oof = np.zeros(len(X))
        for a, b in GroupKFold(3).split(E, y, g):
            oof[b] = probe().fit(E[a], y.iloc[a]).predict_proba(E[b])[:, 1]
        self.p = probe().fit(E, y)
        self.rf = rf().fit(np.c_[X[self.cols].values, oof], y)
        return self

    def probe_p(self, X):
        return self.p.predict_proba(X[ECOLS].values)[:, 1]

    def predict_proba(self, X):
        return self.rf.predict_proba(np.c_[X[self.cols].values, self.probe_p(X)])


if CHRONOS:
    ALL = COLS + CHR + ECOLS + ['grp_kw']
    CANDIDATES = {
        '레이더 + Chronos-2 (스태킹)': (lambda: Stack(COLS + CHR), ALL),
        '레이더 + Chronos-2 예측 힌트': (rf, COLS + CHR),
        'Chronos-2 선형 탐침만': (Probe, ALL),
        '지난 레이더 (Chronos 없이)': (rf, COLS),
    }
else:
    CANDIDATES = {
        '랜덤 포레스트 (+30세 이상 힌트)': (rf, COLS),
        '랜덤 포레스트 (검색 곡선만)': (rf, FEATS + SCALE),
        '그래디언트 부스팅': (lambda: HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=200,
                                                               class_weight='balanced', random_state=0), COLS),
        '로지스틱 회귀': (lambda: make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, class_weight='balanced')), COLS),
    }
USED = next(iter(CANDIDATES))


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
    model_scores.append(dict(name=name, bal=round(r['bal'], 3), auc=round(r['auc'], 3), used=name == USED,
                             hit_survive=round(r['hit_survive'], 3), hit_fail=round(r['hit_fail'], 3)))
    print(name, {k: round(v, 3) for k, v in r.items()}, flush=True)
main = model_scores[0]
# 반복형까지 포함한 전체 급등 정확도 (화면 맨 위 숫자). 반복형은 매년 돌아와서 맞히기 쉬우므로 새 트렌드 숫자와 같이 보여 줌
ra = evaluate(S, *CANDIDATES[USED])
print('반복형 포함', {k: round(v, 3) for k, v in ra.items()}, flush=True)
rule_bal = np.mean([balanced_accuracy_score(N[N.date >= pd.Timestamp(c)].y, (N[N.date >= pd.Timestamp(c)].rise_weeks > 5).astype(int))
                    for c in CUTOFFS])
yk = N[N.kw.map(lambda k: (info[k]['share'] or 1) < 0.5)]
scores = dict(
    samples=int(len(N)), keywords=len(use), survive_rate=round(float(N.y.mean()), 3),
    model_bal=main['bal'], model_auc=main['auc'], rule_bal=round(float(rule_bal), 3),
    hit_survive=main['hit_survive'], hit_fail=main['hit_fail'], repeat=REPEAT,
    warn_rate=round(float(yk[yk.spread >= RUSH].y.mean()), 3), warn_n=int((yk.spread >= RUSH).sum()),
    models=model_scores, chronos=CHRONOS,
    all_samples=int(len(S)), all_bal=round(ra['bal'], 3), all_auc=round(ra['auc'], 3),
    all_hit_survive=round(ra['hit_survive'], 3), all_hit_fail=round(ra['hit_fail'], 3),
)
final = rf().fit(S[COLS], S.y)                  # Chronos 값이 없는 급등용
if CHRONOS:
    final_c = Stack(COLS + CHR).fit(S[ALL], S.y)
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
BRAND = set(related[related.kind == '상표'].kw) | WIKI_BRAND   # 기존 상품 이름 (오리온초코파이, 고디바 등)


def suggest(typ, prob, peak_month, weekly, warn, brand=False):
    if typ == '반복형':
        return '시즌', f'매년 {peak_month}월 전후에 돌아오는 재료예요. 내년 {peak_month}월 출시에 맞춰 시즌 한정으로 준비해요.'
    if warn:
        return '단기', '이달의 맛으로 내기엔 늦을 가능성이 높아요. 팝업이나 SNS 콘텐츠로 짧게 대응해요.'
    if prob >= 0.6 and weekly < MIN_WEEKLY:
        return '관찰', f'오래 가겠지만 규모가 작아요(주 {weekly:,}회 검색). 이달의 맛으로 내기엔 수요가 부족해서 더 커지는지 지켜봐요.'
    if prob >= 0.6 and brand:
        return '관찰', '오래 갈 가능성이 높지만 이미 있는 제품이에요. 이달의 맛보다는 콜라보로 검토해요.'
    if prob >= 0.6:
        return '후보', '13주 뒤 출시 시점에도 수요가 남을 가능성이 높아요. 실제 판매처, SNS 반응을 직접 확인하고 이달의 맛 후보로 검토해요.'
    if prob >= 0.4:
        return '관찰', f'13주 뒤 살아남을 확률이 반반({prob * 100:.0f}%)이라 아직 판단하기 일러요. 4주 더 지켜본 뒤 다시 판정해요.'
    return '단기', '이달의 맛으로 내기엔 늦을 가능성이 높아요. 팝업이나 SNS 콘텐츠로 짧게 대응해요.'


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
    c2keep = probe_p = None
    if af is not None and CHRONOS and (k, t) in C2_LIVE:
        f.update(af); f.update(kw=k, t=t, grp_kw=SAME.get(k, k))
        X = add_c2(pd.DataFrame([f]), C2_LIVE)
        prob = float(final_c.predict_proba(X[ALL])[0, 1])
        c2keep, probe_p = round(float(X.c2_keep50.iloc[0]), 2), round(float(final_c.probe_p(X)[0]), 2)
    elif af is not None:
        f.update(af); prob = float(final.predict_proba(pd.DataFrame([f])[COLS])[0, 1])
    else:
        prob = float(backup.predict_proba(pd.DataFrame([f])[FEATS + SCALE])[0, 1])
    prob = round(prob, 2)   # 화면에 보이는 숫자로 판정
    share = info[k]['share']
    warn = bool(af is not None and share is not None and share < 0.5 and af['spread'] >= RUSH)
    actual = None if t + H + 1 >= n else bool((c[t+H-1:t+H+2].mean() - b) / (c[t] - b) >= KEEP)
    typ = info[k]['type']
    size = float(v[t])  # 데이터랩 값은 키워드별 역대 최고 = 100 이라 그대로 %
    action, text = suggest(typ, prob, info[k]['peakMonth'], int(round(c[t])), warn, k in BRAND)
    items.append(dict(
        kw=k, type=typ, prob=round(prob, 2), action=action, suggestion=text, size=round(size),
        detected=grid[t].strftime('%Y-%m-%d'), detectedIdx=t - start, actual=actual,
        steady=int(f['rise_weeks']), base=round(float(f['base52']), 2), jump=round(float(np.exp(f['rise4'])), 1),
        weekly=int(round(c[t])), usual=int(round(b)),
        oldShare=None if share is None else round(share, 2), warn=warn, brand=k in BRAND, c2keep=c2keep, c2pattern=probe_p,
        series=[round(float(x), 1) for x in v[start:]],
    ))
items.sort(key=lambda r: -r['prob'])

# 9. 다가오는 시즌: 반복형 중 '데이터 기준일 + 13주'가 속한 달과 그다음 달에 정점인 재료 (급등 전에 미리 보여 줌)
target = grid[-1] + pd.Timedelta(weeks=H)
months = [int(target.month), int(target.month) % 12 + 1]
season_items = []
for k, (grp, v, c) in use.items():
    s_ = info[k]
    if s_['type'] != '반복형' or s_['peakMonth'] not in months: continue
    sr = pd.Series(v, index=grid); yr = sr[(sr.index.year >= 2016) & (sr.index.year <= 2025)]
    pm = yr.groupby(yr.index.year).idxmax().dt.month
    hit = int((np.minimum((pm - s_['peakMonth']) % 12, (s_['peakMonth'] - pm) % 12) <= 1).sum())
    season_items.append(dict(kw=k, month=int(s_['peakMonth']), brand=k in BRAND, peak=int(round(c[-52:].max())),
                             years=hit, total=int(len(pm)), usual=int(round(c[-52:].mean())),
                             series=[round(float(x), 1) for x in v[start:]]))
season_items.sort(key=lambda r: (months.index(r['month']), -r['peak']))
season = dict(months=months, target=target.strftime('%Y-%m-%d'), items=season_items)
print('다가오는 시즌', months, {m: sum(i['month'] == m for i in season_items) for m in months})
meta = dict(
    minWeekly=MIN_WEEKLY, minSize=MIN_SIZE, first=grid[0].strftime('%Y-%m-%d'), last=grid[-1].strftime('%Y-%m-%d'),
    seriesStart=grid[start].strftime('%Y-%m-%d'), weeks=int(n), horizon=H, recent=RECENT, z=Z, keep=KEEP,
)

body = (
    '// 자동 생성 파일입니다. 직접 고치지 말고 model/export_radar.py 를 다시 실행하세요.\n'
    '// 출처: 네이버 데이터랩 주간 검색량 (키워드별 최고 주 = 100), 연령별 검색량, 검색광고 API 월간 검색 수\n'
    'import type { RadarData } from \'./trend\'\n\n'
    f'export const RADAR: RadarData = {json.dumps(dict(meta=meta, scores=scores, items=items, clusters=clusters, season=season), ensure_ascii=False)}\n'
)
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write(body)
print('저장:', os.path.relpath(OUT), f'{os.path.getsize(OUT) / 1024:.0f}KB')
print('성능:', {k: v for k, v in scores.items() if k != 'models'})
print('최근 급등:', len(items), '개, 주의', sum(i['warn'] for i in items), '개')
