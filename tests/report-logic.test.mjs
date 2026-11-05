import assert from "node:assert/strict";
import test from "node:test";

const reportLogic = await import(
  new URL("../src/lib/reportLogic.ts", import.meta.url)
).catch(() => null);

test("quarter periods stay inside the selected company, year, and quarter", () => {
  assert.notEqual(reportLogic, null, "report logic module is missing");
  const periods = [
    { id: "p03", company_id: "c1", period_year: 2026, period_month: 3 },
    { id: "p04", company_id: "c1", period_year: 2026, period_month: 4 },
    { id: "p05", company_id: "c1", period_year: 2026, period_month: 5 },
    { id: "p06", company_id: "c1", period_year: 2026, period_month: 6 },
    { id: "other", company_id: "c2", period_year: 2026, period_month: 5 },
  ];

  assert.deepEqual(
    reportLogic.quarterPeriods(periods, "p05").map((period) => period.id),
    ["p04", "p05"],
  );
});

test("quarter income and cash-flow reports sum quarter activity and retain current YTD", () => {
  assert.notEqual(reportLogic, null, "report logic module is missing");
  const income = reportLogic.aggregateIncomeQuarter([
    {
      period_id: "p04",
      items: [{ item_code: "IS001", item_name: "营业收入", item_level: 1, is_total: 0, current_amount: 10, year_to_date: 40, children: [] }],
      current_period_total: 4,
      year_to_date_total: 14,
    },
    {
      period_id: "p05",
      items: [{ item_code: "IS001", item_name: "营业收入", item_level: 1, is_total: 0, current_amount: 20, year_to_date: 60, children: [] }],
      current_period_total: 6,
      year_to_date_total: 20,
    },
  ]);
  assert.equal(income.period_id, "p05");
  assert.equal(income.items[0].current_amount, 30);
  assert.equal(income.items[0].year_to_date, 60);
  assert.equal(income.current_period_total, 10);
  assert.equal(income.year_to_date_total, 20);

  const cash = reportLogic.aggregateCashFlowQuarter([
    {
      period_id: "p04",
      items: [
        { item_code: "CF001", item_name: "销售收现", item_level: 1, is_total: 0, current_amount: 100, year_to_date: 400 },
        { item_code: "CF999", item_name: "期末现金余额", item_level: 1, is_total: 1, current_amount: 900, year_to_date: 900 },
      ],
      net_increase: 30,
      net_increase_year_to_date: 120,
      opening_cash_balance: 830,
      ending_cash_balance: 860,
      cash_balance_change: 30,
      cash_balance_change_year_to_date: 120,
      reconciliation_difference: 0,
      reconciliation_difference_year_to_date: 0,
      is_reconciled: true,
      classification_mode: "voucher_mapping",
      unmapped_cash_amount: 0,
      unmapped_cash_amount_year_to_date: 0,
      unmapped_voucher_count: 0,
      mapping_conflict_count: 0,
      is_classification_complete: true,
    },
    {
      period_id: "p05",
      items: [
        { item_code: "CF001", item_name: "销售收现", item_level: 1, is_total: 0, current_amount: 150, year_to_date: 550 },
        { item_code: "CF999", item_name: "期末现金余额", item_level: 1, is_total: 1, current_amount: 940, year_to_date: 940 },
      ],
      net_increase: 40,
      net_increase_year_to_date: 160,
      opening_cash_balance: 860,
      ending_cash_balance: 900,
      cash_balance_change: 40,
      cash_balance_change_year_to_date: 160,
      reconciliation_difference: 0,
      reconciliation_difference_year_to_date: 0,
      is_reconciled: true,
      classification_mode: "voucher_mapping",
      unmapped_cash_amount: 0,
      unmapped_cash_amount_year_to_date: 0,
      unmapped_voucher_count: 0,
      mapping_conflict_count: 0,
      is_classification_complete: true,
    },
  ]);
  assert.equal(cash.items[0].current_amount, 250);
  assert.equal(cash.items[0].year_to_date, 550);
  assert.equal(cash.items[1].current_amount, 940);
  assert.equal(cash.items[1].year_to_date, 940);
  assert.equal(cash.net_increase, 70);
  assert.equal(cash.net_increase_year_to_date, 160);
  assert.equal(cash.opening_cash_balance, 830);
  assert.equal(cash.ending_cash_balance, 900);
  assert.equal(cash.cash_balance_change, 70);
  assert.equal(cash.reconciliation_difference, 0);
  assert.equal(cash.is_reconciled, true);
});

test("account summary reports closing direction instead of requiring each account to balance", () => {
  assert.notEqual(reportLogic, null, "report logic module is missing");
  assert.equal(reportLogic.ledgerClosingDirection({ closing_debit: 120, closing_credit: 0 }), "借");
  assert.equal(reportLogic.ledgerClosingDirection({ closing_debit: 0, closing_credit: 80 }), "贷");
  assert.equal(reportLogic.ledgerClosingDirection({ closing_debit: 0, closing_credit: 0 }), "平");
});
