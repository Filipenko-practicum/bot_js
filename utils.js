export const getRandom = (min, max) => {
	return Math.floor(Math.random()  * (max - min)) + min
}
export const validPad = (num) => {
	return String(num).padStart(2, '0')
}
export const getDate = (date) => {
	const day = validPad(date.getDate())
	const month = validPad(date.getMonth() + 1)
	const year = date.getFullYear()
	return `${ day }.${ month }.${ year }`
}
export const getTime = (date) => {
	const hours = validPad(date.getHours())
	const minutes = validPad(date.getMinutes())
	const seconds = validPad(date.getSeconds())
	return `${ hours }:${ minutes }:${ seconds }`
}
export const rules = [
	{ days: [ 1, 2, 3, 4, 5 ], hour: 8, minute: 28, event: 'morning' } ,
	{ days: [ 1, 2, 3, 4 ], hour: 17, minute: 30, event: 'evening' },
	{ days: [ 5 ], hour: 16, minute: 15 , event: 'evening' }
]
const actions = [
	[ { text: 'Утреннее время' , callback_data: 'morningEvent' } ],
	[ { text: 'Вечернее время' , callback_data: 'eveningEvent' } ],
	[ { text: 'Последнее время' , callback_data: 'lastEvent' } ],
	[ { text: 'Создать событие' , callback_data: 'createEvent' } ]
]

const actions_loser = [
	[ { text: 'Утреннее время' , callback_data: 'morningEvent' } ],
	[ { text: 'Вечернее время' , callback_data: 'eveningEvent' } ],
	[ { text: 'Последнее время' , callback_data: 'lastEvent' } ],
]

export const botActions = {
	reply_markup: JSON.stringify({
		inline_keyboard: actions
	})
}

export const botActionLoser = {
	reply_markup: JSON.stringify({
		inline_keyboard: actions_loser
	})
}

export const botBossActions = {
	reply_markup: JSON.stringify({
		inline_keyboard: actions.concat([ [ { text: 'Создать событие для кореша', callback_data: 'createFriendEvent' } ] ])
	})
}
export const commands = [
	{ command: '/start', description: 'старт' },
	{ command: '/info', description: 'инфо' },
	{ command: '/actions', description: 'действия' },
]

export async function executeQuery(client, query) {
	const { rows } = await client.query(query)
	return rows
}

export const ASUSChatIds = [ 258485890, 6800855090, 547845135, 461848672, 1994229291, 333620725 ]  // Архаров А., Грецу Р., Шаранов М., Чернев М., Филипенко А., Кильметов А.

export const bossChatIds = [ 295452043, 430236268, 173400017 ] // Ярослав, Георгий, Цветков А.