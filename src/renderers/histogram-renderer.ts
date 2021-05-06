import { PricedValue } from '../model/price-scale';
import { SeriesItemsIndexesRange, TimedValue, TimePointIndex } from '../model/time-data';

import { CandlestickItem } from './candlesticks-renderer';
import { IPaneRenderer } from './ipane-renderer';
// import { Coordinate } from '../model/coordinate';

const showSpacingMinimalBarWidth = 1;
const alignToMinimalWidthLimit = 4;

export interface HistogramItem extends PricedValue, TimedValue {
	color: string;
	barData: CandlestickItem;
}

export interface PaneRendererHistogramData {
	items: HistogramItem[];

	barSpacing: number;
	histogramBase: number;

	visibleRange: SeriesItemsIndexesRange | null;
}

interface PrecalculatedItemCoordinates {
	left: number;
	right: number;
	roundedCenter: number;
	center: number;
	time: TimePointIndex;
}

export class PaneRendererHistogram implements IPaneRenderer {
	private _data: PaneRendererHistogramData | null = null;
	private _precalculatedCache: PrecalculatedItemCoordinates[] = [];

	public setData(data: PaneRendererHistogramData): void {
		this._data = data;
		this._precalculatedCache = [];
	}

	public draw(ctx: CanvasRenderingContext2D, pixelRatio: number, isHovered: boolean, hitTestData?: unknown): void {
		if (this._data === null || this._data.items.length === 0 || this._data.visibleRange === null) {
			return;
		}
		if (!this._precalculatedCache.length) {
			this._fillPrecalculatedCache(pixelRatio);
		}

		const tickWidth = Math.max(1, Math.floor(pixelRatio));
		const histogramBase = Math.round((this._data.histogramBase) * pixelRatio);
		const topHistogramBase = histogramBase - Math.floor(tickWidth / 2);
		const bottomHistogramBase = topHistogramBase + tickWidth;

		for (let i = this._data.visibleRange.from; i < this._data.visibleRange.to; i++) {
			const item = this._data.items[i];
			const current = this._precalculatedCache[i - this._data.visibleRange.from];
			const y = Math.round(item.y * pixelRatio);
			ctx.fillStyle = item.color;

			let top: number;
			let bottom: number;

			if (y <= topHistogramBase) {
				top = y;
				bottom = bottomHistogramBase;
			} else {
				top = topHistogramBase;
				bottom = y - Math.floor(tickWidth / 2) + tickWidth;
			}

			ctx.fillRect(current.left, top, current.right - current.left + 1, bottom - top);
		}
	}

	// private _getStandardDeviation(volumes: number[]): number {
	// 	const n = volumes.length;
	// 	const mean = volumes.reduce((a: number, b: number) => a + b) / n;
	// 	return Math.sqrt(volumes.map((x: number) => Math.pow(x - mean, 2)).reduce((a: number, b: number) => a + b) / n);
	// }

	// eslint-disable-next-line complexity
	private _fillPrecalculatedCache(pixelRatio: number): void {
		if (this._data === null || this._data.items.length === 0 || this._data.visibleRange === null) {
			this._precalculatedCache = [];
			return;
		}
		const spacing = Math.ceil(this._data.barSpacing * pixelRatio) <= showSpacingMinimalBarWidth ? 0 : Math.max(1, Math.floor(pixelRatio));
		const columnWidth = Math.round(this._data.barSpacing * pixelRatio) - spacing;

		this._precalculatedCache = new Array(this._data.visibleRange.to - this._data.visibleRange.from);

		// const stdDev = this._getStandardDeviation(this._data.items.map(item => item.y));
		// const newBars = this._data.items.reduce((stored: CandlestickItem[], bar: CandlestickItem, index: number) => {
		// 	let barWidth = this._barWidth;
		// 	if (bar.volume >= stdDev && bar.volume <= (2 * stdDev)) {
		// 		barWidth = this._barWidth + 10.0;
		// 	} else if (bar.volume >= (2 * stdDev)) {
		// 		barWidth = this._barWidth + 20.0;
		// 	}
		// 	const left = index > 0 ? stored[index - 1].x + stored[index - 1].barWidth! : Math.round(bar.x * pixelRatio) - Math.floor(barWidth * 0.5);
		// 	stored.push({ ...bar, x: left as Coordinate, barWidth });
		// 	return stored;
		// }, []);
		for (let i = this._data.visibleRange.from; i < this._data.visibleRange.to; i++) {
			const item = this._data.items[i];
			// force cast to avoid ensureDefined call
			const x = Math.round(item.x * pixelRatio);
			let left: number;
			let right: number;

			if (columnWidth % 2) {
				const halfWidth = (columnWidth - 1) / 2;
				left = x - halfWidth;
				right = x + halfWidth;
			} else {
				// shift pixel to left
				const halfWidth = columnWidth / 2;
				left = x - halfWidth;
				right = x + halfWidth - 1;
			}
			this._precalculatedCache[i - this._data.visibleRange.from] = {
				left,
				right,
				roundedCenter: x,
				center: (item.x * pixelRatio),
				time: item.time,
			};
		}

		// correct positions
		for (let i = this._data.visibleRange.from + 1; i < this._data.visibleRange.to; i++) {
			const current = this._precalculatedCache[i - this._data.visibleRange.from];
			const prev = this._precalculatedCache[i - this._data.visibleRange.from - 1];
			if (current.time !== prev.time + 1) {
				continue;
			}
			if (current.left - prev.right !== (spacing + 1)) {
				// have to align
				if (prev.roundedCenter > prev.center) {
					// prev wasshifted to left, so add pixel to right
					prev.right = current.left - spacing - 1;
				} else {
					// extend current to left
					current.left = prev.right + spacing + 1;
				}
			}
		}

		let minWidth = Math.ceil(this._data.barSpacing * pixelRatio);
		for (let i = this._data.visibleRange.from; i < this._data.visibleRange.to; i++) {
			const current = this._precalculatedCache[i - this._data.visibleRange.from];
			// this could happen if barspacing < 1
			if (current.right < current.left) {
				current.right = current.left;
			}
			const width = current.right - current.left + 1;
			minWidth = Math.min(width, minWidth);
		}

		if (spacing > 0 && minWidth < alignToMinimalWidthLimit) {
			for (let i = this._data.visibleRange.from; i < this._data.visibleRange.to; i++) {
				const current = this._precalculatedCache[i - this._data.visibleRange.from];
				const width = current.right - current.left + 1;
				if (width > minWidth) {
					if (current.roundedCenter > current.center) {
						current.right -= 1;
					} else {
						current.left += 1;
					}
				}
			}
		}
	}
}
