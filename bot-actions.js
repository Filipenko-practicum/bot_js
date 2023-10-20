import {getDate, getRandom, getTime, validPad} from "./utils.js";
import { fireBirdPool } from "./firebird.js";

const checkTimeAndSendMessage = async (bot, chat_id, staff_id, event, eventTimeStr, eventTimeStrDeclension, { DATE_EV, TIME_EV }) => {
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
	
	await bot.sendMessage(chat_id, message)
}

export function timeCheck(bot, { chat_id, staff_id }, event) {
	const eventTimeStr = event === 'morning' ? 'утренней' : 'вечерней'
	const eventTimeStrDeclension = event === 'morning' ? 'утреннем' : 'вечернем'
	
	fireBirdPool.get((err, db) => {
		if (err) {
			return this.sendMessage(chat_id, `Что то пошло не так при ${ eventTimeStr } проверке... сорян`)
		}
		
		let query = `select first 1 reg_events.staff_id, reg_events.date_ev, reg_events.time_ev from reg_events
						where staff_id = ${ staff_id }
						and date_ev = current_date
						order by ${ event === 'morning' ? 'time_ev' : 'id_reg desc'}`
		
		db.query(query, async (err, result) => {
			db.detach()
			
			if (err) {
				return this.sendMessage(chat_id, `Упс ...Ошибка при получении ${ eventTimeStr } события`)
			}
			
			if (!result.length) {
				return this.sendMessage(chat_id, `Епрст чувак данные о ${ eventTimeStrDeclension } событии в базе отсутствуют!`)
			}
			
			const [ dbEvent ] = result
			await checkTimeAndSendMessage(bot, chat_id, staff_id, event, eventTimeStr, eventTimeStrDeclension, dbEvent)
		})
	})
}

export function checkEvent(event, chatId, staffId) {
	let orderType, msgType, checkDateEvent = 'and date_ev = current_date', today = 'сегодня'
	let eveningDate = new Date(), now = new Date()
	eveningDate.setHours(17, 15)
	let dayOfWeekNow = now.getDay()
	
	if (event === 'eveningEvent' && now <= eveningDate) {
		return this.sendMessage(chatId, `Терпение чувак, день еще не закончен`)
	}
	
	if (event !== 'lastEvent' && (dayOfWeekNow === 6 || dayOfWeekNow === 0)) {
		return this.sendMessage(chatId, `Выходные же... не балуйся`)
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
	const bot = this
	fireBirdPool.get(async (err, db) => {
		if (err) {
			return this.sendMessage(chatId, `Упс... отсутствует подключение к бд`)
		}

		db.query(`select first 1
					                reg_events.staff_id,
					                reg_events.date_ev,
					                reg_events.time_ev
					                from reg_events
					                where staff_id = ${ staffId }
					                ${ checkDateEvent }
					                order by ${ orderType }`,
			async function(err, result) {
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
				
				await bot.sendMessage(chatId,
					`Твое ${ msgType } время ${ today }: ${ getTime(dbTime) } ${ getDate(dbDate) }`)
			})
	})
}

export function createEvent(chatId, staffId) {
	console.log(chatId)
	const { timeEv, dateEv } = createTime.call(this, chatId)
	console.log(`Сгенерированное время для события ${ timeEv } ${ dateEv }`)
	const bot = this
	fireBirdPool.get(function(err, db) {
		if (err && chatId) {
			console.log(`Упс... отсутствует подключение к бд`)
			return bot.sendMessage(chatId, `Упс... отсутствует подключение к бд`)
		}
		const query = `INSERT INTO REG_EVENTS (
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
			async function(err) {
				db.detach()
				if (err && chatId) {
					console.log(`Упс... Ошибка при создании события`)
					return bot.sendMessage(chatId, `Упс... Ошибка при создании события`)
				}
				console.log(`Успешный успех! Время ${ timeEv } ${ dateEv }`)
				if (chatId) {
					return await bot.sendMessage(chatId, `Успешный успех! Время ${timeEv} ${dateEv}`)
				}
			}
		)
	})
}

export function createTime(chatId) {
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
			if (chatId) {
				return this.sendMessage(chatId, `Выходные же... не балуйся`)
			}
		}
	}
	
	hours = validPad(hours)
	minutes = validPad(minutes)
	seconds = validPad(seconds)
	
	let timeEv = `${ hours }:${ minutes }:${ seconds }`
	let dateEv = getDate(today)
	return { timeEv, dateEv }
}