/**
 * 歩留まり統計: チャート描画モジュール
 *
 * このモジュールはEChartsを使用した統計グラフの描画を担当します。
 * 箱ひげ図、ヒストグラム、散布図、Q-Qプロット、正規分布曲線などをサポートします。
 * EChartsは必要な時にのみ動的にロードされます（遅延ロード）。
 */

import { logger } from './core/logger.js';
import { loadECharts, toggleLoadingIndicator } from './lazy-loader.js';
import { qs } from './dom-utils.js';
import { toFixed } from './calculation.js';

// EChartsインスタンス（モジュール内で管理）
let statsChartInstance = null;
let echartsLib = null; // EChartsライブラリの参照

/**
 * 統計チャートを描画（遅延ロード対応版）
 *
 * @param {number[]} values - データ値の配列
 * @param {Object} stats - calculateStatistics()の戻り値
 * @param {string} typeName - データタイプ名（表示用）
 * @param {string} unit - 単位（'%', 'g' など）
 */
export async function renderStatsChart(values, stats, typeName, unit) {
  const chartTypeSelect = qs('#chartTypeSelect');
  const chartType = chartTypeSelect?.value || 'boxplot';

  const chartDom = qs('#statsChart');
  if (!chartDom) return;

  try {
    // ローディング表示
    toggleLoadingIndicator(chartDom, true);

    // EChartsを遅延ロード（初回のみロード、2回目以降はキャッシュ使用）
    if (!echartsLib) {
      echartsLib = await loadECharts();
    }

    // ローディング非表示
    toggleLoadingIndicator(chartDom, false);

    // 既存のインスタンスがあれば破棄
    if (statsChartInstance) {
      statsChartInstance.dispose();
    }

    // EChartsインスタンスを初期化
    statsChartInstance = echartsLib.init(chartDom);

    // グラフタイプに応じた描画
    let option;
    switch (chartType) {
      case 'boxplot':
        option = createBoxplotOption(values, stats, typeName, unit);
        break;
      case 'histogram':
        option = createHistogramOption(values, stats, typeName, unit);
        break;
      case 'scatter':
        option = createScatterOption(values, stats, typeName, unit);
        break;
      case 'normal':
        option = createNormalDistOption(values, stats, typeName, unit);
        break;
      case 'qqplot':
        option = createQQPlotOption(values, stats, typeName, unit);
        break;
      default:
        option = createBoxplotOption(values, stats, typeName, unit);
    }

    statsChartInstance.setOption(option);

    // ウィンドウリサイズ時にチャートもリサイズ（一度だけリスナーを登録）
    if (!window.__statsChartResizeListener) {
      window.__statsChartResizeListener = () => {
        if (statsChartInstance) {
          statsChartInstance.resize();
        }
      };
      window.addEventListener('resize', window.__statsChartResizeListener);
    }
  } catch (error) {
    // エラーハンドリング
    toggleLoadingIndicator(chartDom, false);
    logger.error('Failed to render chart:', error);

    // XSS対策: error.messageをtextContentで安全に設定
    const errorContainer = document.createElement('div');
    errorContainer.className = 'chart-error';

    const errorTitle = document.createElement('p');
    errorTitle.textContent = '⚠️ チャートの読み込みに失敗しました';

    const errorDetail = document.createElement('p');
    errorDetail.className = 'error-detail';
    errorDetail.textContent = error.message;

    errorContainer.appendChild(errorTitle);
    errorContainer.appendChild(errorDetail);
    chartDom.innerHTML = '';
    chartDom.appendChild(errorContainer);
  }
}

/**
 * 箱ひげ図のオプションを生成
 */
function createBoxplotOption(values, stats, typeName, unit) {
  const sortedValues = stats.sorted;
  const q1 = stats.q1;
  const q2 = stats.median;
  const q3 = stats.q3;
  const min = stats.min;
  const max = stats.max;

  // 外れ値を計算（IQR法）
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outliers = sortedValues
    .filter(v => v < lowerBound || v > upperBound)
    .map(v => [0, v]);

  // ひげの範囲
  const whiskerLow = Math.max(min, lowerBound);
  const whiskerHigh = Math.min(max, upperBound);

  return {
    title: {
      text: `${typeName}の箱ひげ図`,
      left: 'center'
    },
    tooltip: {
      trigger: 'item',
      formatter: function(params) {
        if (params.componentSubType === 'boxplot') {
          return `
            最大値: ${toFixed(params.data[5], 2)}${unit}<br/>
            Q3: ${toFixed(params.data[4], 2)}${unit}<br/>
            中央値: ${toFixed(params.data[3], 2)}${unit}<br/>
            Q1: ${toFixed(params.data[2], 2)}${unit}<br/>
            最小値: ${toFixed(params.data[1], 2)}${unit}
          `;
        } else {
          return `外れ値: ${toFixed(params.data[1], 2)}${unit}`;
        }
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%'
    },
    xAxis: {
      type: 'category',
      data: [typeName],
      boundaryGap: true,
      nameGap: 30,
      splitArea: {
        show: false
      },
      splitLine: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      name: unit,
      splitArea: {
        show: true
      }
    },
    series: [
      {
        name: 'boxplot',
        type: 'boxplot',
        data: [[whiskerLow, q1, q2, q3, whiskerHigh]],
        itemStyle: {
          borderColor: '#3398DB',
          borderWidth: 2
        },
        boxWidth: [10, 40]
      },
      {
        name: 'outlier',
        type: 'scatter',
        data: outliers,
        symbolSize: 8,
        itemStyle: {
          color: '#d32f2f'
        }
      }
    ]
  };
}

/**
 * ヒストグラムのオプションを生成
 */
function createHistogramOption(values, stats, typeName, unit) {
  // ビン数を決定（Sturgesの公式）
  const binCount = Math.ceil(Math.log2(values.length) + 1);
  const binWidth = (stats.max - stats.min) / binCount;

  // ビンを作成
  const bins = Array(binCount).fill(0);
  const binEdges = Array(binCount + 1).fill(0).map((_, i) => stats.min + i * binWidth);

  // データをビンに振り分け
  values.forEach(value => {
    const binIndex = Math.min(
      Math.floor((value - stats.min) / binWidth),
      binCount - 1
    );
    bins[binIndex]++;
  });

  // X軸のラベル（ビンの中央値）
  const binLabels = bins.map((_, i) => {
    const binCenter = stats.min + (i + 0.5) * binWidth;
    return toFixed(binCenter, 1);
  });

  return {
    title: {
      text: `${typeName}のヒストグラム`,
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: function(params) {
        const binIndex = params[0].dataIndex;
        const count = params[0].data;
        const rangeStart = toFixed(binEdges[binIndex], 2);
        const rangeEnd = toFixed(binEdges[binIndex + 1], 2);
        return `${rangeStart}${unit} - ${rangeEnd}${unit}<br/>度数: ${count}`;
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%'
    },
    xAxis: {
      type: 'category',
      data: binLabels,
      name: unit,
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: '度数'
    },
    series: [{
      data: bins,
      type: 'bar',
      itemStyle: {
        color: '#3398DB'
      },
      barWidth: '80%'
    }]
  };
}

/**
 * 散布図のオプションを生成
 */
function createScatterOption(values, stats, typeName, unit) {
  const scatterData = values.map((value, index) => [index + 1, value]);

  return {
    title: {
      text: `${typeName}の散布図`,
      left: 'center'
    },
    tooltip: {
      trigger: 'item',
      formatter: function(params) {
        return `サンプル${params.data[0]}: ${toFixed(params.data[1], 2)}${unit}`;
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%'
    },
    xAxis: {
      type: 'value',
      name: 'サンプル番号',
      min: 0
    },
    yAxis: {
      type: 'value',
      name: unit
    },
    series: [
      {
        symbolSize: 10,
        data: scatterData,
        type: 'scatter',
        itemStyle: {
          color: '#3398DB'
        }
      },
      {
        type: 'line',
        data: [[1, stats.mean], [values.length, stats.mean]],
        lineStyle: {
          color: '#d32f2f',
          width: 2,
          type: 'dashed'
        },
        symbol: 'none',
        name: '平均値'
      }
    ]
  };
}

/**
 * 折れ線グラフのオプションを生成
 */
function createLineOption(values, stats, typeName, unit) {
  const lineData = values.map((value, index) => [index + 1, value]);

  return {
    title: {
      text: `${typeName}の折れ線グラフ`,
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        return `サンプル${params[0].data[0]}: ${toFixed(params[0].data[1], 2)}${unit}`;
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%'
    },
    xAxis: {
      type: 'value',
      name: 'サンプル番号',
      min: 0
    },
    yAxis: {
      type: 'value',
      name: unit
    },
    series: [
      {
        data: lineData,
        type: 'line',
        smooth: true,
        itemStyle: {
          color: '#3398DB'
        },
        areaStyle: {
          color: 'rgba(51, 152, 219, 0.2)'
        }
      },
      {
        type: 'line',
        data: [[1, stats.mean], [values.length, stats.mean]],
        lineStyle: {
          color: '#d32f2f',
          width: 2,
          type: 'dashed'
        },
        symbol: 'none',
        name: '平均値'
      }
    ]
  };
}

/**
 * 正規分布曲線のオプションを生成
 */
function createNormalDistOption(values, stats, typeName, unit) {
  const mean = stats.mean;
  const stdDev = stats.stdDev;

  // 正規分布曲線の生成（±3σの範囲）
  const xMin = mean - 3 * stdDev;
  const xMax = mean + 3 * stdDev;
  const steps = 100;
  const step = (xMax - xMin) / steps;

  const normalCurveData = [];
  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * step;
    const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) *
              Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
    normalCurveData.push([x, y]);
  }

  // ヒストグラム用のビン作成
  const binCount = Math.ceil(Math.log2(values.length) + 1);
  const binWidth = (stats.max - stats.min) / binCount;
  const bins = Array(binCount).fill(0);
  const binEdges = Array(binCount + 1).fill(0).map((_, i) => stats.min + i * binWidth);

  values.forEach(value => {
    const binIndex = Math.min(
      Math.floor((value - stats.min) / binWidth),
      binCount - 1
    );
    bins[binIndex]++;
  });

  // 正規化（確率密度に変換）
  const totalArea = bins.reduce((sum, count) => sum + count * binWidth, 0);
  const normalizedBins = bins.map((count, i) => {
    const binCenter = stats.min + (i + 0.5) * binWidth;
    return [binCenter, count / totalArea];
  });

  return {
    title: {
      text: `${typeName}の正規分布曲線`,
      left: 'center'
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['データ分布', '正規分布'],
      bottom: 10
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%'
    },
    xAxis: {
      type: 'value',
      name: unit
    },
    yAxis: {
      type: 'value',
      name: '確率密度'
    },
    series: [
      {
        name: 'データ分布',
        type: 'bar',
        data: normalizedBins,
        itemStyle: {
          color: 'rgba(51, 152, 219, 0.6)'
        },
        barWidth: binWidth * 0.8
      },
      {
        name: '正規分布',
        type: 'line',
        data: normalCurveData,
        smooth: true,
        lineStyle: {
          color: '#d32f2f',
          width: 2
        },
        symbol: 'none'
      }
    ]
  };
}

/**
 * バイオリンプロットのオプションを生成
 */
function createViolinOption(values, stats, typeName, unit) {
  // カーネル密度推定（簡易版）
  const bandwidth = 1.06 * stats.stdDev * Math.pow(values.length, -0.2);
  const steps = 50;
  const yMin = stats.min - stats.stdDev;
  const yMax = stats.max + stats.stdDev;
  const step = (yMax - yMin) / steps;

  const densityData = [];
  for (let i = 0; i <= steps; i++) {
    const y = yMin + i * step;
    let density = 0;
    values.forEach(value => {
      const u = (y - value) / bandwidth;
      density += (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
    });
    density = density / (values.length * bandwidth);
    densityData.push(density);
  }

  // 密度を左右対称に配置
  const maxDensity = Math.max(...densityData);
  const violinLeft = densityData.map((d, i) => [-d / maxDensity, yMin + i * step]);
  const violinRight = densityData.map((d, i) => [d / maxDensity, yMin + i * step]);

  return {
    title: {
      text: `${typeName}のバイオリンプロット`,
      left: 'center'
    },
    tooltip: {
      trigger: 'item'
    },
    grid: {
      left: '20%',
      right: '10%',
      bottom: '15%'
    },
    xAxis: {
      type: 'value',
      show: false,
      min: -1.2,
      max: 1.2
    },
    yAxis: {
      type: 'value',
      name: unit
    },
    series: [
      {
        type: 'line',
        data: violinLeft.concat(violinRight.reverse()),
        lineStyle: {
          color: '#3398DB',
          width: 2
        },
        areaStyle: {
          color: 'rgba(51, 152, 219, 0.3)'
        },
        symbol: 'none',
        smooth: true
      },
      {
        type: 'scatter',
        data: [[0, stats.median]],
        symbolSize: 10,
        itemStyle: {
          color: '#fff',
          borderColor: '#d32f2f',
          borderWidth: 2
        }
      }
    ]
  };
}

/**
 * 累積分布関数(CDF)のオプションを生成
 */
function createCDFOption(values, stats, typeName, unit) {
  const sortedValues = stats.sorted;
  const cdfData = sortedValues.map((value, index) => {
    return [value, (index + 1) / sortedValues.length];
  });

  return {
    title: {
      text: `${typeName}の累積分布関数`,
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        return `${toFixed(params[0].data[0], 2)}${unit}<br/>累積確率: ${toFixed(params[0].data[1] * 100, 1)}%`;
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%'
    },
    xAxis: {
      type: 'value',
      name: unit
    },
    yAxis: {
      type: 'value',
      name: '累積確率',
      min: 0,
      max: 1,
      axisLabel: {
        formatter: function(value) {
          return (value * 100).toFixed(0) + '%';
        }
      }
    },
    series: [{
      data: cdfData,
      type: 'line',
      smooth: false,
      step: 'end',
      itemStyle: {
        color: '#3398DB'
      },
      lineStyle: {
        width: 2
      },
      symbol: 'circle',
      symbolSize: 6
    }]
  };
}

/**
 * Q-Qプロットのオプションを生成
 */
function createQQPlotOption(values, stats, typeName, unit) {
  const sortedValues = stats.sorted;
  const n = sortedValues.length;

  // 理論的な分位点を計算
  const qqData = sortedValues.map((value, index) => {
    const p = (index + 0.5) / n;
    const theoreticalQuantile = approximateNormalQuantile(p);
    const standardizedValue = (value - stats.mean) / stats.stdDev;
    return [theoreticalQuantile, standardizedValue];
  });

  // 45度線のデータ
  const minQ = Math.min(...qqData.map(d => d[0]));
  const maxQ = Math.max(...qqData.map(d => d[0]));
  const referenceLine = [[minQ, minQ], [maxQ, maxQ]];

  return {
    title: {
      text: `${typeName}のQ-Qプロット`,
      left: 'center'
    },
    tooltip: {
      trigger: 'item',
      formatter: function(params) {
        return `理論値: ${toFixed(params.data[0], 2)}<br/>実測値: ${toFixed(params.data[1], 2)}`;
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%'
    },
    xAxis: {
      type: 'value',
      name: '理論分位点'
    },
    yAxis: {
      type: 'value',
      name: '標準化された実測値'
    },
    series: [
      {
        type: 'scatter',
        data: qqData,
        symbolSize: 8,
        itemStyle: {
          color: '#3398DB'
        }
      },
      {
        type: 'line',
        data: referenceLine,
        lineStyle: {
          color: '#d32f2f',
          width: 2,
          type: 'dashed'
        },
        symbol: 'none',
        name: '正規分布'
      }
    ]
  };
}

/**
 * 正規分布の分位点を近似計算（Beasley-Springer-Moro法の簡易版）
 *
 * @param {number} p - 累積確率（0 < p < 1）
 * @returns {number} 標準正規分布の分位点
 */
function approximateNormalQuantile(p) {
  // 境界値の処理
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Beasley-Springer-Moro法の簡易実装
  const a = [
    -3.969683028665376e+01,
    2.209460984245205e+02,
    -2.759285104469687e+02,
    1.383577518672690e+02,
    -3.066479806614716e+01,
    2.506628277459239e+00
  ];

  const b = [
    -5.447609879822406e+01,
    1.615858368580409e+02,
    -1.556989798598866e+02,
    6.680131188771972e+01,
    -1.328068155288572e+01
  ];

  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
    4.374664141464968e+00,
    2.938163982698783e+00
  ];

  const d = [
    7.784695709041462e-03,
    3.224671290700398e-01,
    2.445134137142996e+00,
    3.754408661907416e+00
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q, r, x;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
         ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  return x;
}
