import { fillRectInnerBorder } from '../helpers/canvas-helpers';

import { SeriesItemsIndexesRange } from '../model/time-data';

import { BarCandlestickItemBase } from './bars-renderer';
import { IPaneRenderer } from './ipane-renderer';
import { optimalCandlestickWidth } from './optimal-bar-width';
import { Coordinate } from '../model/coordinate';

export interface CandlestickItem extends BarCandlestickItemBase {
	color: string;
	borderColor: string;
	wickColor: string;
}

export interface PaneRendererCandlesticksData {
	bars: readonly CandlestickItem[];

	barSpacing: number;

	wickVisible: boolean;
	borderVisible: boolean;

	visibleRange: SeriesItemsIndexesRange | null;
}

const enum Constants {
	BarBorderWidth = 1,
}

export class PaneRendererCandlesticks implements IPaneRenderer {
	private _data: PaneRendererCandlesticksData | null = null;

	// scaled with pixelRatio
	private _barWidth: number = 0;

	public setData(data: PaneRendererCandlesticksData): void {
		this._data = data;
	}

	public draw(ctx: CanvasRenderingContext2D, pixelRatio: number, isHovered: boolean, hitTestData?: unknown): void {
		if (this._data === null || this._data.bars.length === 0 || this._data.visibleRange === null) {
			return;
		}

		// now we know pixelRatio and we could calculate barWidth effectively
		this._barWidth = optimalCandlestickWidth(this._data.barSpacing, pixelRatio);

		// grid and crosshair have line width = Math.floor(pixelRatio)
		// if this value is odd, we have to make candlesticks' width odd
		// if this value is even, we have to make candlesticks' width even
		// in order of keeping crosshair-over-candlesticks drawing symmetric
		if (this._barWidth >= 2) {
			const wickWidth = Math.floor(pixelRatio);
			if ((wickWidth % 2) !== (this._barWidth % 2)) {
				this._barWidth--;
			}
		}

		const bars = this._data.bars;
		const stdDev = this._getStandardDeviation(bars.slice(Math.max(bars.length - 5, 0)));
		const newBars = bars.reduce((stored: CandlestickItem[], bar: CandlestickItem, index: number) => {
			let barWidth = this._barWidth;
			if (bar.volume >= stdDev && bar.volume <= (2 * stdDev)) {
				barWidth = this._barWidth + 10.0;
			} else if (bar.volume >= (2 * stdDev)) {
				barWidth = this._barWidth + 20.0;
			}
			const left = index > 0 ? stored[index - 1].x + stored[index - 1].barWidth! : Math.round(bar.x * pixelRatio) - Math.floor(barWidth * 0.5);
			stored.push({ ...bar, x: left as Coordinate, barWidth });
			return stored;
		}, []);
		if (this._data.wickVisible) {
			this._drawWicks(ctx, newBars, this._data.visibleRange, pixelRatio);
		}

		if (this._data.borderVisible) {
			this._drawBorder(ctx, newBars, this._data.visibleRange, this._data.barSpacing, pixelRatio);
		}

		const borderWidth = this._calculateBorderWidth(pixelRatio);

		if (!this._data.borderVisible || this._barWidth > borderWidth * 2) {
			this._drawCandles(ctx, newBars, this._data.visibleRange, pixelRatio);
		}
	}

	private _drawWicks(ctx: CanvasRenderingContext2D, bars: readonly CandlestickItem[], visibleRange: SeriesItemsIndexesRange, pixelRatio: number): void {
		if (this._data === null) {
			return;
		}
		// let prevWickColor = '';

		let wickWidth = Math.min(Math.floor(pixelRatio), Math.floor(this._data.barSpacing * pixelRatio));
		wickWidth = Math.max(Math.floor(pixelRatio), Math.min(wickWidth, this._barWidth));

		for (let i = visibleRange.from; i < visibleRange.to; i++) {
			const bar = bars[i];

			const top = Math.round(Math.min(bar.openY, bar.closeY) * pixelRatio);
			const bottom = Math.round(Math.max(bar.openY, bar.closeY) * pixelRatio);

			const high = Math.round(bar.highY * pixelRatio);
			const low = Math.round(bar.lowY * pixelRatio);

			let left = (bar.x + (bar.barWidth! / 2)) - 3;
			const right = left + wickWidth - 1;
			left = Math.min(left, right);
			const width = right - left + 1;

			ctx.fillStyle = '#ffffff';
			ctx.fillRect(left, high, width, top - high);
			ctx.fillRect(left, bottom + 1, width, low - bottom);
		}
	}

	private _calculateBorderWidth(pixelRatio: number): number {
		let borderWidth = Math.floor(Constants.BarBorderWidth * pixelRatio);
		if (this._barWidth <= 2 * borderWidth) {
			borderWidth = Math.floor((this._barWidth - 1) * 0.5);
		}
		const res = Math.max(Math.floor(pixelRatio), borderWidth);
		if (this._barWidth <= res * 2) {
			// do not draw bodies, restore original value
			return Math.max(Math.floor(pixelRatio), Math.floor(Constants.BarBorderWidth * pixelRatio));
		}
		return res;
	}

	private _drawBorder(ctx: CanvasRenderingContext2D, bars: readonly CandlestickItem[], visibleRange: SeriesItemsIndexesRange, barSpacing: number, pixelRatio: number): void {
		if (this._data === null) {
			return;
		}
		let prevBorderColor: string | undefined = '';
		const borderWidth = this._calculateBorderWidth(pixelRatio);

		let prevEdge: number | null = null;

		for (let i = visibleRange.from; i < visibleRange.to; i++) {
			const bar = bars[i];
			if (bar.borderColor !== prevBorderColor) {
				ctx.fillStyle = bar.borderColor;
				prevBorderColor = bar.borderColor;
			}

			let left = Math.round(bar.x * pixelRatio) - Math.floor(this._barWidth * 0.5);
			// this is important to calculate right before patching left
			const right = left + this._barWidth - 1;

			const top = Math.round(Math.min(bar.openY, bar.closeY) * pixelRatio);
			const bottom = Math.round(Math.max(bar.openY, bar.closeY) * pixelRatio);

			if (prevEdge !== null) {
				left = Math.max(prevEdge + 1, left);
				left = Math.min(left, right);
			}
			if (this._data.barSpacing * pixelRatio > 2 * borderWidth) {
				fillRectInnerBorder(ctx, left, top, right - left + 1, bottom - top + 1, borderWidth);
			} else {
				const width = right - left + 1;
				ctx.fillRect(left, top, width, bottom - top + 1);
			}
			prevEdge = right;
		}
	}

	private _getStandardDeviation(bars: readonly CandlestickItem[]): number {
		const n = bars.length;
		const candlesToConsider: number[] = bars.map((b: CandlestickItem) => Number(b.volume));
		const mean = candlesToConsider.reduce((a: number, b: number) => a + b) / n;
		return Math.sqrt(candlesToConsider.map((x: number) => Math.pow(x - mean, 2)).reduce((a: number, b: number) => a + b) / n);
	}

	private _drawCandles(ctx: CanvasRenderingContext2D, bars: readonly CandlestickItem[], visibleRange: SeriesItemsIndexesRange, pixelRatio: number): void {
		if (this._data === null) {
			return;
		}

		// i pass only the last 5 candles
		// const stdDev = this._getStandardDeviation(bars.slice(Math.max(bars.length - 5, 0)));

		let prevBarColor = '';
		// let prevBarRight = 0;

		const borderWidth = this._calculateBorderWidth(pixelRatio);
		// let barWidth = this._barWidth;

		for (let i = visibleRange.from; i < visibleRange.to; i++) {
			const bar = bars[i];
			//
			// if (bar.volume >= stdDev && bar.volume <= (2 * stdDev)) {
			// 	barWidth = this._barWidth + 10.0;
			// } else if (bar.volume >= (2 * stdDev)) {
			// 	barWidth = this._barWidth + 20.0;
			// }

			let top = Math.round(Math.min(bar.openY, bar.closeY) * pixelRatio);
			let bottom = Math.round(Math.max(bar.openY, bar.closeY) * pixelRatio);

			let left = bar.x as number;
			let right = left + bar.barWidth! - 1;
			if (bar.color !== prevBarColor) {
				const barColor = bar.color;
				ctx.fillStyle = barColor;
				prevBarColor = barColor;
			}

			if (this._data.borderVisible) {
				left += borderWidth;
				top += borderWidth;
				right -= borderWidth;
				bottom -= borderWidth;
			}

			if (top > bottom) {
				continue;
			}
			const ratioBuy = bar.volumeBuy / bar.volume;
			const ratioSell = bar.volumeSell / bar.volume;
			const height = bottom - top + 1;
			const heightBuy = ratioBuy * height;
			const heightSell = ratioSell * height;
			if (bar.open > bar.close) {
				ctx.fillStyle = '#7e57c2';
			} else {
				ctx.fillStyle = '#d1c4e9';
			}
			ctx.fillRect(left, top, right - left - 3, heightBuy);
			if (bar.open > bar.close) {
				ctx.fillStyle = '#d1c4e9';
			} else {
				ctx.fillStyle = '#7e57c2';
			}
			ctx.fillRect(left, top + heightBuy, right - left - 3, heightSell);
			// prevBarRight = right;
		}
	}
}
