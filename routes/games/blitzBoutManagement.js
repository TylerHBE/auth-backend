const express = require('express')
const router = express.Router();
// game setting data model for mongoDB
const GameSetting = require("../../mongoDB/gameSettingsModel")
// encryption for password + other data
const auth = require("../../auth");
const { redisClient } = require("../../redisDB/redisConnect")
const randomString = require("../../functionals/randomString")

// Create game endpoint
router.post("/create-game", auth, async (request, response) => {

    // find the gameSetting
    const result = await GameSetting.findOne({ email: request.body.email, name: request.body.gameName })
    if (result) {

        const gameKey = randomString(7);

        const rResult = await redisClient.set(gameKey, JSON.stringify({
            creatorEmail: request.body.email,
            creatorToken: request.user,
            gameState: "lobby",
            questionNum: 0,
            gameSetting: result,
            gameKey: gameKey,
            users: [],
            answers: [],
            sockets: []
        }), { EX: 60 * 60 * 2 })
        if (rResult) {
            response.status(201).send({
                message: "Game setting created Successfully",
                gameKey: gameKey,
            });
        }
        else {
            console.log(rResult)
            response.status(500).send({
                message: "error setting game",
            });
        }
    }
    else {
        response.status(500).send({
            message: "Error finding game",
        });
    }

})

// Create game endpoint
router.post("/join-game", auth, async (request, response) => {
    // find the gameSetting
    const game = await redisClient.get(request.body.gameKey)
    if (game) {

        var gameObject = JSON.parse(game);
        if (gameObject) {
            if (!(gameObject.users.includes((element) => element.email === request.body.email))) {
                gameObject.users.push({
                    email: request.body.email,
                    avatar: request.body.avatar,
                    username: request.body.username,
                    token: request.user,
                    score: 0
                })
                const newGameObject = JSON.stringify(gameObject)

                const rResult = await redisClient.set(request.body.gameKey, newGameObject)
                if (rResult) {
                    response.status(201).send({
                        message: "Game users updated Successfully",
                        gameKey: request.body.gameKey,
                    });
                }
                else {
                    response.status(500).send({
                        message: "Error updating game users",
                    });
                }
            }
            else {
                response.status(201).send({
                    message: "Game users reed Successfully",
                    gameKey: request.body.gameKey,
                });
            }

        }
        else {
            response.status(500).send({
                message: "Error parsing game",
            });
        }

    }
    else {
        response.status(500).send({
            message: "Error finding game",
        });
    }

})

// register endpoint
router.post("/create-gameSetting", auth, (request, response) => {

    // check if email exists
    GameSetting.find({ email: request.body.email, name: request.body.gameName })
        // if email exists
        .then((gameSettings) => {

            if (gameSettings.length > 0) {
                return response.status(400).send({
                    message: `Doc already exists! Name: ${request.body.gameName}`,
                    gameSettings: gameSettings
                });
            }
            else {
                const gameSetting = new GameSetting({
                    email: request.body.email,
                    name: request.body.gameName,
                    questions: request.body.questions,

                });
                // save the new user
                gameSetting
                    .save()
                    // return success if the new user is added to the database successfully
                    .then(() => {

                        response.status(201).send({
                            message: "Game setting created Successfully",
                            gameSetting: gameSetting
                        });
                    })
                    // catch error if the new user wasn't added successfully to the database
                    .catch((error) => {
                        response.status(500).send({
                            message: "Error creating gameSetting, check that all required form field elements are created",
                            error,
                        });
                    });
            }

        })
        // catch error if email does not exist
        .catch((error) => {
            return response.status(400).send({
                message: `Error validating doc, check for errors in implementation`,
                error
            });
        });
});

// gameSetting update endpoint
router.post("/update-gameSetting", auth, (request, response) => {
    GameSetting.findOneAndUpdate(
        { email: request.body.email, name: request.body.gameName },
        {
            questions: request.body.questions, // field:values to update
        },
        {
            new: true, // return updated doc
            runValidators: true // validate before update
        }
    )
        // return success if the avatar is added to the database successfully
        .then((result) => {
            response.status(201).send({
                message: "gameSetting updated successfully",
                result,
            });
        })
        // catch error if the avatar wasn't added successfully to the database
        .catch((error) => {
            response.status(500).send({
                message: "Error updating gameSetting",
                error,
            });
        });
});

// gameSetting update endpoint
router.post("/delete-gameSetting", auth, (request, response) => {
    GameSetting.findOneAndDelete(
        { email: request.body.email, name: request.body.gameName },
    )
        // return success if the avatar is added to the database successfully
        .then(() => {
            // find the avatar
            GameSetting.find({
                email: request.body.email // search query
            })
                // return success if the avatar is found and then send
                .then((result) => {
                    if (result.length > 0) {
                        response.status(201).send({
                            length: result.length,
                            gameSettings: result,
                            message: "Deleted successfully",
                        });
                    } else {
                        response.status(201).send({
                            message: "No game settings saved, all deleted",
                            gameSettings: result,
                        });
                    }
                })
                // catch error if there is no account
                .catch((error) => {
                    response.status(500).send({
                        message: "Error finding games, deleted successfully",
                        error,
                    });
                });
        })
        // catch error if the avatar wasn't added successfully to the database
        .catch((error) => {
            response.status(500).send({
                message: "Error deleting gameSetting",
                error,
            });
        });
});

// gameSettings get endpoint
router.post("/get-gameSettings", auth, (request, response) => {

    // find the avatar
    GameSetting.find({
        email: request.body.email // search query
    })
        // return success if the avatar is found and then send
        .then((result) => {
            if (result.length > 0) {
                response.status(201).send({
                    length: result.length,
                    gameSettings: result,
                    message: "Game settings returned successfully",
                });
            } else {
                response.status(500).send({
                    message: "No game settings saved",
                    gameSettings: result,
                });
            }
        })
        // catch error if there is no account
        .catch((error) => {
            response.status(500).send({
                message: "Error finding games",
                error,
            });
        });

});

module.exports = router