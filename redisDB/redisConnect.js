const redis = require('redis');

//Configure redis client ---->
const redisClient = redis.createClient({
  password: 'tVpsiQkb7Vy54LUSB1W5Qm2ODTI0e0hp',
  socket: {
      host: 'redis-14673.c289.us-west-1-2.ec2.cloud.redislabs.com',
      port: 14673
  }
})
//let redisClient = redis.createClient()
const connectRedis = async () => {
  // connect to redis
  await redisClient.connect()

  // handle error
  redisClient.on('error', (err) => {
      console.error(`An error occurred with Redis: ${err}`)
  })

  console.log('Redis connected successfully...')
}

module.exports = {redisClient, connectRedis};