const WAREHOUSE = {
  pallet: { label: "整托区", capacity: 851472, current: 638604, unitSize: 144, unitLabel: "个标准托盘" },
  loose: { label: "散货区", capacity: 463383, current: 356806, unitSize: 9, unitLabel: "个散货库位" },
  inboundPalletRatio: 390402 / 469814,
  outboundPalletRatio: 284751 / 343414,
};

const JULY = { averageInbound: 22372, peakInbound: 48511 };
const BASE_DATE = new Date(2026, 6, 31);
const TOTAL_CAPACITY = WAREHOUSE.pallet.capacity + WAREHOUSE.loose.capacity;
const CURRENT_TOTAL = WAREHOUSE.pallet.current + WAREHOUSE.loose.current;

const form = document.querySelector("#scenario-form");
const targetDate = document.querySelector("#target-date");
const inbound = document.querySelector("#inbound");
const outbound = document.querySelector("#outbound");
const results = document.querySelector("#simulation-results");

function number(value) {
  return Math.round(value).toLocaleString("zh-CN");
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function parseDate(value) {
  if (!value) return new Date(BASE_DATE);
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateLabel(value) {
  const date = parseDate(value);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function shortDate(value) {
  const date = value instanceof Date ? value : parseDate(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function businessDaysUntil(value) {
  const end = parseDate(value);
  const cursor = new Date(BASE_DATE);
  let days = 0;
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) days += 1;
  }
  return Math.max(1, days);
}

function dateAtBusinessDay(offset) {
  const cursor = new Date(BASE_DATE);
  let elapsed = 0;
  while (elapsed < offset) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) elapsed += 1;
  }
  return cursor;
}

function rating(maxUtilization, hasShortage) {
  if (hasShortage) return { grade: "D", label: "计划异常", tone: "danger" };
  if (maxUtilization > 1) return { grade: "D", label: "预计超载", tone: "danger" };
  if (maxUtilization >= .85) return { grade: "C", label: "空间紧张", tone: "warning" };
  if (maxUtilization >= .7) return { grade: "B", label: "状态正常", tone: "normal" };
  return { grade: "A", label: "空间宽松", tone: "good" };
}

function visualSize(value) {
  return `${Math.min(100, Math.max(0, value * 100))}%`;
}

function crossingDay(current, forecast, capacity, threshold, totalDays) {
  if (current >= capacity * threshold) return 0;
  const dailyChange = (forecast - current) / totalDays;
  if (dailyChange <= 0) return null;
  const day = Math.ceil((capacity * threshold - current) / dailyChange);
  return day <= totalDays ? day : null;
}

function updateTimelineMarker(id, crossing, totalDays) {
  const marker = document.querySelector(id);
  if (crossing === null) {
    marker.classList.add("is-hidden");
    return;
  }
  marker.classList.remove("is-hidden");
  marker.style.left = `${Math.min(100, Math.max(0, crossing / totalDays * 100))}%`;
}

function calculate() {
  const scenario = {
    targetDate: targetDate.value,
    inbound: Math.max(0, Number(inbound.value) || 0),
    outbound: Math.max(0, Number(outbound.value) || 0),
  };

  const rawPallet = WAREHOUSE.pallet.current + scenario.inbound * WAREHOUSE.inboundPalletRatio - scenario.outbound * WAREHOUSE.outboundPalletRatio;
  const rawLoose = WAREHOUSE.loose.current + scenario.inbound * (1 - WAREHOUSE.inboundPalletRatio) - scenario.outbound * (1 - WAREHOUSE.outboundPalletRatio);
  const shortage = Math.max(0, -rawPallet) + Math.max(0, -rawLoose);
  const pallet = Math.max(0, rawPallet);
  const loose = Math.max(0, rawLoose);
  const total = pallet + loose;
  const palletUtilization = pallet / WAREHOUSE.pallet.capacity;
  const looseUtilization = loose / WAREHOUSE.loose.capacity;
  const totalUtilization = total / TOTAL_CAPACITY;
  const maximum = Math.max(palletUtilization, looseUtilization);
  const hasShortage = shortage > 0;
  const resultRating = rating(maximum, hasShortage);
  const pressureKey = palletUtilization >= looseUtilization ? "pallet" : "loose";
  const pressureZone = WAREHOUSE[pressureKey];
  const pressureInventory = pressureKey === "pallet" ? pallet : loose;
  const pressureUtilization = Math.max(palletUtilization, looseUtilization);
  const remaining = TOTAL_CAPACITY - total;
  const palletOverflow = Math.max(0, pallet - WAREHOUSE.pallet.capacity);
  const looseOverflow = Math.max(0, loose - WAREHOUSE.loose.capacity);
  const overflow = palletOverflow + looseOverflow;

  const headline = resultRating.grade === "A" ? "空间充足，可以承接当前计划"
    : resultRating.grade === "B" ? "总体正常，仍有可用空间"
      : resultRating.grade === "C" ? "仓储压力偏高，建议调整计划"
        : shortage > 0 ? "出库计划超过预计可用库存" : "预计出现区域超载，需要调整计划";

  const explanation = shortage > 0
    ? `按当前输入，计划出库量超出预计可用库存约 ${number(shortage)} 双，当前计划无法完整履约。`
    : overflow > 0
      ? `${pressureZone.label}将出现结构性超载，超出该区域容量约 ${number(overflow)} 双。仓库合计余量无法直接替代该区域的可用空间。`
      : `${dateLabel(scenario.targetDate)}预计库存为 ${number(total)} 双。${pressureZone.label}压力最高，预计利用率为 ${percent(pressureUtilization)}。`;

  const advice = resultRating.grade === "A" ? "当前计划的空间余量充足，可继续按计划推进。"
    : resultRating.grade === "B" ? `优先关注${pressureZone.label}；如入库高度集中，可考虑分批到仓。`
      : resultRating.grade === "C" ? "建议降低集中入库量，或提高同期出库量，为临时波动保留空间。"
        : "请先调整进出库计划，再将情景交由仓库人员进一步确认。";

  let impactLabel = "现场含义";
  let impactValue;
  let impactNote;
  if (shortage > 0) {
    impactLabel = "预计履约缺口";
    impactValue = `${number(shortage)} 双无法按计划出库`;
    impactNote = "库存下限按零计算，不显示负库存";
  } else if (overflow > 0) {
    const overflowKey = palletOverflow >= looseOverflow ? "pallet" : "loose";
    const overflowZone = WAREHOUSE[overflowKey];
    const zoneOverflow = overflowKey === "pallet" ? palletOverflow : looseOverflow;
    impactLabel = "预计空间缺口";
    impactValue = `约 ${number(Math.ceil(zoneOverflow / overflowZone.unitSize))} ${overflowZone.unitLabel}无库位`;
    impactNote = `${overflowZone.label}超出容量 ${number(zoneOverflow)} 双`;
  } else {
    const zoneRemaining = Math.max(0, pressureZone.capacity - pressureInventory);
    impactValue = `${pressureZone.label}距满仓约 ${number(Math.floor(zoneRemaining / pressureZone.unitSize))} ${pressureZone.unitLabel}`;
    impactNote = `按${pressureZone.label}当前剩余空间折算`;
  }

  results.className = `results-panel sim-section ${resultRating.tone}`;
  document.querySelector("#result-date").textContent = dateLabel(scenario.targetDate);
  document.querySelector("#result-headline").textContent = headline;
  document.querySelector("#result-grade").textContent = resultRating.grade;
  document.querySelector("#result-grade-label").textContent = resultRating.label;
  document.querySelector("#result-total").textContent = `${number(total)} 双`;
  document.querySelector("#result-delta").textContent = `${total >= CURRENT_TOTAL ? "↑" : "↓"} 比现在${total >= CURRENT_TOTAL ? "多" : "少"} ${number(Math.abs(total - CURRENT_TOTAL))} 双`;
  document.querySelector("#result-utilization").textContent = percent(totalUtilization);
  document.querySelector("#result-remaining-label").textContent = shortage > 0 ? "预计出库缺口" : remaining >= 0 ? (overflow > 0 ? "合计名义余量" : "预计还能存放") : "预计超出容量";
  document.querySelector("#result-remaining").textContent = `${number(shortage > 0 ? shortage : Math.abs(remaining))} 双`;
  document.querySelector("#result-remaining-note").textContent = shortage > 0 ? "计划无法完整履约" : overflow > 0 ? `${pressureZone.label}仍存在空间缺口` : "整托与散货合计";
  document.querySelector("#pallet-inventory").textContent = `整托 ${number(pallet)} 双`;
  document.querySelector("#loose-inventory").textContent = `散货 ${number(loose)} 双`;
  document.querySelector("#pallet-percent").textContent = percent(palletUtilization);
  document.querySelector("#loose-percent").textContent = percent(looseUtilization);
  document.querySelector("#pallet-forecast").style.height = visualSize(palletUtilization);
  document.querySelector("#loose-forecast").style.height = visualSize(looseUtilization);
  document.querySelector("#pallet-overflow-signal").classList.toggle("show", palletUtilization > 1);
  document.querySelector("#loose-overflow-signal").classList.toggle("show", looseUtilization > 1);
  document.querySelector("#future-warehouse").setAttribute("aria-label", `目标日期整托区利用率${percent(palletUtilization)}，散货区利用率${percent(looseUtilization)}`);
  document.querySelector("#interpretation").textContent = explanation;
  document.querySelector("#advice-copy").textContent = advice;
  document.querySelector("#impact-label").textContent = impactLabel;
  document.querySelector("#impact-value").textContent = impactValue;
  document.querySelector("#impact-note").textContent = impactNote;
  document.querySelector("#scene-target-date").textContent = shortDate(scenario.targetDate);

  const workdays = businessDaysUntil(scenario.targetDate);
  const dailyInbound = scenario.inbound / workdays;
  const averageMultiple = dailyInbound / JULY.averageInbound;
  const peakShare = dailyInbound / JULY.peakInbound;
  let intensityCopy;
  if (dailyInbound > JULY.peakInbound) {
    intensityCopy = `计划日均入库达到7月正常水平的 ${averageMultiple.toFixed(2)} 倍，并超过7月历史单日峰值。`;
  } else if (averageMultiple >= 1.2) {
    intensityCopy = `计划日均入库为7月正常水平的 ${averageMultiple.toFixed(2)} 倍，但仍低于7月历史峰值。`;
  } else if (averageMultiple >= .8) {
    intensityCopy = `计划日均入库接近7月正常水平，为历史日均的 ${averageMultiple.toFixed(2)} 倍。`;
  } else {
    intensityCopy = `计划日均入库低于7月正常水平，约为历史日均的 ${averageMultiple.toFixed(2)} 倍。`;
  }
  document.querySelector("#daily-inbound").textContent = `${number(dailyInbound)} 双/工作日`;
  document.querySelector("#intensity-copy").textContent = intensityCopy;
  document.querySelector("#plan-intensity-value").textContent = number(dailyInbound);
  document.querySelector("#plan-intensity-marker").style.left = `${Math.min(100, Math.max(0, peakShare * 100))}%`;
  document.querySelector("#workday-note").textContent = `按目标日期前 ${workdays} 个工作日平均计算`;

  const pressureForecast = pressureKey === "pallet" ? pallet : loose;
  const warningDay = crossingDay(pressureZone.current, pressureForecast, pressureZone.capacity, .85, workdays);
  const capacityDay = crossingDay(pressureZone.current, pressureForecast, pressureZone.capacity, 1, workdays);
  updateTimelineMarker("#warning-marker", warningDay, workdays);
  updateTimelineMarker("#capacity-marker", capacityDay, workdays);
  document.querySelector("#pressure-zone-title").textContent = `${pressureZone.label}何时进入警戒？`;
  document.querySelector("#warning-date").textContent = warningDay === null ? "目标期内未触及" : warningDay === 0 ? "当前已达到" : shortDate(dateAtBusinessDay(warningDay));
  document.querySelector("#capacity-date").textContent = capacityDay === null ? "目标期内未触及" : capacityDay === 0 ? "当前已达到" : shortDate(dateAtBusinessDay(capacityDay));
  document.querySelector("#timeline-target-date").textContent = shortDate(scenario.targetDate);
  document.querySelector("#timeline-summary").textContent = capacityDay !== null ? `预计${shortDate(dateAtBusinessDay(capacityDay))}达到容量上限`
    : warningDay !== null ? "目标日期前将进入警戒区" : "目标日期前暂未触及85%警戒线";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculate();
  results.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelectorAll("[data-inbound]").forEach((button) => {
  button.addEventListener("click", () => {
    inbound.value = button.dataset.inbound;
    outbound.value = button.dataset.outbound;
  });
});

[inbound, outbound].forEach((input) => {
  input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, ""); });
});

calculate();
