export type EaseFunction = (time: number, start: number, change: number, duration: number) => number;

export const easeLinear: EaseFunction =  (time, start, change, duration) => {
	return change * time / duration + start;
}

export const easeOutSine: EaseFunction = (time, start, change, duration) => {
	return change * Math.sin(time / duration * (Math.PI/2)) + start;
}

export const easeOutQuint: EaseFunction = (time, start, change, duration) => {
	return change * (Math.pow(time / duration - 1, 5) + 1) + start;
}

