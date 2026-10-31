# Planner evaluation

Reproduce: `npm run eval` (default 200 productions; pass a number to change it).

Generator: seeded synthetic productions with 3-6 performers, 4-7 scenes, 1-2 looks per role, 12-27 owned pieces (qty 1) and 8-17 partner pieces (qty 2, $15-64), budgets $100-299. Requirements draw 2-3 tags and one colour per slot.

Baseline: for each look independently, the best-matching available piece that fits the performer, ignoring other looks and the budget. This mirrors picking costumes one character at a time.

Synthetic productions: 200 (1144 looks, 3-6 performers, 4-7 scenes, seeded 1..200)

| Planner | Feasible plans | Double-bookings (total) | Over budget | Unfilled slots | Avg solve time |
|---|---|---|---|---|---|
| Look-by-look baseline | 24.5% | 317 | 25.5% | 145 | 0.3 ms |
| ENCORE planner | 100.0% | 0 | 0.0% | 176 | 3.8 ms |

Reading the table:

- *Feasible* means no piece is worn by more people in a scene than the rack holds, and sourcing stays within budget.
- ENCORE leaves more slots unfilled than the baseline. Those are slots the baseline filled by double-booking a piece or overspending; ENCORE reports them as sourcing needs instead.
- These scenarios are constructed to test feasibility. They say nothing about aesthetic quality, which is what the renders and the designer are for.
