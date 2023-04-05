import { token } from './token.js'
import { fireBirdPool } from './firebird.js'
import { pgPool } from './postgres.js'
import TelegramApi from 'node-telegram-bot-api'
import Schedule from 'node-schedule'
const morningRule = new Schedule.RecurrenceRule()
const eveningRule = new Schedule.RecurrenceRule()
const eveningFridayRule = new Schedule.RecurrenceRule()

morningRule.dayOfWeek = [ 1, 2, 3, 4, 5 ]
morningRule.hour = 8
morningRule.minute = 30

eveningRule.dayOfWeek = [ 1, 2, 3, 4 ]
eveningRule.hour = 17
eveningRule.minute = 30

eveningFridayRule.dayOfWeek = [ 5 ]
eveningFridayRule.hour = 16
eveningFridayRule.minute = 15

const checkTimeAndSendMessage = (chat_id, staff_id, event, eventTimeStr, eventTimeStrDeclension, dbEvent) => {
	const dbDate = new Date(dbEvent.DATE_EV)
	const dbTime = new Date(dbEvent.TIME_EV)
	const dayOfWeek = dbDate.getDay()
	const hours = dbTime.getHours()
	const minutes = dbTime.getMinutes()
	const lastCheck =  `${ getTime(dbTime) } ${ getDate(dbDate) }`
	
	const successMsg = `Выдыхай! Время ${ eventTimeStr } проверки сегодня: ${ lastCheck }`
	const errorMsg = `Епрст чувак данные о ${ eventTimeStrDeclension } событии отсутствуют! Последнее время ${ lastCheck }`
	
	const message = event === 'morning'
		? (hours === 8 && minutes <= 30) || hours < 8 ? successMsg : errorMsg
		: dayOfWeek !== 5
			? hours >= 17 && minutes >= 15 ? successMsg : errorMsg
			: hours >= 16 && minutes >= 0 ? successMsg : errorMsg
	
	bot.sendMessage(chat_id, message)
}
const timeCheck = ({ chat_id, staff_id }, event) => {
	const eventTimeStr = event === 'morning' ? 'утренней' : 'вечерней'
	const eventTimeStrDeclension = event === 'morning' ? 'утреннем' : 'вечернем'
	
	fireBirdPool.get((err, db) => {
		if (err) {
			return bot.sendMessage(chat_id, `Что то пошло не так при ${ eventTimeStr } проверке... сорян`)
		}
		
		let query = `select first 1 reg_events.staff_id, reg_events.date_ev, reg_events.time_ev from reg_events
						where staff_id = ${ staff_id } and date_ev = current_date order by time_ev`
		
		db.query(query, (err, result) => {
			db.detach()
			
			if (err) {
				return bot.sendMessage(chat_id, `Упс ...Ошибка при получении ${ eventTimeStr } события`)
			}
			
			if (!result.length) {
				return bot.sendMessage(chat_id, `Епрст чувак данные о ${ eventTimeStrDeclension } событии в базе отсутствуют!`)
			}
			
			const [ dbEvent ] = result
			checkTimeAndSendMessage(chat_id, staff_id, event, eventTimeStr, eventTimeStrDeclension, dbEvent)
		})
	})
}
const scheduleTimeCheck = async (event) => {
	try {
		const client = await pgPool.connect()
		const userData = await client.query(`select staff_id, chat_id from bot_info`)
		client.release()
		for (const user of userData.rows) {
			timeCheck(user, event)
		}
	} catch (e) {
		console.log(e)
	}
}

Schedule.scheduleJob(morningRule, async () => scheduleTimeCheck('morning'))
Schedule.scheduleJob(eveningRule, async () => scheduleTimeCheck('evening'))
Schedule.scheduleJob(eveningFridayRule, async () => scheduleTimeCheck('evening'))

const bot = new  TelegramApi(token, { polling: true })
bot.setMyCommands([
	{ command: '/start', description: 'старт'},
	{ command: '/info', description: 'инфо'},
	{ command: '/actions', description: 'действия'},
])
const botActions = {
	reply_markup: JSON.stringify({
		inline_keyboard: [
			[ { text: 'Утреннее время' , callback_data: 'morningEvent' } ],
			[ { text: 'Вечернее время' , callback_data: 'eveningEvent' } ],
			[ { text: 'Последнее время' , callback_data: 'lastEvent' } ],
			[ { text: 'Создать событие' , callback_data: 'createEvent' } ],
		]
	})
}
bot.on('message', msg => {
	const text = msg.text;
	const chatId = msg.chat.id;
	switch (text) {
		case '/start': return bot.sendMessage(chatId, 'Привяу')
		case '/info': return bot.sendMessage(chatId, 'Я простой бот, че с меня взять')
		case '/actions': return bot.sendMessage(chatId, 'Ты запросил доступные действия, лови:', botActions)
		default: return bot.sendMessage(chatId, 'Я тебя не понимаю')
	}
})
bot.on('callback_query', async msg => {
	const event = msg.data
	const chatId = msg.message.chat.id
	
	console.log(`Действие от ${ msg.from.username }: ${ event }`)
	console.log(new Date(Date.UTC(0, 0, 0, 5, 0, 0)).toLocaleString())
	
	pgPool.connect((connErr, client, done) => {
		if (connErr)
			return bot.sendMessage(chatId, `Что то не при подключении к бд... беда!`)
	
		const query = `select staff_id from bot_info where tg_username = '${ msg.from.username }'`
		client
			.query(query)
			.then(
				result => {
					done()
					if (!result.rows.length)
						return bot.sendMessage(chatId, `Походу друг у тебя нет прав`)
					
					const staffId = result.rows[0].staff_id
					console.log(`Получен раб. id: ${ staffId }`)
					
					if (event === 'morningEvent' || event === 'eveningEvent' || event === 'lastEvent') {
						
						let orderType, msgType, checkDateEvent = 'and date_ev = current_date', today = 'сегодня'
						let eveningDate = new Date(), now = new Date()
						eveningDate.setHours(17, 15)
						let dayOfWeekNow = now.getDay()
						
						if (event === 'eveningEvent' && now <= eveningDate) {
							return bot.sendMessage(chatId, `Чувак, день еще не закончен`)
						}
						
						if (event !== 'lastEvent' && (dayOfWeekNow === 6 || dayOfWeekNow === 0)) {
							return bot.sendMessage(chatId, `Выходные же... не балуйся`)
						}
						
						if (event === 'morningEvent') {
							orderType = 'time_ev'
							msgType = 'утреннее'
						} else if (event === 'eveningEvent'){
							orderType = 'id_reg desc'
							msgType = 'вечернее'
						} else {
							orderType = 'id_reg desc'
							msgType = 'последнее'
							checkDateEvent = ''
							today = ''
						}
						
						fireBirdPool.get(function(err, db) {
							if (err) {
								console.log(err)
								return bot.sendMessage(chatId, `Упс... отсутствует подключение к бд`)
							}
							
							db.query(`select first 1
					                reg_events.staff_id,
					                reg_events.date_ev,
					                reg_events.time_ev
					                from reg_events
					                where staff_id = ${ staffId }
					                ${ checkDateEvent }
					                order by ${ orderType }`,
								function(err, result) {
									db.detach()
									
									if (err) {
										console.log(err)
										return bot.sendMessage(chatId, `Упс... Ошибка при получении времени из базы`)
									}
									
									if (!result.length) {
										return bot.sendMessage(chatId, `Епрст... Данные в базе на сегодня отсутствуют`)
									}
									
									let dbDate = new Date(result[0].DATE_EV)
									let dbTime = new Date(result[0].TIME_EV)
									console.log(`Найденное время ${ getTime(dbTime) } ${ getDate(dbDate) }`)
									
									bot.sendMessage(chatId,
									`Твое ${ msgType } время ${ today }: ${ getTime(dbTime) } ${ getDate(dbDate) }`)
								})
						});
					}
					
					if (event === 'createEvent') {
						let today = new Date()
						let hoursNow = today.getHours()
						let minutesNow = today.getMinutes()
						let secondsNow = today.getSeconds()
						let dayOfWeekNow = today.getDay()
						let hours = hoursNow, minutes = minutesNow, seconds = secondsNow
						//console.log(dayOfWeekNow, hoursNow, minutesNow, secondsNow)
						
						if (hoursNow >= 8 && hoursNow <= 9) {
							hours = 8
							if (minutesNow > 25) {
								minutes = getRandom(20, 25)
								seconds = getRandom(5, 55)
							}
						} else {
							if (dayOfWeekNow >= 1 && dayOfWeekNow <= 4) {
								if  (hoursNow > 17 || (hoursNow === 17 && minutesNow > 20)) {
									hours = 17
									minutes = getRandom(20, 35)
									seconds = getRandom(5, 55)
								}
							} else if (dayOfWeekNow === 5) {
								if  (hoursNow > 16 || (hoursNow === 16 && minutesNow > 5)) {
									hours = 16
									minutes = getRandom(5, 15)
									seconds = getRandom(5, 55)
								}
							} else {
								return bot.sendMessage(chatId, `Выходные же... не балуйся`)
							}
						}
						
						hours = validPad(hours)
						minutes = validPad(minutes)
						seconds = validPad(seconds)
						
						let timeEv = `${ hours }:${ minutes }:${ seconds }`
						let dateEv = getDate(today)
						
						console.log(`Сгенерированное время для события ${ timeEv }  ${ dateEv }`)
						
						fireBirdPool.get(function(err, db) {
							if (err) {
								console.log(err)
								return bot.sendMessage(chatId, `Упс... отсутствует подключение к бд`)
							}
							
							let query = `INSERT INTO REG_EVENTS (
									INNER_NUMBER_EV,
									DATE_EV,
									TIME_EV,
									IDENTIFIER,
									CONFIGS_TREE_ID_CONTROLLER,
									CONFIGS_TREE_ID_RESOURCE,
									TYPE_PASS,
									CATEGORY_EV,
									SUBCATEGORY_EV,
									AREAS_ID,
									STAFF_ID,
									USER_ID,
									TYPE_IDENTIFIER,
									VIDEO_MARK,
									LAST_TIMESTAMP,
									SUBDIV_ID)
							VALUES (
									1,
									'${ dateEv }',
					                '${ timeEv }',
									(SELECT FIRST 1 IDENTIFIER FROM staff_cards WHERE STAFF_ID = ${ staffId } AND VALID = 1),
								    63791,
							        63857,
								    0,
								    0,
							        0,
							        64415,
							        ${ staffId },
					                NULL,
						            0,
						            '',
									'${ dateEv } ${ timeEv } ',
									(select max(subdiv_id) from staff_ref where staff_id = ${ staffId })
							);`
							
							db.query(query,
								function(err, result) {
									db.detach()
									if (err) {
										console.log(err)
										return bot.sendMessage(chatId, `Упс... Ошибка при создании события`)
									}
									return bot.sendMessage(chatId, `Успешный успех! Время ${ timeEv } ${ dateEv }`)
								}
							)
							
						})
					}
				})
			.catch(e => {
				console.log(e)
				done()
				return bot.sendMessage(chatId, `Что то пошло не так при идентификации... сорян`)
			})
		
	})
})

function getRandom(min, max) {
	return Math.floor(Math.random()  * (max - min)) + min
}
function validPad(num) {
	return String(num).padStart(2, '0')
}
function getDate(date) {
	const day = validPad(date.getDate())
	const month = validPad(date.getMonth() + 1)
	const year = date.getFullYear()
	return `${ day }.${ month }.${ year }`
}
function getTime(date) {
	const hours = validPad(date.getHours())
	const minutes = validPad(date.getMinutes())
	const seconds = validPad(date.getSeconds())
	return `${ hours }:${ minutes }:${ seconds }`
}