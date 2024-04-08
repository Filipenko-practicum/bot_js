import PG from 'pg'

const connectionObj = {
    host: "172.27.15.31",
    user: "postgres",
    password: "mec2022",
    database: 'infodesk_db',
    port: "5434",
}

const pgPool = new PG.Pool(connectionObj)

export { pgPool }