import { Sprite } from 'heks';

export const spriteSheet: Sprite[] = [
	{
		name: 'wall',
		frames: [
			{
				file: '/assets/sprites/spritesheet.png',
				origin: [16, 0],
				size: [16, 20],
			}
		],
		offset: [0, -4],
	},
]
