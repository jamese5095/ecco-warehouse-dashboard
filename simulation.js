const WAREHOUSE = {
  pallet: { label: "整托区", capacity: 851472, current: 638604 },
  loose: { label: "散货区", capacity: 463383, current: 356806 },
  inboundPalletRatio: 390402 / 469814,
  outboundPalletRatio: 284751 / 343414,
};

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

function dateLabel(value) {
  if (!value) return "目标日期";
  const [year, month, day] = value.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function rating(maxUtilization, hasShortage) {
  if (hasShortage) return { grade: "D", label: "计划异常", tone: "danger" };
  if (maxUtilization > 1) return { grade: "D", label: "预计超载", tone: "danger" };
  if (maxUtilization >= .85) return { grade: "C", label: "空间紧张", tone: "warning" };
  if (maxUtilization >= .7) return { grade: "B", label: "状态正常", tone: "normal" };
  return { grade: "A", label: "空间宽松", tone: "good" };
}

function width(value) {
  return `${Math.min(100, Math.max(0, value * 100))}%`;
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
  const pressureLabel = palletUtilization >= looseUtilization ? WAREHOUSE.pallet.label : WAREHOUSE.loose.label;
  const pressureUtilization = Math.max(palletUtilization, looseUtilization);
  const remaining = TOTAL_CAPACITY - total;
  const overflow = Math.max(0, pallet - WAREHOUSE.pallet.capacity) + Math.max(0, loose - WAREHOUSE.loose.capacity);

  const headline = resultRating.grade === "A" ? "空间充足，可以承接当前计划"
    : resultRating.grade === "B" ? "总体正常，仍有可用空间"
      : resultRating.grade === "C" ? "仓储压力偏高，建议调整计划"
        : shortage > 0 ? "出库计划超过预计可用库存" : "预计超出容量，需要调整计划";

  const explanation = shortage > 0
    ? `按当前输入，计划出库量超出预计可用库存约 ${number(shortage)} 双。请降低出库量，或确认目标日期前是否还有其他入库。`
    : overflow > 0
      ? `按当前计划，${pressureLabel}将出现结构性超载，超出该区域容量约 ${number(overflow)} 双。即使仓库合计仍有名义余量，也无法直接替代该区域的可用空间。`
      : `按照当前库存和输入的进出库计划，${dateLabel(scenario.targetDate)}预计库存为 ${number(total)} 双。${pressureLabel}压力最高，预计利用率为 ${percent(pressureUtilization)}。`;

  const advice = resultRating.grade === "A" ? "当前计划的空间余量充足，可继续按计划推进。"
    : resultRating.grade === "B" ? `优先关注${pressureLabel}；如入库高度集中，可考虑分批到仓。`
      : resultRating.grade === "C" ? "建议降低集中入库量，或提高同期出库量，为临时波动保留空间。"
        : "请先调整进出库计划，再将情景交由仓库人员进一步确认。";

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
  document.querySelector("#result-remaining-note").textContent = shortage > 0 ? "计划无法完整履约" : overflow > 0 ? `${pressureLabel}仍超载 ${number(overflow)} 双` : "整托与散货合计";
  document.querySelector("#pallet-inventory").textContent = `预计 ${number(pallet)} 双`;
  document.querySelector("#loose-inventory").textContent = `预计 ${number(loose)} 双`;
  document.querySelector("#pallet-percent").textContent = percent(palletUtilization);
  document.querySelector("#loose-percent").textContent = percent(looseUtilization);
  document.querySelector("#pallet-forecast").style.width = width(palletUtilization);
  document.querySelector("#loose-forecast").style.width = width(looseUtilization);
  document.querySelector("#interpretation").textContent = explanation;
  document.querySelector("#advice-copy").textContent = advice;
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
