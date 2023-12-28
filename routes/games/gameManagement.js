const express = require('express')
const router = express.Router();
var blitzBoutManager = require("./blitzBoutManagement") 

router.use("/BlitzBout", blitzBoutManager)

module.exports = router