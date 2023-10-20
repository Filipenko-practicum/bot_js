import { token } from './token.js'
import TelegramApi from 'node-telegram-bot-api'
import { commands } from "./utils.js"
import { createScheduleRules } from "./shedule.js"
import { onMessage, onCallbackQuery } from "./bot-events.js"

const bot = new TelegramApi(token, { polling: true })

onMessage.bind(bot)
onCallbackQuery.bind(bot)
onCallbackQuery.bind(bot)
createScheduleRules.bind(bot)

await bot.setMyCommands(commands)

bot.on('message', onMessage)
bot.on('callback_query', onCallbackQuery)
