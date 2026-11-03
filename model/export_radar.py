"""트렌드 레이더 데이터 내보내기

노트북(BR_trend_radar_model.ipynb)과 같은 규칙과 모델로 계산해서
앱 화면이 읽는 src/lib/trend-data.ts 를 만든다.

실행: python model/export_radar.py   (레포 최상위 폴더에서)
필요: pandas, numpy, scikit-learn
"""
import glob
import json
import os
import warnings

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import balanced_accuracy_score, roc_auc_score
from sklearn.model_selection import GroupKFold

warnings.filterwarnings('ignore')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'lib', 'trend-data.ts')
H = 13            # BR 리드타임 (주)
RECENT = 26       # 최근 몇 주 안의 급등을 보여줄지
MIN_SIZE = 20     # 이달의 맛 후보가 되려면 감지 주 검색량이 역대 최고의 몇 % 이상이어야 하는지
SHOW_WEEKS = 156  # 상세 그래프에 넣을 기간 (3년)

# 1. 데이터
frames = []
for f in sorted(glob.glob(os.path.join(HERE, 'data', 'datalab*.csv'))):
    d = pd.read_csv(f, encoding='utf-8-sig')
    d.columns = ['kw', 'date', 'v']
    frames.append(d)
df = pd.concat(frames)
df['date'] = pd.to_datetime(df['date'])
df = df.drop_duplicates(['kw', 'date'])
grid = pd.date_range(df.date.min(), df.date.max(), freq='W-MON')
W = df.pivot_table(index='date', columns='kw', values='v').reindex(grid).fillna(0)
n = len(W)


# 2. 노트북과 같은 특징, 급등 감지, 규칙 유형
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


def is_surge(v, t):
    return v[t] >= 5 and v[t] >= 1.5 * max(v[t-12:t].mean(), 0.5)


def rule_type(v):
    s = pd.Series(v, index=W.index)
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

# 3. 학습 데이터 (급등 감지 순간, 키워드마다 8주 간격)
rows = []
for kw in W.columns:
    v = W[kw].values
    last = -99
    for t in range(60, n - H):
        if not is_surge(v, t) or t - last < 8:
            continue
        last = t
        r = features(v, t)
        r.update(kw=kw, y=int(v[t + H] >= 0.5 * v[t]))
        rows.append(r)
S = pd.DataFrame(rows)
X, y, g = S[FEATS], S.y.values, S.kw.values


def rf():
    return RandomForestClassifier(300, min_samples_leaf=5, class_weight='balanced', random_state=0)


# 4. 검증 (키워드 단위 5묶음)
p = np.zeros(len(y))
for tr, te in GroupKFold(5).split(X, y, g):
    p[te] = rf().fit(X.iloc[tr], y[tr]).predict_proba(X.iloc[te])[:, 1]
rule = (S.rise_weeks > 5).astype(int)
scores = dict(
    samples=int(len(S)), keywords=int(W.shape[1]), survive_rate=round(float(y.mean()), 2),
    model_bal=round(float(balanced_accuracy_score(y, p > .5)), 2),
    model_auc=round(float(roc_auc_score(y, p)), 2),
    rule_bal=round(float(balanced_accuracy_score(y, rule)), 2),
)
final = rf().fit(X, y)

# 5. 곡선 모양 군집 (비지도)
info, vecs = {}, []
for kw in W.columns:
    v = W[kw].values
    typ, ac, same, mode, k = rule_type(v)
    pk = int(np.argmax(v))
    shape = np.array([v[i] if 0 <= i < n else 0 for i in range(pk - 26, pk + 53)]) / v[pk]
    vecs.append(np.r_[shape, ac * 2, same * 2])
    info[kw] = dict(type=typ, peakMonth=mode)
V = np.array(vecs)
km = KMeans(4, n_init=20, random_state=0).fit(V)
labels = dict(zip(W.columns, km.labels_))
clusters = []
for c in range(4):
    members = [kw for kw in W.columns if labels[kw] == c]
    types = pd.Series([info[k]['type'] for k in members]).value_counts()
    clusters.append(dict(
        id=c, size=len(members), main=types.index[0], match=int(types.iloc[0]),
        members=members, curve=[round(float(x), 3) for x in V[km.labels_ == c, :79].mean(0)],
    ))
purity = sum(c['match'] for c in clusters) / W.shape[1]
scores['cluster_match'] = round(purity, 2)


# 6. 최근 급등 키워드 예측과 BR 제안
def suggest(typ, prob, peak_month, size):
    if typ == '반복형':
        return '시즌', f'매년 {peak_month}월 전후에 돌아오는 재료. 내년 {peak_month}월 출시에 맞춰 시즌 한정으로 준비'
    if prob >= 0.6 and size < MIN_SIZE:
        return '관찰', f'오래 가겠지만 규모가 작음 (역대 최고의 {size:.0f}%). 이달의 맛으로 내기엔 수요가 부족해서 더 커지는지 지켜보기'
    if prob >= 0.6:
        return '후보', '13주 뒤 출시 시점에도 수요가 남을 가능성이 높음. 이달의 맛 후보로 검토'
    if prob >= 0.4:
        return '관찰', '판단 보류. 4주 더 지켜본 뒤 다시 판정'
    return '단기', '이달의 맛으로는 늦을 가능성이 높음. 팝업, SNS 콘텐츠로 짧게 대응'


items = []
for kw in W.columns:
    v = W[kw].values
    hits = [t for t in range(n - RECENT, n) if is_surge(v, t)]
    if not hits:
        continue
    t = hits[-1]
    f = features(v, t)
    prob = float(final.predict_proba(pd.DataFrame([f])[FEATS])[0, 1])
    actual = None if t + H >= n else bool(v[t + H] >= 0.5 * v[t])
    typ = info[kw]['type']
    size = float(v[t])  # 데이터랩 값은 키워드별 역대 최고 = 100 이라 그대로 %
    action, text = suggest(typ, prob, info[kw]['peakMonth'], size)
    start = max(0, n - SHOW_WEEKS)
    items.append(dict(
        kw=kw, type=typ, prob=round(prob, 2), action=action, suggestion=text, size=round(size),
        detected=W.index[t].strftime('%Y-%m-%d'), detectedIdx=t - start,
        actual=actual,
        steady=int(f['rise_weeks']), base=round(float(f['base52']), 2),
        jump=round(float(np.exp(f['rise4'])), 1),
        series=[round(float(x), 1) for x in v[start:]],
    ))
items.sort(key=lambda r: -r['prob'])
start = max(0, n - SHOW_WEEKS)
meta = dict(
    minSize=MIN_SIZE, first=W.index[0].strftime('%Y-%m-%d'), last=W.index[-1].strftime('%Y-%m-%d'),
    seriesStart=W.index[start].strftime('%Y-%m-%d'), weeks=int(n), horizon=H, recent=RECENT,
)

body = (
    '// 자동 생성 파일입니다. 직접 고치지 말고 model/export_radar.py 를 다시 실행하세요.\n'
    '// 출처: 네이버 데이터랩 주간 검색량 (키워드별 최고 주 = 100)\n'
    'import type { RadarData } from \'./trend\'\n\n'
    f'export const RADAR: RadarData = {json.dumps(dict(meta=meta, scores=scores, items=items, clusters=clusters), ensure_ascii=False)}\n'
)
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write(body)
print('저장:', os.path.relpath(OUT), f'{os.path.getsize(OUT) / 1024:.0f}KB')
print('성능:', scores)
print('최근 급등:', len(items), '개')
