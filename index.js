const http = require('http');
const { app } = require('./app');
const { Server } = require('socket.io');
const jwt = require("jsonwebtoken");
// Redis DB
var { connectRedis, redisClient } = require("./redisDB/redisConnect")
var bblSortLeaderboard = require("./functionals/bubbleSortLeaderboard")

// execute database connection 
connectRedis();

const normalizePort = val => {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }
  if (port >= 0) {
    return port;
  }
  return false;
};
const port = normalizePort(process.env.PORT || '8080');
app.set('port', port);

const errorHandler = error => {
  if (error.syscall !== 'listen') {
    throw error;
  }
  const address = server.address();
  const bind = typeof address === 'string' ? 'pipe ' + address : 'port: ' + port;
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges.');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use.');
      process.exit(1);
      break;
    default:
      throw error;
  }
};

const server = http.createServer(app);

server.on('error', errorHandler);
server.on('listening', () => {
  const address = server.address();
  const bind = typeof address === 'string' ? 'pipe ' + address : 'port ' + port;
  console.log('Listening on ' + bind);
});

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000'
  }
});

io.on('connection', (socket) => {

  console.log("socket connected");

  function updateState(newGameObject, gameRoom) {

    try {
      switch (newGameObject.gameState) {
        case "lobby":
          console.log("loading lobby...")
          io.to(gameRoom).emit("updatePlayers", newGameObject.users)
          break;
        case "leaderboard":
          console.log("loading leaderboard...")
          leaderboardData(newGameObject, gameRoom)
          break;
        case "finalLeaderboard":
          console.log("loading final leaderboard...")
          leaderboardData(newGameObject, gameRoom)
          break;
        case "question":
          console.log("loading question...")
          questionData(newGameObject, gameRoom)
          break;
        case "answers":
          console.log("loading answers...")
          answersData(newGameObject, gameRoom)
          break;
        case "endGame":
          console.log("loading endgame...")
          io.to(gameRoom).emit("endGame")
          break;
        default:
          console.log("loading default...")
          io.to(gameRoom).emit("updatePlayers", newGameObject.users)
          break;
      }

      socket.emit("gameState", newGameObject.gameState)
      socket.emit("gameName", newGameObject.gameSetting.name)
    }
    catch (error) {
      io.to(gameRoom).emit("updateStateError", error)
      io.to(gameRoom).emit("error", error)
    }

  }

  function leaderboardData(newGameObject, gameRoom) {

    try {
      var leaderboard = [];
      for (var g = 0; g < newGameObject.users.length; g++) {
        leaderboard.push({
          email: newGameObject.users[g].email,
          score: newGameObject.users[g].score,
          username: newGameObject.users[g].username,
          avatar: newGameObject.users[g].avatar,
          place: g + 1
        })
      }
      bblSortLeaderboard(leaderboard)

      io.to(gameRoom).emit("gameState", newGameObject.gameState)
      io.to(gameRoom).emit("leaderboardData", leaderboard)
    }
    catch (error) {
      io.to(gameRoom).emit("leaderboardDataFail", error)
      io.to(gameRoom).emit("error", error)
      console.log("Error loading leaderboard: " + error)
    }
  }

  function questionData(newGameObject, gameRoom) {

    try {
      const questionData = {
        question: newGameObject.gameSetting.questions[newGameObject.questionNum].question,
        answers: []
      }
      for (var q = 0; q < newGameObject.gameSetting.questions[newGameObject.questionNum].answers.length; q++) {
        questionData.answers.push({ answerText: newGameObject.gameSetting.questions[newGameObject.questionNum].answers[q].answerText })
      }
      io.to(gameRoom).emit("gameState", newGameObject.gameState)
      io.to(gameRoom).emit("questionData", questionData)
      io.to(gameRoom).emit("questionState", "unanswered")
    }
    catch (error) {
      console.log("questionDataFail: " + error)
      io.to(gameRoom).emit("error", error)
    }
  }

  function answersData(newGameObject, gameRoom) {
    try {
      var answerData = {
        question: newGameObject.gameSetting.questions[0].question,
        answers: []
      }
      for (var q = 0; q < newGameObject.gameSetting.questions[newGameObject.questionNum].answers.length; q++) {
        answerData.answers.push({ answerText: newGameObject.gameSetting.questions[newGameObject.questionNum].answers[q].answerText, state: newGameObject.gameSetting.questions[newGameObject.questionNum].answers[q].state })
      }

      var AnswersData = []
      for (var g = 0; g < newGameObject.answers.length; g++) {
        if (newGameObject.answers[g].questionNum == newGameObject.questionNum) {
          const userIndex = newGameObject.users.findIndex((element) => element.email === newGameObject.answers[g].email)
          AnswersData.push({ email: newGameObject.answers[g].email, answer: newGameObject.answers[g].answer, points: newGameObject.answers[g].score, score: newGameObject.users[userIndex].score })
        }
      }

      io.to(gameRoom).emit("gameState", newGameObject.gameState)
      io.to(gameRoom).emit("answerData", answerData)
      io.to(gameRoom).emit("AnswersData", AnswersData)

    }
    catch (error) {
      console.log("newAnswersFail: " + error)
      io.to(gameRoom).emit("error", error)
    }
  }

  socket.on("joinGame", async (args) => {

    var token = args.token;
    var email = args.email;
    var gameRoom = args.gameKey;

    var game = undefined
    if (gameRoom) {
      game = await redisClient.get(gameRoom)
    }
    if (game) {

      var gameObject = JSON.parse(game)
      if (gameObject) {

        if (token) {

          try {

            //check if the token matches the supposed origin
            const decodedToken = await jwt.verify(token, "RANDOM-TOKEN");

            if (gameObject.users.some((user) => JSON.stringify(user.token) === JSON.stringify(decodedToken) && user.email === email)) {

              if (gameObject.sockets.some((socket) => socket.email === email)) {
                if (gameObject.sockets.some((socket) => socket.socketID === socket.id && socket.email === email)) {
                  socket.join(gameRoom)
                  updateState(gameObject, gameRoom)
                  console.log("Socket rejoin")
                }
                else {
                  var indexSocket = gameObject.sockets.findIndex((element) => element.email === email)
                  gameObject.sockets[indexSocket].socketID = socket.id

                  const resultSet = await redisClient.set(gameRoom, JSON.stringify(gameObject))
                  if (resultSet) {

                    const newGame = await redisClient.get(gameRoom)
                    if (newGame) {
                      var newGameObject = JSON.parse(newGame)
                      if (newGameObject) {
                        socket.join(gameRoom)
                        updateState(newGameObject, gameRoom)
                        console.log("Socket rejoined, id change")
                      }
                      else {
                        socket.emit("joinFail", "game set incorrectly, err")
                        console.log("joinFail, game set incorrectly, err")
                      }
                    }
                    else {
                      socket.emit("joinFail", "Get operation failed. Entered into game but not able to get data from server, retry.")
                      console.log("joinFail, Get operation failed. Entered into game but not able to get data from server, retry.")
                    }

                  }
                  else {
                    socket.emit("joinFail", "Set operation failed, retry.")
                    console.log("joinFail, Set operation failed, retry.")
                  }
                }
              }
              else {
                gameObject.sockets.push({
                  email: email,
                  socketID: socket.id,
                })

                const resultSet = await redisClient.set(gameRoom, JSON.stringify(gameObject))
                if (resultSet) {

                  const newGame = await redisClient.get(gameRoom)
                  if (newGame) {
                    var newGameObject = JSON.parse(newGame)
                    if (newGameObject) {
                      socket.join(gameRoom)
                      updateState(newGameObject, gameRoom)
                      console.log("Socket joined")
                    }
                    else {
                      socket.emit("joinFail", "game set incorrectly, err")
                      console.log("joinFail, game set incorrectly, err")
                    }
                  }
                  else {
                    socket.emit("joinFail", "Get operation failed. Entered into game but not able to get data from server, retry.")
                    console.log("joinFail, Get operation failed. Entered into game but not able to get data from server, retry.")
                  }

                }
                else {
                  socket.emit("joinFail", "Set operation failed, retry.")
                  console.log("joinFail, Set operation failed, retry.")
                }

              }
            }
            else {
              socket.emit("joinFail", "unpermitted action")
              console.log("joinFail, unpermitted action")
            }

          } catch (error) {
            socket.emit("joinFail", "unpermitted action/error")
            console.log("joinFail, unpermitted action/error" + error)
          }

        }
        else {
          socket.emit("joinFail", "token not passed")
          console.log("joinFail, token not passed")
        }

      }
      else {
        socket.emit("joinFail", "game set incorrectly, err")
        console.log("joinFail, game set incorrectly, err")
      }

    }
    else {
      socket.emit("joinFail", "Game does not exist")
      console.log("joinFail, Game does not exist")
    }

  });

  socket.on("reload", async (args) => {

    var gameRoom = args.gameKey;

    var game = undefined
    if (gameRoom) {
      game = await redisClient.get(gameRoom)
    }
    if (game) {

      var gameObject = JSON.parse(game)
      if (gameObject) {

        updateState(gameObject, gameRoom)

      }
      else {
        socket.emit("joinFail", "game set incorrectly, err")
        console.log("joinFail, game set incorrectly, err")
      }

    }
    else {
      socket.emit("joinFail", "Game does not exist")
      console.log("joinFail, Game does not exist")
    }

  });

  socket.on("creatorJoin", async (args) => {

    var email = args.email;
    var gameRoom = args.gameKey;
    var token = args.token;

    var game = undefined
    if (gameRoom) {
      game = await redisClient.get(gameRoom)
    }
    if (game) {

      var gameObject = JSON.parse(game)
      if (gameObject) {
        if (token) {

          try {

            //check if the token matches the supposed origin
            const decodedToken = await jwt.verify(token, "RANDOM-TOKEN");

            if (JSON.stringify(decodedToken) === JSON.stringify(gameObject.creatorToken) && email === gameObject.creatorEmail) {

              socket.join(gameRoom)
              updateState(gameObject, gameRoom)
              console.log("Creator Socket joined")

            }
            else {
              socket.emit("joinFail", "unpermitted action")
              console.log("joinFail, unpermitted action")
            }

          } catch (error) {
            socket.emit("joinFail", "unpermitted action/error")
            console.log("joinFail, unpermitted action/error" + error)
          }

        }
        else {
          socket.emit("joinFail", "token not passed")
          console.log("joinFail, token not passed")
        }
      }
      else {
        socket.emit("joinFail", "game set incorrectly, err")
        console.log("joinFail, game set incorrectly, err")
      }

    }
    else {
      socket.emit("joinFail", "Game does not exist")
      console.log("joinFail, Game does not exist")
    }

  });

  socket.on("deleteUser", async (args) => {

    var email = args.email;
    var gameRoom = args.gameKey;
    var token = args.token;
    var userToDelete = args.userToDelete;

    //console.log(userToDelete)

    if (userToDelete) {
      var game = undefined
      if (gameRoom) {
        game = await redisClient.get(gameRoom)
      }
      if (game) {

        var gameObject = JSON.parse(game)
        if (gameObject) {

          if (token) {

            try {

              //check if the token matches the supposed origin
              const decodedToken = await jwt.verify(token, "RANDOM-TOKEN");

              if (JSON.stringify(decodedToken) === JSON.stringify(gameObject.creatorToken) && email === gameObject.creatorEmail) {

                var indexUsers;
                var indexSockets;

                for (var i = 0; i < gameObject.users.length; i++) {
                  if (gameObject.users[i].email === userToDelete) {
                    indexUsers = i;
                  }
                  //console.log("Running through users at index: " + i + ", the selected object is" + gameObject.users[i].email + ", and selected index is " + indexUsers)
                }
                for (var k = 0; k < gameObject.sockets.length; k++) {
                  if (gameObject.sockets[k].email === userToDelete) {
                    indexSockets = k;
                  }
                  //console.log("Running through sockets at index: " + k + ", the selected object is" + gameObject.sockets[k].email + ", and selected index is " + indexSockets)
                }

                if (indexUsers >= 0 && indexSockets >= 0) {
                  var deleteSocket = io.sockets.sockets.get(gameObject.sockets[indexSockets].socketID)

                  gameObject.sockets.splice(indexSockets, 1)
                  gameObject.users.splice(indexUsers, 1)

                  const resultSet = await redisClient.set(gameRoom, JSON.stringify(gameObject))
                  if (resultSet) {

                    const newGame = await redisClient.get(gameRoom)
                    if (newGame) {
                      var newGameObject = JSON.parse(newGame)
                      if (newGameObject) {
                        if (deleteSocket) {
                          deleteSocket.emit("kicked", "You've been kicked from the room")
                          deleteSocket.leave(gameRoom)
                          updateState(newGameObject, gameRoom)
                          console.log("Socket left")
                        }
                        else {
                          socket.emit("error", "socket not found, retry.")
                          console.log("deleteFail, socket not found, retry.")
                        }

                      }
                      else {
                        socket.emit("error", "game set incorrectly, err")
                        console.log("deleteFail, game set incorrectly, err")
                      }

                    }
                    else {
                      socket.emit("error", "Get operation failed. Deleted from game but not able to get data from server, retry.")
                      console.log("deleteFail, Get operation failed. Deleted from game but not able to get data from server, retry.")
                    }

                  }
                  else {
                    socket.emit("error", "Set operation failed, retry.")
                    console.log("deleteFail, Set operation failed, retry.")
                  }
                }
                else {
                  socket.emit("error", "user does not exist")
                  console.log("deleteFail, user does not exist")
                }

              }
              else {
                socket.emit("error", "unpermitted action")
                console.log("deleteFail, unpermitted action")
              }

            } catch (error) {
              socket.emit("error", "unpermitted action/error")
              console.log("deleteFail, unpermitted action/error" + error)
            }

          }
          else {
            socket.emit("error", "token not passed")
            console.log("deleteFail, token not passed")
          }

        }
        else {
          socket.emit("error", "game set incorrectly, err")
          console.log("deleteFail, game set incorrectly, err")
        }

      }
      else {
        socket.emit("error", "Game does not exist")
        console.log("deleteFail, Game does not exist")
      }

    }
    else {
      socket.emit("error", "No email passed")
      console.log("deleteFail, No email passed")
    }
  });

  socket.on("startGame", async (args) => {

    var email = args.email;
    var gameRoom = args.gameKey;
    var token = args.token;

    var game = undefined
    if (gameRoom) {
      game = await redisClient.get(gameRoom)
    }
    if (game) {

      var gameObject = JSON.parse(game)
      if (gameObject) {

        if (token) {

          try {

            //check if the token matches the supposed origin
            const decodedToken = await jwt.verify(token, "RANDOM-TOKEN");

            if (JSON.stringify(decodedToken) === JSON.stringify(gameObject.creatorToken) && email === gameObject.creatorEmail) {

              if (gameObject.sockets.length > 0) {
                gameObject.gameState = "question"

                const resultSet = await redisClient.set(gameRoom, JSON.stringify(gameObject))
                if (resultSet) {

                  const newGame = await redisClient.get(gameRoom)
                  if (newGame) {

                    var newGameObject = JSON.parse(newGame)
                    if (newGameObject) {
                      updateState(newGameObject, gameRoom)
                    }
                    else {
                      socket.emit("error", "Object set incorrectly.")
                      console.log("startGameFail, Object set incorrectly.")
                    }

                  }
                  else {
                    socket.emit("error", "Get operation failed. Not able to get data from server, retry.")
                    console.log("startGameFail, Get operation failed. Not able to get data from server, retry.")
                  }

                }
                else {
                  socket.emit("error", "Set operation failed, retry.")
                  console.log("startGameFail, Set operation failed, retry.")
                }
              }
              else {
                socket.emit("error", "not enough players")
                console.log("startGameFail, not enough players")
              }

            }
            else {
              socket.emit("error", "unpermitted action")
              console.log("startGameFail, unpermitted action")
            }

          } catch (error) {
            socket.emit("error", "unpermitted action/error")
            console.log("startGameFail, unpermitted action/error" + error)
          }

        }
        else {
          socket.emit("error", "token not passed")
          console.log("startGameFail, token not passed")
        }

      }
      else {
        socket.emit("error", "game set incorrectly, err")
        console.log("startGameFail, game set incorrectly, err")
      }

    }
    else {
      socket.emit("error", "Game does not exist")
      console.log("startGameFail, Game does not exist")
    }

  });

  socket.on("endGame", async (args) => {

    var email = args.email;
    var gameRoom = args.gameKey;
    var token = args.token;

    var game = undefined
    if (gameRoom) {
      game = await redisClient.get(gameRoom)
    }
    if (game) {

      var gameObject = JSON.parse(game)
      if (gameObject) {

        if (token) {

          try {

            //check if the token matches the supposed origin
            const decodedToken = await jwt.verify(token, "RANDOM-TOKEN");

            if (JSON.stringify(decodedToken) === JSON.stringify(gameObject.creatorToken) && email === gameObject.creatorEmail) {

              gameObject.gameState = "endGame"

              const resultSet = await redisClient.set(gameRoom, JSON.stringify(gameObject))
              if (resultSet) {

                io.to(gameRoom).emit("endGame")

              }
              else {
                socket.emit("error", "Set operation failed, retry.")
                console.log("newQuestionFail, Set operation failed, retry.")
              }

            }
            else {
              socket.emit("error", "unpermitted action")
              console.log("newQuestionFail, unpermitted action")
            }

          } catch (error) {
            socket.emit("error", "unpermitted action/error")
            console.log("newQuestionFail, unpermitted action/error" + error)
          }

        }
        else {
          socket.emit("error", "token not passed")
          console.log("newQuestionFail, token not passed")
        }

      }
      else {
        socket.emit("error", "game set incorrectly, err")
        console.log("newQuestionFail, game set incorrectly, err")
      }

    }
    else {
      socket.emit("error", "Game does not exist")
      console.log("newQuestionFail, Game does not exist")
    }

  });

  socket.on("newQuestion", async (args) => {

    var email = args.email;
    var gameRoom = args.gameKey;
    var token = args.token;

    var game = undefined
    if (gameRoom) {
      game = await redisClient.get(gameRoom)
    }
    if (game) {

      var gameObject = JSON.parse(game)
      if (gameObject) {

        if (token) {

          try {

            //check if the token matches the supposed origin
            const decodedToken = await jwt.verify(token, "RANDOM-TOKEN");

            if (JSON.stringify(decodedToken) === JSON.stringify(gameObject.creatorToken) && email === gameObject.creatorEmail) {

              gameObject.gameState = "question"

              if (gameObject.questionNum + 1 < gameObject.gameSetting.questions.length) {
                gameObject.questionNum++;

                const resultSet = await redisClient.set(gameRoom, JSON.stringify(gameObject))
                if (resultSet) {

                  const newGame = await redisClient.get(gameRoom)
                  if (newGame) {

                    var newGameObject = JSON.parse(newGame)
                    if (newGameObject) {
                      updateState(newGameObject, gameRoom)
                    }
                    else {
                      socket.emit("error", "Object set incorrectly.")
                      console.log("newQuestionFail, Object set incorrectly.")
                    }

                  }
                  else {
                    socket.emit("error", "Get operation failed. Not able to get data from server, retry.")
                    console.log("newQuestionFail, Get operation failed. Not able to get data from server, retry.")
                  }

                }
                else {
                  socket.emit("error", "Set operation failed, retry.")
                  console.log("newQuestionFail, Set operation failed, retry.")
                }

              }
              else {
                gameObject.gameState = "finalLeaderboard"

                const resultSet = await redisClient.set(gameRoom, JSON.stringify(gameObject))
                if (resultSet) {

                  const newGame = await redisClient.get(gameRoom)
                  if (newGame) {

                    var newGameObject = JSON.parse(newGame)
                    if (newGameObject) {
                      updateState(newGameObject, gameRoom)
                    }
                    else {
                      socket.emit("error", "Object set incorrectly.")
                      console.log("newQuestionFail, Object set incorrectly.")
                    }

                  }
                  else {
                    socket.emit("error", "Get operation failed. Not able to get data from server, retry.")
                    console.log("newQuestionFail, Get operation failed. Not able to get data from server, retry.")
                  }

                }
                else {
                  socket.emit("error", "Set operation failed, retry.")
                  console.log("newQuestionFail, Set operation failed, retry.")
                }
              }

            }
            else {
              socket.emit("error", "unpermitted action")
              console.log("newQuestionFail, unpermitted action")
            }

          } catch (error) {
            socket.emit("error", "unpermitted action/error")
            console.log("newQuestionFail, unpermitted action/error" + error)
          }

        }
        else {
          socket.emit("error", "token not passed")
          console.log("newQuestionFail, token not passed")
        }

      }
      else {
        socket.emit("error", "game set incorrectly, err")
        console.log("newQuestionFail, game set incorrectly, err")
      }

    }
    else {
      socket.emit("error", "Game does not exist")
      console.log("newQuestionFail, Game does not exist")
    }

  });

  socket.on("newAnswers", async (args) => {

    var email = args.email;
    var gameRoom = args.gameKey;
    var token = args.token;

    var game = undefined
    if (gameRoom) {
      game = await redisClient.get(gameRoom)
    }
    if (game) {

      var gameObject = JSON.parse(game)
      if (gameObject) {

        if (token) {

          try {

            //check if the token matches the supposed origin
            const decodedToken = await jwt.verify(token, "RANDOM-TOKEN");

            if (JSON.stringify(decodedToken) === JSON.stringify(gameObject.creatorToken) && email === gameObject.creatorEmail) {

              gameObject.gameState = "answers"

              const resultSet = await redisClient.set(gameRoom, JSON.stringify(gameObject))
              if (resultSet) {

                const newGame = await redisClient.get(gameRoom)
                if (newGame) {

                  var newGameObject = JSON.parse(newGame)
                  if (newGameObject) {

                    updateState(newGameObject, gameRoom)

                  }
                  else {
                    socket.emit("error", "Object set incorrectly.")
                    console.log("newAnswersFail, Object set incorrectly.")
                  }

                }
                else {
                  socket.emit("error", "Get operation failed. Not able to get data from server, retry.")
                  console.log("newAnswersFail, Get operation failed. Not able to get data from server, retry.")
                }

              }
              else {
                socket.emit("error", "Set operation failed, retry.")
                console.log("newAnswersFail, Set operation failed, retry.")
              }

            }
            else {
              socket.emit("error", "unpermitted action")
              console.log("newAnswersFail, unpermitted action")
            }

          } catch (error) {
            socket.emit("error", "unpermitted action/error")
            console.log("newAnswersFail, unpermitted action/error" + error)
          }

        }
        else {
          socket.emit("error", "token not passed")
          console.log("newAnswersFail, token not passed")
        }

      }
      else {
        socket.emit("error", "game set incorrectly, err")
        console.log("newAnswersFail, game set incorrectly, err")
      }

    }
    else {
      socket.emit("error", "Game does not exist")
      console.log("newAnswersFail, Game does not exist")
    }

  });

  socket.on("newLeaderboard", async (args) => {

    var email = args.email;
    var gameRoom = args.gameKey;
    var token = args.token;

    var game = undefined
    if (gameRoom) {
      game = await redisClient.get(gameRoom)
    }
    if (game) {

      var gameObject = JSON.parse(game)
      if (gameObject) {

        if (token) {

          try {

            //check if the token matches the supposed origin
            const decodedToken = await jwt.verify(token, "RANDOM-TOKEN");

            if (JSON.stringify(decodedToken) === JSON.stringify(gameObject.creatorToken) && email === gameObject.creatorEmail) {

              gameObject.gameState = "leaderboard"

              const resultSet = await redisClient.set(gameRoom, JSON.stringify(gameObject))
              if (resultSet) {

                const newGame = await redisClient.get(gameRoom)
                if (newGame) {

                  var newGameObject = JSON.parse(newGame)
                  if (newGameObject) {
                    updateState(newGameObject, gameRoom)
                  }
                  else {
                    socket.emit("error", "Object set incorrectly.")
                    console.log("newLeaderboardFail, Object set incorrectly.")
                  }

                }
                else {
                  socket.emit("error", "Get operation failed. Deleted from game but not able to get data from server, retry.")
                  console.log("newLeaderboardFail, Get operation failed. Deleted from game but not able to get data from server, retry.")
                }

              }
              else {
                socket.emit("error", "Set operation failed, retry.")
                console.log("newLeaderboardFail, Set operation failed, retry.")
              }


            }
            else {
              socket.emit("error", "unpermitted action")
              console.log("newLeaderboardFail, unpermitted action")
            }

          } catch (error) {
            socket.emit("error", "unpermitted action/error")
            console.log("newLeaderboardFail, unpermitted action/error" + error)
          }

        }
        else {
          socket.emit("error", "token not passed")
          console.log("newLeaderboardFail, token not passed")
        }

      }
      else {
        socket.emit("error", "game set incorrectly, err")
        console.log("newLeaderboardFail, game set incorrectly, err")
      }

    }
    else {
      socket.emit("error", "Game does not exist")
      console.log("newLeaderboardFail, Game does not exist")
    }

  });

  socket.on("newAnswer", async (args) => {

    var email = args.email;
    var gameRoom = args.gameKey;
    var token = args.token;
    var answer = args.answer

    if (answer >= 0) {

      var game = undefined
      if (gameRoom) {
        game = await redisClient.get(gameRoom)
      }
      if (game) {

        var gameObject = JSON.parse(game)
        if (gameObject) {

          if (token) {

            try {

              //check if the token matches the supposed origin
              const decodedToken = await jwt.verify(token, "RANDOM-TOKEN");

              if (gameObject.users.some((user) => JSON.stringify(user.token) === JSON.stringify(decodedToken) && user.email === email)) {
                if (gameObject.answers.some((answer) => answer.email === email && answer.questionNum === gameObject.questionNum)) {
                  socket.emit("error", "Question already answered.")
                  console.log("newAnswerFail, Question already answered.")
                }
                else {
                  gameObject.answers.push({ email: email, questionNum: gameObject.questionNum, answer: answer, score: 0 })
                  if (gameObject.gameSetting.questions[gameObject.questionNum].answers[answer].state) {
                    for (var f = 0; f < gameObject.users.length; f++) {
                      if (gameObject.users[f].email === email) {
                        var correctAnswers = 1;
                        for (var d = 0; d < gameObject.answers.length; d++) {
                          if (gameObject.answers[d].questionNum === gameObject.questionNum && gameObject.answers[d].score > 0) {
                            correctAnswers++;
                          }
                        }
                        gameObject.users[f].score += ((1 / correctAnswers) * gameObject.gameSetting.questions[gameObject.questionNum].points)

                        var indexAnswer = gameObject.answers.findIndex((element) => element.email === email && element.questionNum === gameObject.questionNum)
                        if (indexAnswer >= 0) {
                          gameObject.answers[indexAnswer].score = ((1 / correctAnswers) * gameObject.gameSetting.questions[gameObject.questionNum].points)
                        }
                      }
                    }


                  }

                  const resultSet = await redisClient.set(gameRoom, JSON.stringify(gameObject))
                  if (resultSet) {

                    socket.emit("questionState", "answered")

                  }
                  else {
                    socket.emit("error", "Set operation failed, retry.")
                    console.log("newAnswerFail, Set operation failed, retry.")
                  }
                }
              }
              else {
                socket.emit("error", "unpermitted action")
                console.log("newAnswerFail, unpermitted action")
              }

            } catch (error) {
              socket.emit("error", "unpermitted action/error")
              console.log("newAnswerFail, unpermitted action/error" + error)
            }

          }
          else {
            socket.emit("error", "token not passed")
            console.log("newAnswerFail, token not passed")
          }

        }
        else {
          socket.emit("error", "game set incorrectly, err")
          console.log("newAnswerFail, game set incorrectly, err")
        }

      }
      else {
        socket.emit("error", "Game does not exist")
        console.log("newAnswerFail, Game does not exist")
      }

    }
    else {
      socket.emit("error", "Answer does not exist")
      console.log("newAnswerFail, Answer does not exist")
    }

  });

});

server.listen(port);