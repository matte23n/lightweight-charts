import { Nominal } from '../helpers/nominal';

import { Coordinate } from './coordinate';

export type BarPrice = Nominal<number, 'BarPrice'>;

export interface BarPrices {
	open: BarPrice;
	high: BarPrice;
	low: BarPrice;
	close: BarPrice;
	volume: BarPrice;
	volumeBuy: BarPrice;
	volumeSell: BarPrice;
}

export interface BarCoordinates {
	openY: Coordinate;
	highY: Coordinate;
	lowY: Coordinate;
	closeY: Coordinate;
}
