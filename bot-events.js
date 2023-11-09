import { botActions, botBossActions, executeQuery, bossChatIds } from "./utils.js";
import { pgPool } from "./postgres.js";
import { checkEvent, createEvent } from "./bot-actions.js";
import { createTime } from "./bot-actions.js";

export function onMessage({ text, chat }) {
	const chatId = chat.id;
	console.log(`chatId = ${ chatId }`)
	switch (text) {
		case '/start': return this.sendMessage(chatId, 'Привяу')
		case '/info': return this.sendMessage(chatId, 'Я простой бот, че с меня взять')
		case '/actions': return this.sendMessage(chatId, 'Ты запросил доступные действия, лови:', getActions(chatId))
		default: return this.sendMessage(chatId, 'Я тебя не понимаю')
	}
}

export async function onCallbackQuery({ data, message, from }) {
	const event = data
	const chatId = message.chat.id
	
	console.log(`Действие от ${ from.username }: ${ event }`)
	console.log(new Date())
	const client = await pgPool.connect()
	try {
		if (isFriendEvent(event)) {
			await doFriendEvent.call(this, client, event, chatId)
		} else {
			const userData = await executeQuery(client, `select staff_id from bot_info where tg_username = '${ from.username }'`)
			if (userData.length) {
				const [ user ] = userData
				if (!user) {
					return this.sendMessage(chatId, `Походу у тебя нет прав =p`)
				}
				const { staff_id } = user
				console.log(`Получен staff id: ${ staff_id }`)
				
				switch (event) {
					case 'morningEvent':
					case 'eveningEvent':
					case 'lastEvent': return checkEvent.call(this, event, chatId, staff_id)
					case 'createEvent': return createEvent.call(this, chatId, staff_id)
					case 'createFriendEvent': return getFriendStaffId.call(this, chatId, staff_id, client)
				}
			}
		}
	} catch (e) {
		await this.sendMessage(chatId, `Что то пошло не так... ` + e.message )
	} finally {
		client.release()
	}
}

async function getFriendStaffId(chatId, staffId, client) {
	const usersData = await executeQuery(client,
		`select staff_id as friend_staff_id, name as friend_name, chat_id as friend_chat_id from bot_info`
	)
	const friends = {
		reply_markup: JSON.stringify({
			inline_keyboard: [
				...usersData
					.filter(({ friend_staff_id }) => friend_staff_id !== staffId)
					.map(({ friend_staff_id, friend_name }) => {
						const data = { friendStaffId: friend_staff_id }
						return [ { text: friend_name, callback_data: JSON.stringify(data) } ]
					})
			]
		})
	}
	return this.sendMessage(chatId, 'Ты запросил своих корешей, лови:', friends)
}

function isFriendEvent(event) {
	try {
		const data = JSON.parse(event)
		return data?.friendStaffId
	} catch {
		return false
	}
}

async function doFriendEvent(client, event, chatId) {
	const { friendStaffId } = JSON.parse(event)
	const userData = await executeQuery(client, `select chat_id, name from bot_info where staff_id = ${ friendStaffId }`)
	const [ user ] = userData
	const friendChatId = user.chat_id
	const friendName = user.name
	if (friendChatId) {
		await createEvent.call(this, friendChatId, friendStaffId)
	}
	const { timeEv, dateEv } = createTime.call(this, chatId)
	await this.sendMessage(chatId, `Топчик! Ты создал событие за своего кореша - ${ friendName }! Время ${ timeEv } ${ dateEv }`)
}

function getActions(chatId) {
	return bossChatIds.includes(chatId) ? botBossActions : botActions
}