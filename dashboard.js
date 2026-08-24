const JULY_DATA = window.JULY_SHOES;
const DAYS = JULY_DATA.days.map((day) => ({
  ...day,
  inbound: day.inMain + day.inRepeat,
  outbound: day.outMain + day.outOther,
  utilization: day.stock / JULY_DATA.meta.capacity,
}));

const CAPACITY = JULY_DATA.meta.capacity;
const PRESSURE = JULY_DATA.meta.pressureThresholds || { observation: .7, high: .85, capacity: 1 };
const svgNamespace = "http://www.w3.org/2000/svg";
let selectedIndex = DAYS.length - 1;
let playback = null;

const formatNumber = (value) => Math.round(value).toLocaleString("zh-CN");
const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;
const formatSigned = (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatNumber(Math.abs(value))}`;

function dateParts(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return {
    label: `${month}月${day}日`,
    weekday: `星期${"日一二三四五六"[date.getDay()]}`,
  };
}

function stateFor(utilization) {
  if (utilization >= PRESSURE.capacity) return { grade: "D", label: "容量超限", headline: "库存超过设计容量", description: "当前水位已经超过鞋类库容上限，需要立即调整进出计划。" };
  if (utilization >= PRESSURE.high) return { grade: "C", label: "高压运行", headline: "库存进入高压区", description: "库存超过85%高压提示线，继续集中入库将明显压缩现场缓冲空间。" };
  if (utilization >= PRESSURE.observation) return { grade: "B", label: "容量可控", headline: "容量仍然可控", description: "当前超过70%观察起点，但距离85%高压提示线仍有明显空间。" };
  return { grade: "A", label: "容量宽松", headline: "容量空间充足", description: "当前库存低于70%观察起点，仓库仍保有较充分的空间余量。" };
}

function historicalPosition(stock) {
  const rank = DAYS.filter((day) => day.stock <= stock).length / DAYS.length;
  const percentile = Math.round(rank * 100);
  const label = percentile >= 90 ? "月内高位" : percentile <= 15 ? "月内低位" : "月内常态";
  return { percentile, label };
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function updateSliderTrack() {
  const slider = document.querySelector("#date-slider");
  const progress = selectedIndex / (DAYS.length - 1) * 100;
  slider.value = selectedIndex;
  slider.style.background = `linear-gradient(to right, #e60000 0 ${progress}%, #d9d9d9 ${progress}% 100%)`;
  slider.setAttribute("aria-valuetext", dateParts(DAYS[selectedIndex].date).label);
}

function updateSelectedDay() {
  const day = DAYS[selectedIndex];
  const previous = selectedIndex > 0 ? DAYS[selectedIndex - 1] : null;
  const stockDelta = previous ? day.stock - previous.stock : 0;
  const state = stateFor(day.utilization);
  const history = historicalPosition(day.stock);
  const date = dateParts(day.date);
  const highPressureGap = Math.max(0, CAPACITY * PRESSURE.high - day.stock);
  const headline = history.label === "月内高位" && state.grade !== "D"
    ? `${state.headline}，库存处于月内高位`
    : history.label === "月内低位" && state.grade === "A" ? "容量空间充足，库存处于月内低位" : state.headline;
  const description = state.grade === "B"
    ? `当前超过70%观察起点，距离85%高压提示线还有约${formatNumber(highPressureGap)}双。`
    : state.description;

  setText("#selected-date", date.label);
  setText("#selected-weekday", date.weekday);
  setText("#state-grade", state.grade);
  setText("#state-grade-label", state.label);
  setText("#state-headline", headline);
  setText("#state-description", description);
  setText("#history-position", `P${history.percentile} · ${history.label}`);
  setText("#selected-utilization", formatPercent(day.utilization));
  setText("#selected-inbound", formatNumber(day.inbound));
  setText("#selected-inbound-note", `主单${formatNumber(day.inMain)} · 补单${formatNumber(day.inRepeat)}`);
  setText("#selected-outbound", formatNumber(day.outbound));
  setText("#selected-outbound-note", `主单${formatNumber(day.outMain)} · 其他${formatNumber(day.outOther)}`);
  setText("#selected-stock", formatNumber(day.stock));
  setText("#selected-stock-note", previous ? `较前一日${stockDelta >= 0 ? "增加" : "减少"}${formatNumber(Math.abs(stockDelta))}双` : "7月首个库存快照");
  setText("#selected-remaining", formatNumber(Math.max(0, CAPACITY - day.stock)));

  const stateCard = document.querySelector("#state-card");
  stateCard.dataset.grade = state.grade;
  const capacityCurrent = document.querySelector("#capacity-current");
  capacityCurrent.style.bottom = `${Math.min(100, day.utilization * 100)}%`;
  capacityCurrent.closest(".capacity-scale").setAttribute("aria-label", `${date.label}库容利用率${formatPercent(day.utilization)}；70%为观察起点，85%为高压提示线`);
  updateSliderTrack();
  updateChartSelection();
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(svgNamespace, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function addSvgText(svg, x, y, text, className, anchor = "start") {
  const element = svgElement("text", { x, y, class: className, "text-anchor": anchor });
  element.textContent = text;
  svg.appendChild(element);
  return element;
}

function renderStockChart() {
  const svg = document.querySelector("#stock-chart");
  const width = 1100;
  const height = 390;
  const margin = { top: 25, right: 24, bottom: 38, left: 62 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const yMin = 650000;
  const yMax = 1000000;
  const x = (index) => margin.left + index / (DAYS.length - 1) * plotWidth;
  const y = (value) => margin.top + (yMax - value) / (yMax - yMin) * plotHeight;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  const defs = svgElement("defs");
  const gradient = svgElement("linearGradient", { id: "stockAreaGradient", x1: "0", y1: "0", x2: "0", y2: "1" });
  gradient.append(svgElement("stop", { offset: "0%", "stop-color": "#e60000", "stop-opacity": ".22" }));
  gradient.append(svgElement("stop", { offset: "100%", "stop-color": "#e60000", "stop-opacity": ".01" }));
  defs.appendChild(gradient);
  svg.appendChild(defs);

  const observationValue = CAPACITY * PRESSURE.observation;
  svg.appendChild(svgElement("rect", {
    x: margin.left, y: y(yMax), width: plotWidth, height: y(observationValue) - y(yMax), fill: "#fff8e8",
  }));

  [650000, 700000, 800000, 900000, 1000000].forEach((value) => {
    const lineY = y(value);
    svg.appendChild(svgElement("line", { x1: margin.left, x2: width - margin.right, y1: lineY, y2: lineY, class: "chart-grid-line" }));
    addSvgText(svg, margin.left - 11, lineY + 3, `${Math.round(value / 10000)}万`, "chart-axis-label", "end");
  });
  svg.appendChild(svgElement("line", { x1: margin.left, x2: width - margin.right, y1: y(observationValue), y2: y(observationValue), class: "chart-observation-line" }));
  addSvgText(svg, margin.left + 10, y(observationValue) - 7, `70%观察起点 · ${formatNumber(observationValue)}`, "chart-threshold-label").setAttribute("fill", "#a87300");

  const linePath = DAYS.map((day, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(day.stock).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${x(DAYS.length - 1)},${y(yMin)} L${x(0)},${y(yMin)} Z`;
  svg.appendChild(svgElement("path", { d: areaPath, class: "stock-area" }));
  svg.appendChild(svgElement("path", { d: linePath, class: "stock-line" }));

  const guide = svgElement("line", { id: "stock-selected-guide", class: "selected-guide", y1: margin.top, y2: height - margin.bottom });
  svg.appendChild(guide);

  DAYS.forEach((day, index) => {
    const point = svgElement("circle", { cx: x(index), cy: y(day.stock), r: 3.4, class: "stock-point", "data-index": index, tabindex: "0", role: "button", "aria-label": `${dateParts(day.date).label}库存${formatNumber(day.stock)}双` });
    svg.appendChild(point);
  });

  [0, 7, 15, 23, 30].forEach((index) => addSvgText(svg, x(index), height - 13, dateParts(DAYS[index].date).label.replace("月", "/").replace("日", ""), "chart-axis-label", "middle"));

  const badge = svgElement("g", { id: "stock-selected-badge" });
  badge.append(svgElement("rect", { x: -45, y: -29, width: 90, height: 23, rx: 6, class: "selected-badge" }));
  const badgeText = svgElement("text", { x: 0, y: -14, class: "selected-badge-text", "text-anchor": "middle" });
  badgeText.textContent = "";
  badge.appendChild(badgeText);
  svg.appendChild(badge);

  svg.addEventListener("click", (event) => {
    const target = event.target.closest("[data-index]");
    if (target) selectDay(Number(target.dataset.index));
  });
  svg.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.dataset.index) selectDay(Number(event.target.dataset.index));
  });
  svg.dataset.xStart = margin.left;
  svg.dataset.xWidth = plotWidth;
  svg.dataset.yMin = yMin;
  svg.dataset.yMax = yMax;
  svg.dataset.yTop = margin.top;
  svg.dataset.yHeight = plotHeight;
}

function renderFlowChart() {
  const svg = document.querySelector("#flow-chart");
  const width = 1100;
  const height = 300;
  const margin = { top: 20, right: 24, bottom: 38, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = 60000;
  const groupWidth = plotWidth / DAYS.length;
  const y = (value) => margin.top + plotHeight - value / maxValue * plotHeight;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  [0, 20000, 40000, 60000].forEach((value) => {
    const lineY = y(value);
    svg.appendChild(svgElement("line", { x1: margin.left, x2: width - margin.right, y1: lineY, y2: lineY, class: "chart-grid-line" }));
    addSvgText(svg, margin.left - 10, lineY + 3, value === 0 ? "0" : `${value / 10000}万`, "chart-axis-label", "end");
  });

  const selection = svgElement("rect", { id: "flow-selection", y: margin.top, height: plotHeight, class: "flow-selection" });
  svg.appendChild(selection);

  DAYS.forEach((day, index) => {
    const groupX = margin.left + index * groupWidth;
    const barWidth = Math.max(5, groupWidth * .27);
    const gap = Math.max(2, groupWidth * .05);
    const inboundHeight = plotHeight - (y(day.inbound) - margin.top);
    const outboundHeight = plotHeight - (y(day.outbound) - margin.top);
    svg.appendChild(svgElement("rect", { x: groupX + groupWidth / 2 - barWidth - gap / 2, y: y(day.inbound), width: barWidth, height: inboundHeight, rx: 2, class: "flow-bar in", "data-index": index }));
    svg.appendChild(svgElement("rect", { x: groupX + groupWidth / 2 + gap / 2, y: y(day.outbound), width: barWidth, height: outboundHeight, rx: 2, class: "flow-bar out", "data-index": index }));
    svg.appendChild(svgElement("rect", { x: groupX, y: margin.top, width: groupWidth, height: plotHeight, fill: "transparent", "data-index": index, tabindex: "0", role: "button", "aria-label": `${dateParts(day.date).label}入库${formatNumber(day.inbound)}双，出库${formatNumber(day.outbound)}双` }));
  });

  [0, 7, 15, 23, 30].forEach((index) => addSvgText(svg, margin.left + (index + .5) * groupWidth, height - 13, dateParts(DAYS[index].date).label.replace("月", "/").replace("日", ""), "chart-axis-label", "middle"));
  svg.addEventListener("click", (event) => {
    const target = event.target.closest("[data-index]");
    if (target) selectDay(Number(target.dataset.index));
  });
  svg.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.dataset.index) selectDay(Number(event.target.dataset.index));
  });
  svg.dataset.xStart = margin.left;
  svg.dataset.groupWidth = groupWidth;
}

function updateChartSelection() {
  const stockSvg = document.querySelector("#stock-chart");
  const stockPoint = stockSvg?.querySelector(`.stock-point[data-index="${selectedIndex}"]`);
  if (stockPoint) {
    stockSvg.querySelectorAll(".stock-point").forEach((point) => point.classList.toggle("selected", point === stockPoint));
    const pointX = Number(stockPoint.getAttribute("cx"));
    const pointY = Number(stockPoint.getAttribute("cy"));
    const guide = stockSvg.querySelector("#stock-selected-guide");
    guide.setAttribute("x1", pointX);
    guide.setAttribute("x2", pointX);
    const badge = stockSvg.querySelector("#stock-selected-badge");
    const badgeX = Math.min(1050, Math.max(110, pointX));
    badge.setAttribute("transform", `translate(${badgeX} ${Math.max(48, pointY)})`);
    badge.querySelector("text").textContent = formatNumber(DAYS[selectedIndex].stock);
  }

  const flowSvg = document.querySelector("#flow-chart");
  if (flowSvg) {
    const xStart = Number(flowSvg.dataset.xStart);
    const groupWidth = Number(flowSvg.dataset.groupWidth);
    const selection = flowSvg.querySelector("#flow-selection");
    selection.setAttribute("x", xStart + selectedIndex * groupWidth);
    selection.setAttribute("width", groupWidth);
    flowSvg.querySelectorAll(".flow-bar").forEach((bar) => bar.classList.toggle("dimmed", Number(bar.dataset.index) !== selectedIndex));
  }
}

function selectDay(index) {
  selectedIndex = Math.min(DAYS.length - 1, Math.max(0, index));
  updateSelectedDay();
}

function stopPlayback() {
  if (playback) window.clearInterval(playback);
  playback = null;
  const button = document.querySelector("#play-timeline");
  button.classList.remove("is-playing");
  button.innerHTML = "<span>▶</span> 播放7月";
}

function togglePlayback() {
  if (playback) {
    stopPlayback();
    return;
  }
  if (selectedIndex >= DAYS.length - 1) selectDay(0);
  const button = document.querySelector("#play-timeline");
  button.classList.add("is-playing");
  button.innerHTML = "<span>Ⅱ</span> 暂停";
  playback = window.setInterval(() => {
    if (selectedIndex >= DAYS.length - 1) {
      stopPlayback();
      return;
    }
    selectDay(selectedIndex + 1);
  }, 520);
}

function initializeMetrics() {
  const totalInbound = DAYS.reduce((sum, day) => sum + day.inbound, 0);
  const totalOutbound = DAYS.reduce((sum, day) => sum + day.outbound, 0);
  const ending = DAYS[DAYS.length - 1];
  setText("#month-inbound", formatNumber(totalInbound));
  setText("#month-outbound", formatNumber(totalOutbound));
  setText("#month-ending-stock", formatNumber(ending.stock));
  setText("#month-ending-utilization", formatPercent(ending.utilization));
  setText("#stock-story-number", `${formatSigned(ending.stock - DAYS[0].stock)} 双`);
}

document.querySelector("#date-slider").addEventListener("input", (event) => {
  stopPlayback();
  selectDay(Number(event.target.value));
});
document.querySelector("#previous-day").addEventListener("click", () => { stopPlayback(); selectDay(selectedIndex - 1); });
document.querySelector("#next-day").addEventListener("click", () => { stopPlayback(); selectDay(selectedIndex + 1); });
document.querySelector("#play-timeline").addEventListener("click", togglePlayback);
document.querySelectorAll("[data-day-index]").forEach((button) => {
  button.addEventListener("click", () => {
    stopPlayback();
    selectDay(Number(button.dataset.dayIndex));
    document.querySelector(".day-console").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

initializeMetrics();
renderStockChart();
renderFlowChart();
updateSelectedDay();
