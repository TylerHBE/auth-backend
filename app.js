const express = require("express");
const app = express();
const bodyParser = require('body-parser');
// require database connection 
const dbConnect = require("./mongoDB/dbConnect");
// encryption for password + other data
const auth = require("./auth");
var cors = require('cors')
// Get route
var accountManagement = require("./routes/accountManagement");
var gameManagement = require("./routes/games/gameManagement");

// execute database connection 
dbConnect();

/** Cross Origin Resource Sharing (CORS) is a W3C standard that allows a server to relax the same-origin policy. 
 * Using CORS, a server can explicitly allow some cross-origin requests while rejecting others. 
 */
// router.use(cors()); 
app.use(cors({ origin: 'http://localhost:3000' }));

// body parser configuration
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (request, response, next) => {
  response.json({ message: "Hey! This is your server response!" });
  next();
});

// example free endpoint
app.get("/free-endpoint", (request, response) => {
  response.json({ message: "You are free to access me anytime" });
});

// example authentication endpoint
app.get("/auth-endpoint", auth, (request, response) => {
  response.json({ message: "You are authorized to access me" });
});

/*


  Actual code



*/

app.use("/account", accountManagement);
app.use("/games", gameManagement)

module.exports = {app};