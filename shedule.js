import { pgPool } from "./postgres.js"
import { timeCheck } from "./bot-actions.js"
import Schedule from "node-schedule"
import { rules } from "./utils.js";

async function scheduleTimeCheck(event) {
	const client = await pgPool.connect()
	
	try {
		const { rows } = await client.query(`select staff_id, chat_id from bot_info`)
		timeCheck.bind(this)
		for (const row of rows) {
			timeCheck(row, event)
		}
	} catch (e) {
		console.log(new Date())
		console.log(e)
	} finally {
		client.release()
	}
}

export function createScheduleRules() {
	rules.forEach(({ days, hour, minute, event }) => {
		let schedule = new Schedule.RecurrenceRule()
		schedule.dayOfWeek = days
		schedule.hour = hour
		schedule.minute = minute
		scheduleTimeCheck.bind(this, event)
		Schedule.scheduleJob(schedule, scheduleTimeCheck)
	})
}
