export interface Creature {
	name: string,
	defense: number,
	strength: number,
	health: number,
	description?: string,
}

export const creatures: { [name: string]: Creature } = {
	willOTheWhisp: {
		name: 'Will \'o the Wisp',
		health: 1,
		strength: 1,
		defense: 2,
	},
	gargoyle: {
		name: 'Gargoyle',
		health: 10,
		strength: 0,
		defense: 1,
	},
	wraith: {
		name: 'Wraith',
		health: 5,
		strength: 4,
		defense: 2,
	},
}
