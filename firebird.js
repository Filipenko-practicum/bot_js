import * as Firebird from 'node-firebird'

const options = {
    host: '172.27.2.180',
    port: 3050,
    database: 'C:\\Program Files (x86)\\PERCo\\PERCo-S-20\\Base\\SCD17K.FDB',
    user: 'SCD17_user',
    password: 'scd17_password',
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
    retryConnectionInterval: 1000,
    blobAsText: false
}

const fireBirdPool = Firebird.pool(5, options)
export { fireBirdPool }