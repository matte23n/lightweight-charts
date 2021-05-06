import { TimePoint, TimePointIndex } from './time-data';

/**
 * Plot's index in plot list tuple for series
 */
export const enum PlotRowValueIndex {
	Open = 0,
	High = 1,
	Low = 2,
	Close = 3,
	Volume = 4,
	VolumeBuy = 5,
	VolumeSell = 6,
}

export type PlotRowValue = [
	number, // open
	number, // high
	number, // low
	number, // close
	number, // volume
	number, // volumeBuy
	number, // volumeSell
];

export interface PlotRow {
	readonly index: TimePointIndex;
	readonly time: TimePoint;
	readonly value: PlotRowValue;
}
