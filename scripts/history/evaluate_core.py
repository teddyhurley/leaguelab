"""Core release question: stronger season records in NBA versus NHL/MLB.

Observed frequencies and standardized model comparisons are kept distinct.
Only bundled data; no changes to shipped coefficients or UI.
"""
import collections
import json
import math
from pathlib import Path
from binary import fit, logistic
from evaluate_release import COVID, features, mlb_lookbacks, rank_knots, rank

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/history'


def observed(rows):
    eligible = [r for r in rows if abs(r['homeRate']-r['awayRate']) > 1e-10]
    wins = sum(int((r['homeRate'] > r['awayRate']) == bool(r['outcome'])) for r in eligible)
    years = sorted(set(r['season'] for r in eligible))
    return {'games': len(eligible), 'betterRecordWins': wins, 'rate': wins/len(eligible),
            'equalRecordGamesExcluded': len(rows)-len(eligible),
            'perSeason': {str(y): observed([r for r in eligible if r['season']==y]) if len(years)>1 else None for y in years}}


def inverse_rank(q, knots):
    if q <= knots[0][1]: return knots[0][0]
    for lo, hi in zip(knots, knots[1:]):
        if q <= hi[1]: return lo[0]+(hi[0]-lo[0])*(q-lo[1])/(hi[1]-lo[1])
    return knots[-1][0]


def bo7(p):
    return sum(math.factorial(7)/(math.factorial(k)*math.factorial(7-k))*p**k*(1-p)**(7-k) for k in range(4,8))


def main():
    audit = json.loads((DATA/'feature-audit.json').read_text())
    reference = json.loads((DATA/'rarity-reference.json').read_text())['sports']
    result = {'question': 'How much more often does a team with a better completed-season record win in NBA than NHL or MLB?',
              'observedDefinition': 'Use regular-season game outcomes. Compare final season rates after excluding every regular-season meeting between the pair. Remove equal record rates and ties as targets. NHL uses standings points percentage, NBA/MLB win percentage.',
              'standardizedDefinition': 'Fit the same retrospective rarity-logit family separately in each sport. Compare 75th vs 50th and 75th vs 25th percentile records, neutral venue. Bo7 holds p fixed and assumes independent games.',
              'caveats': ['Observed averages mix record gaps, schedules and venues; not a controlled comparison.',
                         'Standardized odds are model estimates, not observed match frequencies or causal sport effects.',
                         'Matching record rarity is a comparison convention, not equal true skill.',
                         'The season cohorts differ slightly by calendar; all are ten-season snapshots, with a separate COVID sensitivity.',
                         'A series calculation is not a directly fitted playoff or series forecast.'], 'sports': {}}
    for sport in ['nba','nhl','mlb']:
        games = json.loads((DATA/(sport+'-games.json')).read_text())
        rows = mlb_lookbacks(games) if sport=='mlb' else audit[sport]['rows']
        regular = [r for r in rows if r['phase']=='regular']
        knots = rank_knots(reference[sport]['teamSeasons'],sport,9999)
        fitted = fit(features(regular,sport,'current_rarity',knots))
        comparisons = []
        for qa,qb in [(.75,.5),(.75,.25),(.9,.5)]:
            gap=math.log(qa/(1-qa))-math.log(qb/(1-qb));p=logistic(fitted['slope']*gap)
            comparisons.append({'rankA':qa,'rankB':qb,'recordRateA':inverse_rank(qa,knots),'recordRateB':inverse_rank(qb,knots),'singleGame':p,'independentBo7':bo7(p)})
        bins=[]
        for low,high in [(0,.25),(.25,.5),(.5,.75),(.75,1.000001)]:
            selected=[r for r in regular if low <= abs(rank(r['homeRate'],knots)-rank(r['awayRate'],knots)) < high]
            bins.append({'minPercentileGap':low,'maxPercentileGap':min(1,high),**observed(selected)})
        result['sports'][sport]={'seasonEnds':sorted(set(r['season'] for r in regular)),
          'observed':observed(regular),'observedExcludingCovid':observed([r for r in regular if r['season'] not in COVID[sport]]),
          'percentileGapBands':bins,'completedSeasonRarityFit':fitted,'standardizedMatchups':comparisons}
    (DATA/'release-core-comparison.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({s:{'observed':d['observed']['rate'],'games':d['observed']['games'],'nonCovid':d['observedExcludingCovid']['rate'],'matchups':d['standardizedMatchups']} for s,d in result['sports'].items()},indent=2))


if __name__=='__main__':main()
