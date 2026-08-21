<script setup>
import { computed } from "vue";
import {
  firingChartSeries,
  formatFiringDuration,
  FIRING_FULL_RATE,
} from "../labels";

const props = defineProps({
  segments: { type: Array, default: () => [] },
});

const fillId = `firing-fill-${Math.random().toString(36).slice(2, 8)}`;

const W = 360;
const H = 208;
const PL = 40;
const PR = 12;
const PT = 16;
const PB = 30;
const PLOT_W = W - PL - PR;
const PLOT_H = H - PT - PB;

const series = computed(() => firingChartSeries(props.segments));

const chart = computed(() => {
  const { points, durationMin, maxTemp, minTemp } = series.value;
  if (points.length < 2 || durationMin <= 0) return null;

  const yMax = Math.max(100, Math.ceil(maxTemp / 100) * 100);
  const yMin = Math.min(0, Math.floor(minTemp / 50) * 50);
  const ySpan = Math.max(1, yMax - yMin);
  const xMax = Math.max(30, Math.ceil(durationMin / 30) * 30);

  const xOf = (timeMin) => PL + (timeMin / xMax) * PLOT_W;
  const yOf = (temp) => PT + (1 - (temp - yMin) / ySpan) * PLOT_H;

  const line = points
    .map((point, index) => {
      const x = xOf(point.timeMin).toFixed(1);
      const y = yOf(point.temp).toFixed(1);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const area = `${line} L ${xOf(points[points.length - 1].timeMin).toFixed(1)} ${yOf(yMin).toFixed(1)} L ${xOf(0).toFixed(1)} ${yOf(yMin).toFixed(1)} Z`;

  const yTicks = [];
  const yStep = ySpan > 600 ? 200 : 100;
  for (let temp = yMin; temp <= yMax; temp += yStep) {
    yTicks.push({
      temp,
      y: yOf(temp),
      label: `${temp}`,
    });
  }

  const xTicks = [];
  const xStep = xMax > 480 ? 120 : xMax > 180 ? 60 : 30;
  for (let time = 0; time <= xMax; time += xStep) {
    xTicks.push({
      time,
      x: xOf(time),
      label: time >= 60 ? `${(time / 60).toLocaleString("nl-NL")} u` : `${time} m`,
    });
  }

  return {
    line,
    area,
    yTicks,
    xTicks,
    dots: points.map((point) => ({
      x: xOf(point.timeMin),
      y: yOf(point.temp),
      kind: point.kind,
    })),
    duration: formatFiringDuration(durationMin),
    peak: Math.round(maxTemp),
  };
});
</script>

<template>
  <div v-if="chart" class="firing-chart">
    <svg
      class="firing-chart-svg"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="`Stookgrafiek, piek ${chart.peak} °C, duur ${chart.duration}`"
    >
      <defs>
        <linearGradient :id="fillId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#b85c38" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#b85c38" stop-opacity="0.02" />
        </linearGradient>
      </defs>

      <line
        v-for="tick in chart.yTicks"
        :key="`yg-${tick.temp}`"
        :x1="PL"
        :x2="W - PR"
        :y1="tick.y"
        :y2="tick.y"
        class="firing-chart-grid"
      />
      <line
        v-for="tick in chart.xTicks"
        :key="`xg-${tick.time}`"
        :x1="tick.x"
        :x2="tick.x"
        :y1="PT"
        :y2="H - PB"
        class="firing-chart-grid"
      />

      <path :d="chart.area" class="firing-chart-area" :fill="`url(#${fillId})`" />
      <path :d="chart.line" class="firing-chart-line" />

      <circle
        v-for="(dot, index) in chart.dots"
        :key="`d-${index}`"
        :cx="dot.x"
        :cy="dot.y"
        r="2.6"
        class="firing-chart-dot"
        :class="`is-${dot.kind}`"
      />

      <text
        v-for="tick in chart.yTicks"
        :key="`yl-${tick.temp}`"
        :x="PL - 6"
        :y="tick.y + 3"
        class="firing-chart-label firing-chart-label-y"
      >
        {{ tick.label }}
      </text>
      <text
        v-for="tick in chart.xTicks"
        :key="`xl-${tick.time}`"
        :x="tick.x"
        :y="H - 10"
        class="firing-chart-label firing-chart-label-x"
      >
        {{ tick.label }}
      </text>
    </svg>
    <p class="firing-chart-caption muted">
      Piek {{ chart.peak.toLocaleString("nl-NL") }} °C · duur
      {{ chart.duration }}. Vol is getekend als
      {{ FIRING_FULL_RATE.toLocaleString("nl-NL") }} °C/u.
    </p>
  </div>
</template>
