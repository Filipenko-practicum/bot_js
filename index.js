import { token } from './token.js'
import { fireBirdPool } from './firebird.js'
import { pgPool } from './postgres.js'
import TelegramApi from 'node-telegram-bot-api'
import Schedule from 'node-schedule'

const rules = [
	{ days: [ 1, 2, 3, 4, 5 ], hour: 8, minute: 30, event: 'morning' } ,
	{ days: [ 1, 2, 3, 4 ], hour: 17, minute: 30, event: 'evening' },
	{ days: [ 5 ], hour: 16, minute: 15 , event: 'evening' }
]
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
const checkTimeAndSendMessage = (chat_id, staff_id, event, eventTimeStr, eventTimeStrDeclension, { DATE_EV, TIME_EV }) => {
	const dbDate = new Date(DATE_EV)
	const dbTime = new Date(TIME_EV)
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
						where staff_id = ${ staff_id }
						and date_ev = current_date
						order by ${ event === 'morning' ? 'time_ev' : 'id_reg desc'}`
		
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
		console.log(new Date())
		console.log(e)
	}
}
const getRandom = (min, max) => {
	return Math.floor(Math.random()  * (max - min)) + min
}
const validPad = (num) => {
	return String(num).padStart(2, '0')
}
const getDate = (date) => {
	const day = validPad(date.getDate())
	const month = validPad(date.getMonth() + 1)
	const year = date.getFullYear()
	return `${ day }.${ month }.${ year }`
}
const getTime = (date) => {
	const hours = validPad(date.getHours())
	const minutes = validPad(date.getMinutes())
	const seconds = validPad(date.getSeconds())
	return `${ hours }:${ minutes }:${ seconds }`
}
const createScheduleRules = (rules) => {
	rules.forEach(({ days, hour, minute, event }) => {
		let schedule = new Schedule.RecurrenceRule()
		schedule.dayOfWeek = days
		schedule.hour = hour
		schedule.minute = minute
		Schedule.scheduleJob(schedule, async () => scheduleTimeCheck(event))
	})
}
const checkOtherEvent = (event, chatId, staffId) => {
	let orderType, msgType, checkDateEvent = 'and date_ev = current_date', today = 'сегодня'
	let eveningDate = new Date(), now = new Date()
	eveningDate.setHours(17, 15)
	let dayOfWeekNow = now.getDay()
	
	if (event === 'eveningEvent' && now <= eveningDate) {
		return bot.sendMessage(chatId, `Терпение чувак, день еще не закончен`)
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
	
	fireBirdPool.get((err, db) => {
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
				
				const { TIME_EV, DATE_EV } = result[0]
				let dbDate = new Date(DATE_EV)
				let dbTime = new Date(TIME_EV)
				console.log(`Найденное время ${ getTime(dbTime) } ${ getDate(dbDate) }`)
				
				bot.sendMessage(chatId,
					`Твое ${ msgType } время ${ today }: ${ getTime(dbTime) } ${ getDate(dbDate) }`)
			})
	})
}
const checkCreateEvent = (event, chatId, staffId) => {
	let today = new Date()
	let hoursNow = today.getHours()
	let minutesNow = today.getMinutes()
	let secondsNow = today.getSeconds()
	let dayOfWeekNow = today.getDay()
	let hours = hoursNow, minutes = minutesNow, seconds = secondsNow
	
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
const bot = new TelegramApi(token, { polling: true })

createScheduleRules(rules)

bot.setMyCommands([
	{ command: '/start', description: 'старт'},
	{ command: '/info', description: 'инфо'},
	{ command: '/actions', description: 'действия'},
])
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
	console.log(new Date())
	
	try {
		const client = await pgPool.connect()
		const staffData = await client.query(`select staff_id from bot_info where tg_username = '${ msg.from.username }'`)
		client.release()
		
		if (!staffData.rows.length) {
			return bot.sendMessage(chatId, `Походу у тебя нет прав, одни обязанности`)
		}
		const staffId = staffData.rows[0].staff_id
		console.log(`Получен staff id: ${ staffId }`)
		
		switch (event) {
			case 'morningEvent':
			case 'eveningEvent':
			case 'lastEvent': return checkOtherEvent(event, chatId, staffId)
			case 'createEvent': return checkCreateEvent(event, chatId, staffId)
		}
	} catch (e) {
		bot.sendMessage(chatId, `Что то пошло не так... ` + e.message )
		console.log(new Date())
		console.log(e)
	}
})
