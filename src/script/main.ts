import arrayWithout from "@bakkerjoeri/array-without";
import objectWithout from "@bakkerjoeri/object-without";
import repeat from "@bakkerjoeri/repeat";
import { add, multiplyByComponents, multiplyByScalar } from "dotspace";
import { clearCanvas, Loop, setupCanvas } from "heks";
import { choose, getRandomNumberInRange } from "roll-the-bones";
import lanternMetrics from "../assets/fonts/Lantern/metrics";
import birdseedMetrics from "../assets/fonts/Birdseed/metrics";
import magicbookMetrics from "../assets/fonts/MagicBook/metrics";
import { EaseFunction, easeLinear, easeOutQuint, easeOutSine } from "./easing";
import { drawText, registerFont } from "./text";
import { Position, Size } from "./types";
import { creatures } from "./creatures";

interface UpdateEvent {
	time: number;
	elapsed: number;
}
interface DrawEvent {
	time: number;
	canvas: HTMLCanvasElement;
	context: CanvasRenderingContext2D;
}

const { canvas, context } = setupCanvas('.game', [1024, 640]);
registerFont('lantern', lanternMetrics, '/assets/fonts/Lantern/atlas.png');
registerFont('birdseed', birdseedMetrics, '/assets/fonts/Birdseed/atlas.png');
registerFont('magicbook', magicbookMetrics, '/assets/fonts/Magicbook/atlas.png');
const defaultFont = 'birdseed';

let previousTime = 0;
const loop = new Loop((time: number) => {
	const elapsed = time - previousTime;
	update({ time, elapsed });
	draw({ time,canvas, context });
	previousTime = time;
});

interface CardProperties {
	type: CardType;
	name: string;
	description?: string;
	flavor?: string;
	illustration?: string;
}

interface CreatureCardProperties extends CardProperties {
	type: 'creature';
	health: number;
	strength: number;
	defense: number;
}

type CardType = 'item' | 'event' | 'trinket' | 'creature';

interface PositionAnimation {
	startTime?: number;
	fromPosition?: Position;
	toPosition: Position;
	duration: number;
	easeFunction: EaseFunction
	elapsed?: number;
}

function createGridOfSize(size: Size) {
	const map: any[][] = [];

	repeat(size[0], (x) => {
		map[x] = [];

		repeat(size[1], (y) => {
			map[x][y] = null;
		});
	});

	return map;
}

class Entity {
	public position: Position = [0, 0];
	public size: Size = [0, 0];

	private animationQueue: PositionAnimation[] = [];
	private currentAnimation: PositionAnimation | undefined;

	update({ time, elapsed }: UpdateEvent) {
		this.doAnimation(time, elapsed);
	}

	draw(event: DrawEvent) {}

	public addAnimation(duration: number, toPosition: Position, easeFunction: EaseFunction = easeLinear) {
		this.animationQueue.push({
			duration,
			easeFunction,
			toPosition,
		});
	}

	public cancelAnimations() {
		this.currentAnimation = undefined;
		this.animationQueue = [];
	}

	private doAnimation(time: number, elapsed: number) {
		if (!this.currentAnimation && !this.animationQueue.length) {
			return;
		}

		if (!this.currentAnimation) {
			this.currentAnimation = this.animationQueue.shift() as PositionAnimation;
			this.currentAnimation.fromPosition = [...this.position];
			this.currentAnimation.startTime = time;
			this.currentAnimation.elapsed = this.currentAnimation.elapsed || 0
		}

		if (this.currentAnimation.elapsed! > this.currentAnimation.duration) {
			this.currentAnimation = undefined;
			return;
		}

		this.position = [
			Math.round(this.currentAnimation.easeFunction(
				this.currentAnimation.elapsed!,
				this.currentAnimation.fromPosition![0],
				this.currentAnimation.toPosition![0] - this.currentAnimation.fromPosition![0],
				this.currentAnimation.duration,
			)),
			Math.round(this.currentAnimation.easeFunction(
				this.currentAnimation.elapsed!,
				this.currentAnimation.fromPosition![1],
				this.currentAnimation.toPosition![1] - this.currentAnimation.fromPosition![1],
				this.currentAnimation.duration,
			)),
		];

		this.currentAnimation.elapsed! += elapsed / 1000;
	}
}

class Board extends Entity {
	drawPile: Card[] = [];
	discardPile: Card[] = [];
	grid: (Card | null)[][] = createGridOfSize([3, 3]);

	private gridPosition: Position = [192, 16];
	private drawPilePosition: Position = [16, 16];
	private discardPilePosition: Position = [16, 192];

	draw(event: DrawEvent) {
		super.draw(event);

		this.grid.forEach((row, x) => {
			row.forEach((card, y) => {
				this.drawCardHolder(
					add(this.gridPosition, multiplyByComponents([x, y], [144, 176])) as Position,
					event.context
				);
			});
		});

		this.drawCardHolder(this.drawPilePosition, event.context);
		this.drawCardHolder(this.discardPilePosition, event.context);
	}

	drawCardHolder(position: Position, context: CanvasRenderingContext2D) {
		context.strokeRect(
			position[0] + 3,
			position[1] + 3,
			128 - (2 * 3),
			160 - (2 * 3)
		);
	}

	deal() {
		this.grid.forEach((gridRow, x) => {
			gridRow.forEach((card, y) => {
				if (card === null && this.drawPile.length) {
					const newCard = this.drawPile.shift()!;
					newCard.isFaceUp = true;
					this.moveCardToGrid(newCard, [x, y]);
				}
			});
		});
	}

	getCardInGridPosition(position: Position): Card | undefined {
		if (!this.hasPosition(position)) {
			throw new Error(`No grid cell with position ${position[0]}, ${position[1]}.`);
		}

		if (!this.grid[position[0]][position[1]]) {
			return;
		}

		return this.grid[position[0]][position[1]] as Card;
	}

	findCardPositionInGrid(card: Card): Position | undefined {
		let position: Position | undefined;

		this.grid.forEach((gridRow, x) => {
			gridRow.forEach((gridCell, y) => {
				if (gridCell === card) {
					position = [x, y];
				}
			});
		});

		return position;
	}

	hasPosition(position: Position): boolean {
		return this.grid[position[0]] !== undefined && this.grid[position[0]][position[1]] !== undefined;
	}
	
	moveCardToGrid(card: Card, position: Position) {
		if (!this.hasPosition(position)) {
			throw new Error(`No grid cell with position ${position[0]}, ${position[1]}.`);
		}

		if (this.getCardInGridPosition(position)) {
			throw new Error(`Grid cell ${position[0]}, ${position[1]} already contains a card.`);
		}

		this.removeCardEverywhere(card);
		this.grid[position[0]][position[1]] = card;
		card.isFaceUp = true;
		card.addAnimation(0.25, add(this.gridPosition, multiplyByComponents(position, [144, 176])) as Position, easeOutQuint);
	}

	moveToDrawPile(...cards: Card[]) {
		cards.forEach((card) => {
			this.removeCardEverywhere(card);
			this.drawPile.push(card);
			card.addAnimation(0.25, this.drawPilePosition, easeOutQuint);
		});
	}

	removeCardEverywhere(card: Card) {
		this.drawPile = arrayWithout(this.drawPile, card);
		this.discardPile = arrayWithout(this.discardPile, card);
		this.grid.forEach((gridRow, x) => {
			gridRow.forEach((gridCell, y) => {
				if (gridCell === card) {
					this.grid[x][y] = null;
				}
			});
		});
	}
}

class Card extends Entity {
	isFaceUp: boolean = true;
	properties: CardProperties;
	size: Size = [128, 160];

	constructor(properties: CardProperties) {
		super();
		this.properties = properties;
	}

	draw(event: DrawEvent) {
		super.draw(event);
		const { context } = event;

		if (this.isFaceUp) {
			context.fillStyle = 'lightblue';
			context.fillRect(this.position[0], this.position[1], this.size[0], this.size[1]);

			drawText(
				this.properties.name,
				[ Math.round(this.position[0] + this.size[0] / 2), this.position[1] + 10 ],
				defaultFont,
				context,
				{ baseline: 'top', align: 'center', }
			);

			if (this.properties.description) {
				drawText(
					this.properties.description,
					[ this.position[0] + 5, this.position[1] + 92 ],
					defaultFont,
					context,
					{ baseline: 'top', align: 'left', }
				);
			}
		} else {
			context.fillStyle = 'darkred';
			context.fillRect(this.position[0], this.position[1], this.size[0], this.size[1]);
		}
	}
}

class CreatureCard extends Card {
	properties: CreatureCardProperties;
	constructor(properties: CreatureCardProperties) {
		super(properties);
		this.properties = properties;
	}

	draw(drawEvent: DrawEvent) {
		super.draw(drawEvent);

		if (this.isFaceUp) {
			drawText(
				`hp: ${this.properties.health}`,
				[ this.position[0] + 5, this.position[1] + this.size[1] - 5 ],
				defaultFont,
				context,
				{ baseline: 'bottom', align: 'left', }
			);
	
			drawText(
				`def: ${this.properties.defense}`,
				[ this.position[0] + (this.size[0] / 2), this.position[1] + this.size[1] - 5 ],
				defaultFont,
				context,
				{ baseline: 'bottom', align: 'center', }
			);
	
			drawText(
				`str: ${this.properties.strength}`,
				[ this.position[0] + this.size[0] - 5, this.position[1] + this.size[1] - 5 ],
				defaultFont,
				context,
				{ baseline: 'bottom', align: 'right', }
			);
		}
	}
}

class Dice extends Entity {
	public size = [32, 32] as Size;
	public sides = 6;
	public value = 0;

	private handlers: { [handlerType: string]: Array<(...args: any[]) => any> } = {};
	private oneTimeHandlers: { [handlerType: string]: Array<(...args: any[]) => any> } = {};

	private isRolling = false;
	private rollDuration = 0;

	constructor(sides: Dice['sides']) {
		super();
		this.sides = sides;
	}

	update(event: UpdateEvent) {
		super.update(event);

		if (this.isRolling && this.rollDuration === 0) {
			this.isRolling = false;
			this.trigger('result', this.value);
		}

		if (this.isRolling && this.rollDuration > 0) {
			this.rollDuration = Math.max(0, this.rollDuration - (event.elapsed / 1000));
			this.value = getRandomNumberInRange(1, this.sides);
		}
	}

	draw({ context }: DrawEvent) {
		context.fillStyle = 'white';
		context.fillRect(this.position[0], this.position[1], 32, 32);
		drawText(this.value.toString(), add(this.position, [this.size[0] / 2, this.size[1] / 2 - 4]) as Position, defaultFont, context, { color: '#000000', baseline: 'top', align: 'center' });
	}

	async roll(): Promise<number> {
		this.isRolling = true;
		this.rollDuration = 0.5;
		this.addAnimation(
			this.rollDuration,
			add(this.position, [
				getRandomNumberInRange(0, 32),
				getRandomNumberInRange(0, 32),
			], [-16, -16]) as Position,
			easeOutSine
		);

		return new Promise((resolve) => {
			this.once('result', (value: number) => {
				setTimeout(() => {
					entities = arrayWithout(entities, this);
				}, 1000);
				resolve(value);
			});
		});
	}

	once(name: string, handler: (...args: any[]) => any) {
		if (!this.oneTimeHandlers[name]) {
			this.oneTimeHandlers[name] = [];
		}

		this.oneTimeHandlers[name].push(handler);
	}

	on(name: string, handler: () => any) {
		if (!this.handlers[name]) {
			this.handlers[name] = [];
		}

		this.handlers[name].push(handler);
	}

	removeEventHandler(name: string, handler: (...args: any[]) => any) {
		if (this.handlers[name]) {
			this.handlers = arrayWithout(this.handlers as any, handler) as any;
		}

		if (this.oneTimeHandlers[name]) {
			this.oneTimeHandlers = arrayWithout(this.oneTimeHandlers as any, handler) as any;
		}
	}

	removeAllEventHandlers(name: string) {
		this.oneTimeHandlers = objectWithout(this.oneTimeHandlers, name);
		this.handlers = objectWithout(this.handlers, name);
	}

	trigger(name: string, ...args: any[]) {
		const handlers = [
			...(this.handlers[name] || []),
			...(this.oneTimeHandlers[name] || [])
		];

		this.oneTimeHandlers = objectWithout(this.oneTimeHandlers, name);
		
		handlers.forEach(handler => handler(...args));
	}
}

let board = new Board();
let entities: Entity[] = [];

function createDeck(ofCards: number): Card[] {
	const deck: Card[] = [];
	const creatureOptions = Object.values(creatures);
	repeat(ofCards, () => {
		const card = new CreatureCard({
			type: 'creature',
			...choose(creatureOptions),
		});
		card.isFaceUp = false;
		deck.push(card);
	});

	return deck;
}
const player = new CreatureCard({
	name: 'Rogue',
	type: 'creature',
	description: 'It\'s you!',
	defense: 2,
	strength: 0,
	health: 4,
});

window.addEventListener('keydown', async (event) => {
	if (event.repeat) {
		return;
	}

	if (event.key === 'r') {
		event.preventDefault();
		const dice = new Dice(6);
		dice.position = add(player.position, multiplyByScalar(-0.5, dice.size), multiplyByScalar(0.5, player.size)) as Position;
		entities.push(dice);
		const value = await dice.roll();
	}

	if (event.key === 'ArrowUp') {
		event.preventDefault();
		actInDirection(board, player, [0, -1]);
	}
	
	if (event.key === 'ArrowRight') {
		event.preventDefault();
		actInDirection(board, player, [1, 0]);
	}

	if (event.key === 'ArrowDown') {
		event.preventDefault();
		actInDirection(board, player, [0, 1]);
	}

	if (event.key === 'ArrowLeft') {
		event.preventDefault();
		actInDirection(board, player, [-1, 0]);
	}
});

async function actInDirection(board: Board, card: CreatureCard, direction: Position) {
	const currentPosition = board.findCardPositionInGrid(card);

	if (!currentPosition) {
		return;
	}

	const newPosition = add(currentPosition, direction) as Position;

	if (!board.hasPosition(newPosition)) {
		return;
	}

	const cardInPosition = board.getCardInGridPosition(newPosition);

	// If the space is empty, move there.
	if (!cardInPosition) {
		board.moveCardToGrid(card, newPosition);
		return;
	}

	if (cardInPosition.properties.type === 'creature') {
		const target = cardInPosition as CreatureCard;
		await attack(card, target);

		if (target.properties.health === 0) {
			entities = arrayWithout(entities, target);
			board.removeCardEverywhere(target);
			board.moveCardToGrid(card, newPosition);
			board.deal();
			return;
		}

		attack(target, card);
	}
}

async function attack(attacker: CreatureCard, target: CreatureCard) {
	const dice = new Dice(6);
	dice.position = add(attacker.position, multiplyByScalar(-0.5, dice.size), multiplyByScalar(0.5, attacker.size)) as Position;
	entities.push(dice);
	const value = await dice.roll();

	if (value >= target.properties.defense) {
		target.properties.health -= 1;
	}
}

function update(event: UpdateEvent) {
	entities.forEach(entity => {
		entity.update(event);
	});
}

function draw(event: DrawEvent) {
	clearCanvas(canvas, context, '#ffffff');
	entities.forEach(entity => {
		entity.draw(event);
	});
}

loop.start();

entities.push(board);
entities.push(player);
board.moveCardToGrid(player, [1, 1]);

const deck = createDeck(24);
entities.push(...deck);
board.moveToDrawPile(...deck);
board.deal();
