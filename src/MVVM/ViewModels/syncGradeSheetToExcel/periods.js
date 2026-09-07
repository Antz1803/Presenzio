import { periodSheets, summaryPeriodOrder } from "./constants";

export function getActivePeriodCodes(gradingPeriods) {
  const byCode = new Map((gradingPeriods ?? []).map((period) => [period.code, period]));
  return summaryPeriodOrder.filter((code) => {
    const period = byCode.get(code);
    return Boolean(period?.start_date && period?.end_date);
  });
}

export function buildPeriodDateRanges(gradingPeriods) {
  const ranges = new Map();
  (gradingPeriods ?? []).forEach((period) => {
    if (period?.code && period.start_date && period.end_date) {
      ranges.set(period.code, { start: period.start_date, end: period.end_date });
    }
  });
  return ranges;
}

export function sessionWithinPeriodRange(session, periodDateRanges) {
  const range = periodDateRanges.get(session.periodCode);
  if (!range) return false;
  const date = String(session.sessionDate);
  return date >= range.start && date <= range.end;
}

export function periodCodeForRow(row, periodsById) {
  return row?.period?.code ?? periodsById.get(row?.period_id)?.code ?? "";
}

export function getPeriodSheet(periodCode) {
  return periodSheets[periodCode];
}
