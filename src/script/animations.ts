export class Tweeny {
	private from: number;
	private to: number;
	private duration: number;
	private render: (values: any) => any;
	private easing: EaseFunction;

	private startTime: number = 0;
	private elapsedTime: number = 0;

	constructor(
		from: number,
		to: number,
		duration: number,
		render: (values: number) => any,
		easing: EaseFunction = easeLinear,
	) {
		this.from = from;
		this.to = to;
		this.duration = duration;
		this.render = render;
		this.easing = easing;
	}

	public async animate(): Promise<Tweeny> {
		return new Promise<Tweeny>((resolve) => {
			window.requestAnimationFrame((time: number) => {
				this.startTime = time;
				this.process(time, resolve);
			});
		});
	}

	private process(time: number, resolve: (value: Tweeny) => void) {
		this.elapsedTime = time - this.startTime;
		this.render(this.easing(Math.min(this.elapsedTime, this.duration), this.from, this.to - this.from, this.duration));

		if (this.elapsedTime <= this.duration) {
			window.requestAnimationFrame((time: number) => {
				this.process(time, resolve);
			});
		} else {
			resolve(this);
		}
	}
}

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
